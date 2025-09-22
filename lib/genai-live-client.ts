/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Content,
  GoogleGenAI,
  LiveCallbacks,
  LiveClientToolResponse,
  LiveConnectConfig,
  LiveServerContent,
  LiveServerMessage,
  LiveServerToolCall,
  LiveServerToolCallCancellation,
  Part,
  Session,
  Modality,
  MediaResolution,
} from "@google/genai";

import { EventEmitter } from "eventemitter3";
import { difference } from "lodash";
import { LiveClientOptions, StreamingLog } from "../types";
import { base64ToArrayBuffer } from "./utils";
import { useLoggerStore } from "./store-logger";

/**
 * Event types that can be emitted by the MultimodalLiveClient.
 * Each event corresponds to a specific message from GenAI or client state change.
 */
export interface LiveClientEventTypes {
  // Emitted when audio data is received
  audio: (data: ArrayBuffer) => void;
  // Emitted when the connection closes
  close: (event: CloseEvent) => void;
  // Emitted when content is received from the server
  content: (data: LiveServerContent) => void;
  // Emitted when an error occurs
  error: (error: ErrorEvent) => void;
  // Emitted when the server interrupts the current generation
  interrupted: () => void;
  // Emitted for logging events
  log: (log: StreamingLog) => void;
  // Emitted when the connection opens
  open: () => void;
  // Emitted when the initial setup is complete
  setupcomplete: () => void;
  // Emitted when a tool call is received
  toolcall: (toolCall: LiveServerToolCall) => void;
  // Emitted when a tool call is cancelled
  toolcallcancellation: (
    toolcallCancellation: LiveServerToolCallCancellation
  ) => void;
  // Emitted when the current turn is complete
  turncomplete: () => void;
}

interface MessageHistoryItem {
  type: "user" | "ai";
  content: string;
  timestamp: Date;
}

interface MessageContent {
  serverContent?: {
    inputTranscription?: {
      text?: string;
    };
    outputTranscription?: {
      text?: string;
    };
  };
}

/**
 * A event-emitting class that manages the connection to the websocket and emits
 * events to the rest of the application.
 * If you dont want to use react you can still use this.
 */
export class GenAILiveClient extends EventEmitter<LiveClientEventTypes> {
  protected client: GoogleGenAI | null = null;

  // メッセージを蓄積するための配列とバッファ
  protected messageHistory: MessageHistoryItem[] = []; // 完成したメッセージの履歴
  protected currentUserMessage: string = ""; // 現在蓄積中のユーザーメッセージ
  protected currentAIMessage: string = ""; // 現在蓄積中のAIメッセージ
  protected lastMessageType: "user" | "ai" | null = null; // 最後に処理したメッセージタイプ

  private _status: "connected" | "disconnected" | "connecting" = "disconnected";
  public get status() {
    return this._status;
  }

  private _session: Session | null = null;
  public get session() {
    return this._session;
  }

  private _model: string | null = null;
  public get model() {
    return this._model;
  }

  protected config: LiveConnectConfig | null = null;

  private conversationHistory: Array<{
    timestamp: Date;
    type: "user" | "ai";
    content: string;
  }> = [];

  public getConfig() {
    return { ...this.config };
  }

  constructor() {
    super();
    // クライアントは接続時に一時トークンで初期化
    this.send = this.send.bind(this);
    this.onopen = this.onopen.bind(this);
    this.onerror = this.onerror.bind(this);
    this.onclose = this.onclose.bind(this);
    this.onmessage = this.onmessage.bind(this);
  }

  protected log(type: string, message: StreamingLog["message"]) {
    const log: StreamingLog = {
      date: new Date(),
      type,
      message,
    };
    this.emit("log", log);
  }

