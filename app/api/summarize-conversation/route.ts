import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY is not set in environment variables");
}

const genAI = new GoogleGenAI({ apiKey: API_KEY });

export async function POST(req: Request) {
  try {
    const { conversation } = await req.json();

    if (typeof conversation !== "string" || conversation.trim() === "") {
      return NextResponse.json(
        { error: "bad request", detail: "conversation is required" },
        { status: 400 }
      );
    }

    // Gemini 2.5 Flash モデルを使用
    const model = "gemini-2.5-flash";

    const prompt = `以下は音声会話の記録です。この会話から、ユーザーの今日の気分や感情、体験した出来事を簡潔にまとめて。 例）あなたは、〜

要約の指針：
- ユーザーの感情や気分を重視して要約する
- 今日の出来事や体験を簡潔にまとめる
- 長すぎず、短すぎない自然な文章にする
- 「あなたは」を主語として一人称で書く

会話記録：
${conversation}

要約：`;

    const config = {
      model: model,
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    };

    const response = await genAI.models.generateContent(config);
    const summary = response.text || "取得できなかった。";

    return NextResponse.json({ summary: summary.trim() });
  } catch (error) {
    console.error("Error in summarize-conversation API:", error);
    return NextResponse.json(
      {
        error: "internal server error",
        detail: "Failed to summarize conversation",
      },
      { status: 500 }
    );
  }
}