  async connect(model: string, config: LiveConnectConfig): Promise<boolean> {
    if (this._status === "connected" || this._status === "connecting") {
      return false;
    }

    this._status = "connecting";
    this.config = config;
    this._model = model;

    try {
      // 一時トークンを取得
      const tokenResponse = await fetch("/api/auth-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!tokenResponse.ok) {
        throw new Error(`Failed to get auth token: ${tokenResponse.status}`);
      }

      const data = await tokenResponse.json();
      const token = data.token;

      const callbacks: LiveCallbacks = {
        onopen: this.onopen,
        onmessage: this.onmessage,
        onerror: this.onerror,
        onclose: this.onclose,
      };

      const customModel = "models/gemini-2.5-flash-preview-native-audio-dialog";

      const customConfig: LiveConnectConfig = {
        responseModalities: [Modality.AUDIO],
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Zephyr",
            },
          },
        },
        systemInstruction: {
          parts: [
            {
              text: `あなたは心理カウンセラーです。今日の出来事や思ったことをヒアリングして、ユーザーの感情を深堀りすることに徹してください。簡潔に答えてください。`,
            },
          ],
        },
      };

      // 一時トークンでクライアントを初期化
      this.client = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: "v1alpha" },
      });

      // Live APIに接続
      this._session = await this.client.live.connect({
        model: customModel,
        config: customConfig,
        callbacks,
      });
    } catch (e) {
      console.error("Error connecting to GenAI Live:", e);
      this._status = "disconnected";
      return false;
    }

    this._status = "connected";
    return true;
  }

  public disconnect() {
    if (!this.session) {
      return false;
    }
    this.displayHistory();

    this.session?.close();
    this._session = null;
    this.client = null; // クライアントもクリア
    this._status = "disconnected";

    this.log("client.close", `Disconnected`);
    return true;
  }

  protected onopen() {
    this.log("client.open", "Connected");
    this.emit("open");
  }

  protected onerror(e: ErrorEvent) {
    this.log("server.error", e.message);
    this.emit("error", e);
  }

  protected onclose(e: CloseEvent) {
    this.log(
      `server.close`,
      `disconnected ${e.reason ? `with reason: ${e.reason}` : ``}`
    );
    this.emit("close", e);
  }

  protected async onmessage(message: LiveServerMessage) {
    // すべてのメッセージをデバッグ出力
    console.log("=== 受信メッセージ ===", message);
    const userMessage = message.serverContent?.inputTranscription?.text;
    const aiMessage = message.serverContent?.outputTranscription?.text;
    console.log(`ユーザー: ${userMessage}`);
    console.log(`AI: ${aiMessage}`);
    this.processMessage(message);

    if (message.setupComplete) {
      this.log("server.send", "setupComplete");
      this.emit("setupcomplete");
      return;
    }
    if (message.toolCall) {
      this.log("server.toolCall", message);
      this.emit("toolcall", message.toolCall);
      return;
    }
    if (message.toolCallCancellation) {
      this.log("server.toolCallCancellation", message);
      this.emit("toolcallcancellation", message.toolCallCancellation);
      return;
    }

    // this json also might be `contentUpdate { interrupted: true }`
    // or contentUpdate { end_of_turn: true }
    if (message.serverContent) {
      const { serverContent } = message;
      if ("interrupted" in serverContent) {
        this.log("server.content", "interrupted");
        this.emit("interrupted");
        return;
      }
      if ("turnComplete" in serverContent) {
        this.log("server.content", "turnComplete");
        this.emit("turncomplete");
      }

      if ("modelTurn" in serverContent) {
        let parts: Part[] = serverContent.modelTurn?.parts || [];

        // when its audio that is returned for modelTurn
        const audioParts = parts.filter(
          (p) => p.inlineData && p.inlineData.mimeType?.startsWith("audio/pcm")
        );
        const base64s = audioParts.map((p) => p.inlineData?.data);

        // strip the audio parts out of the modelTurn
        const otherParts = difference(parts, audioParts);
        // console.log("otherParts", otherParts);

        base64s.forEach((b64) => {
          if (b64) {
            const data = base64ToArrayBuffer(b64);
            this.emit("audio", data);
            this.log(`server.audio`, `buffer (${data.byteLength})`);
          }
        });
        if (!otherParts.length) {
          return;
        }

        parts = otherParts;

        // AIのテキスト応答を会話履歴に記録
        parts.forEach((part) => {
          if (part.text) {
            this.conversationHistory.push({
              timestamp: new Date(),
              type: "ai",
              content: part.text,
            });
          }
        });

        const content: { modelTurn: Content } = { modelTurn: { parts } };
        this.emit("content", content);
        this.log(`server.content`, message);
      }
    } else {
      console.log("received unmatched message", message);
    }
  }

  /**
   * send realtimeInput, this is base64 chunks of "audio/pcm" and/or "image/jpg"
   */
  sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>) {
    let hasAudio = false;
    let hasVideo = false;
    for (const ch of chunks) {
      this.session?.sendRealtimeInput({ media: ch });
      if (ch.mimeType.includes("audio")) {
        hasAudio = true;
      }
      if (ch.mimeType.includes("image")) {
        hasVideo = true;
      }
      if (hasAudio && hasVideo) {
        break;
      }
    }
    const message =
      hasAudio && hasVideo
        ? "audio + video"
        : hasAudio
        ? "audio"
        : hasVideo
        ? "video"
        : "unknown";
    this.log(`client.realtimeInput`, message);
  }

  /**
   *  send a response to a function call and provide the id of the functions you are responding to
   */
  sendToolResponse(toolResponse: LiveClientToolResponse) {
    if (
      toolResponse.functionResponses &&
      toolResponse.functionResponses.length
    ) {
      this.session?.sendToolResponse({
        functionResponses: toolResponse.functionResponses,
      });
      this.log(`client.toolResponse`, toolResponse);
    }
  }

  /**
   * send normal content parts such as { text }
   */
  send(parts: Part | Part[], turnComplete: boolean = true) {
    this.session?.sendClientContent({ turns: parts, turnComplete });

    // ユーザーのテキスト入力を会話履歴に記録
    const partsArray = Array.isArray(parts) ? parts : [parts];
    partsArray.forEach((part) => {
      if (part.text) {
        this.conversationHistory.push({
          timestamp: new Date(),
          type: "user",
          content: part.text,
        });
      }
    });

    this.log(`client.send`, {
      turns: partsArray,
      turnComplete,
    });
  }

  processMessage(message: LiveServerMessage) {
    // すべてのメッセージをデバッグ出力
    console.log("=== 受信メッセージ ===", message);

    const userMessage = message.serverContent?.inputTranscription?.text;
    const aiMessage = message.serverContent?.outputTranscription?.text;

    console.log(`ユーザー: ${userMessage}`);
    console.log(`AI: ${aiMessage}`);

    // ユーザーメッセージの処理
    if (userMessage) {
      // 新しいユーザーメッセージが来た場合
      if (this.lastMessageType === "ai" && this.currentAIMessage.trim()) {
        // 前のAIメッセージを履歴に保存
        this.messageHistory.push({
          type: "ai",
          content: this.currentAIMessage.trim(),
          timestamp: new Date(),
        });
        this.currentAIMessage = ""; // AIメッセージバッファをクリア
      }

      // ユーザーメッセージを蓄積
      this.currentUserMessage += userMessage;
      this.lastMessageType = "user";

      console.log(`[蓄積中] ユーザーメッセージ: "${this.currentUserMessage}"`);
    }

    // AIメッセージの処理
    if (aiMessage) {
      // 新しいAIメッセージが来た場合
      if (this.lastMessageType === "user" && this.currentUserMessage.trim()) {
        // 前のユーザーメッセージを履歴に保存
        this.messageHistory.push({
          type: "user",
          content: this.currentUserMessage.trim(),
          timestamp: new Date(),
        });
        this.currentUserMessage = ""; // ユーザーメッセージバッファをクリア
      }

      // AIメッセージを蓄積
      this.currentAIMessage += aiMessage;
      this.lastMessageType = "ai";

      console.log(`[蓄積中] AIメッセージ: "${this.currentAIMessage}"`);
    }
  }

  // 履歴を表示する関数
  displayHistory() {
    console.log("=== メッセージ履歴 ===");
    this.messageHistory.forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.type.toUpperCase()}] ${msg.content}`);
      console.log(`   時刻: ${msg.timestamp.toLocaleString()}`);
    });

    // 蓄積中のメッセージも表示
    if (this.currentUserMessage.trim()) {
      console.log(`蓄積中 [USER] ${this.currentUserMessage}`);
    }
    if (this.currentAIMessage.trim()) {
      console.log(`蓄積中 [AI] ${this.currentAIMessage}`);
    }
  }

  // 会話履歴を取得するメソッド（最終的な蓄積メッセージも含む）
  getConversationHistory(): MessageHistoryItem[] {
    const history = [...this.messageHistory];

    // 蓄積中のメッセージがあれば追加
    if (this.currentUserMessage.trim()) {
      history.push({
        type: "user",
        content: this.currentUserMessage.trim(),
        timestamp: new Date(),
      });
    }
    if (this.currentAIMessage.trim()) {
      history.push({
        type: "ai",
        content: this.currentAIMessage.trim(),
        timestamp: new Date(),
      });
    }

    return history;
  }

  // 会話履歴をテキスト形式で取得
  getConversationAsText(): string {
    const history = this.getConversationHistory();
    if (history.length === 0) return "";

    return history
      .map((msg) => {
        const role = msg.type === "user" ? "あなた" : "AI";
        return `${role}: ${msg.content}`;
      })
      .join("\n\n");
  }

  // 会話履歴をクリア
  clearConversationHistory() {
    this.messageHistory = [];
    this.currentUserMessage = "";
    this.currentAIMessage = "";
    this.lastMessageType = null;
  }
}
