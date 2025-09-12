// lib/realtimeClient.ts
export type RealtimeClientOptions = {
  onUserTranscript?: (text: string) => void
  onAssistantText?: (delta: string, done?: boolean) => void
  onState?: (s: 'idle' | 'connecting' | 'connected' | 'recording' | 'ended' | 'error') => void
  /** あいさつの一言（未指定ならデフォルト文言） */
  greetingMessage?: string
  /** Realtime モデル（サーバー側で固定しているなら不要） */
  model?: string
}

type RealtimeEvent =
  | { type: 'response.delta'; response: { output_text_delta?: string } }
  | { type: 'response.completed' }
  | { type: 'input_audio_buffer.speech_started' }
  | { type: 'input_audio_buffer.speech_stopped' }
  | { type: 'response.audio.delta' }
  | { type: 'input_transcription.completed'; transcription: { text: string } }
  | { type: 'error'; error: { message: string } }
  | { type: string; [k: string]: any }

export class RealtimeClient {
  private pc?: RTCPeerConnection
  private dc?: RTCDataChannel
  private localStream?: MediaStream
  private remoteStream?: MediaStream
  private audioEl?: HTMLAudioElement
  private opts: RealtimeClientOptions
  private connected = false
  private dcOpened = false
  private greetingSent = false

  constructor(opts: RealtimeClientOptions = {}) {
    this.opts = opts
  }

  /** JSON を DataChannel 経由で送る */
  send(payload: Record<string, any>) {
    if (!this.dc || this.dc.readyState !== 'open') {
      console.warn('DataChannel is not open yet. Dropping payload:', payload)
      return
    }
    this.dc.send(JSON.stringify(payload))
  }

  /** 接続を開始（ユーザー操作から呼ばれる想定） */
  async start() {
    try {
      this.opts.onState?.('connecting')

      // 1) 短命トークン取得（あなたの API ルート）
      const tokenRes = await fetch('/api/realtime/session', { method: 'POST', cache: 'no-store' })
      if (!tokenRes.ok) throw new Error(`Failed to get ephemeral token: ${tokenRes.status}`)
      const tokenJson = await tokenRes.json()
      const ephemeralKey: string =
        tokenJson.client_secret?.value || tokenJson.client_secret || tokenJson.value || tokenJson.token
      const model: string = this.opts.model || tokenJson.model || 'gpt-4o-mini-realtime-preview-2024-12-17'
      if (!ephemeralKey) throw new Error('No ephemeral key found in /api/realtime/session response')

      // 2) RTCPeerConnection 準備
      this.pc = new RTCPeerConnection({
        iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
      })

      // 3) 受信用メディア（音声）を作成して <audio> に接続
      this.remoteStream = new MediaStream()
      this.audioEl = document.createElement('audio')
      this.audioEl.autoplay = true
      this.audioEl.srcObject = this.remoteStream
      // 画面に追加（必要ならスタイルで非表示にする）
      this.audioEl.style.display = 'none'
      document.body.appendChild(this.audioEl)

      // autoplay 制限対策：ユーザー操作内で先に play() を試みておく
      this.tryPlay('pre-connection')

      this.pc.addEventListener('track', (ev) => {
        ev.streams[0]?.getTracks().forEach((t) => this.remoteStream?.addTrack(t))
        this.tryPlay('ontrack')
      })

      // 4) DataChannel（oai-events）
      this.dc = this.pc.createDataChannel('oai-events')
      this.dc.binaryType = 'arraybuffer'

      this.dc.onopen = () => {
        this.dcOpened = true
        this.maybeSendGreeting() // 条件が揃えば即あいさつ送信
      }

      this.dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as RealtimeEvent
          this.handleRealtimeEvent(msg)
        } catch (e) {
          // 音声バイナリ delta などは JSON ではない
        }
      }

      this.dc.onerror = (e) => {
        console.error('DataChannel error:', e)
        this.opts.onState?.('error')
      }

      // 5) こちらのマイクを送る（サーバ VAD 用）
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      for (const track of this.localStream.getAudioTracks()) {
        this.pc.addTrack(track, this.localStream)
      }
      // 受信専用トランシーバ（音声）
      this.pc.addTransceiver('audio', { direction: 'recvonly' })

      // 6) Offer/Answer 交換（OpenAI Realtime へ WebRTC 接続）
      const offer = await this.pc.createOffer()
      await this.pc.setLocalDescription(offer)

      const baseUrl = 'https://api.openai.com/v1/realtime'
      const sdpRes = await fetch(`${baseUrl}?model=${encodeURIComponent(model)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      })
      if (!sdpRes.ok) throw new Error(`Realtime SDP exchange failed: ${sdpRes.status}`)
      const answerSdp = await sdpRes.text()
      await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

      // 7) 接続状態監視
      this.pc.addEventListener('connectionstatechange', () => {
        // connected → remote の音声を確実に再生可能に
        if (this.pc?.connectionState === 'connected') {
          this.connected = true
          this.opts.onState?.('connected')
          this.tryPlay('on-connected')
          this.maybeSendGreeting()
          // 録音状態に移行（UI 用）
          this.opts.onState?.('recording')
        } else if (this.pc?.connectionState === 'failed' || this.pc?.connectionState === 'disconnected') {
          this.opts.onState?.('error')
        }
      })
    } catch (e) {
      console.error(e)
      this.opts.onState?.('error')
    }
  }

  /** 初回あいさつを送る（接続＆DC open 後に一度だけ） */
  private maybeSendGreeting() {
    if (this.greetingSent) return
    if (!this.connected || !this.dcOpened) return

    // session.update → response.create の順に送る
    this.send({
      type: 'session.update',
      session: {
        instructions:
          'あなたは心理カウンセラーです。相手の今日の出来事や感情を聞き出してください。',
        modalities: ['text', 'audio'],
        voice: 'alloy',
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: { type: 'server_vad' },
      },
    })

    ///　TODO なぜか発話されない。
    this.send({
      type: 'response.create',
      response: {
        modalities: ['text', 'audio'],
        audio: { voice: 'alloy' },
        instructions: this.opts.greetingMessage ?? 'こんにちは！準備OKです。話しかけてください。',
      },
    })

    this.greetingSent = true
  }

  /** 受信イベント（字幕/テキストの組み立てなど） */
  private handleRealtimeEvent(msg: RealtimeEvent) {
    switch (msg.type) {
      case 'input_transcription.completed': {
        const text = msg.transcription?.text ?? ''
        if (text) this.opts.onUserTranscript?.(text)
        break
      }
      case 'response.delta': {
        const delta = msg.response?.output_text_delta ?? ''
        if (delta) this.opts.onAssistantText?.(delta, false)
        break
      }
      case 'response.completed': {
        this.opts.onAssistantText?.('', true)
        break
      }
      case 'error': {
        console.error('Realtime error:', msg.error?.message)
        this.opts.onState?.('error')
        break
      }
      default:
        // 他のイベントは必要に応じて追加
        break
    }
  }

  /** 自動再生制限に引っかかったら数回リトライ */
  private async tryPlay(tag: string) {
    try {
      await this.audioEl?.play()
    } catch (err) {
      // まだ音声トラックが来ていない/許可されていない等は無視
      // 接続/track 到来時に都度再試行する
      // console.warn(`[${tag}] audio.play() failed (will retry on next event):`, err)
    }
  }

  /** 録音の停止や切断 */
  async stop() {
    try {
      this.opts.onState?.('ended')
      this.dc?.close()
      this.pc?.close()
      this.localStream?.getTracks().forEach((t) => t.stop())
      if (this.audioEl) {
        this.audioEl.pause()
        this.audioEl.srcObject = null
        this.audioEl.remove()
      }
    } catch {}
    this.pc = undefined
    this.dc = undefined
    this.localStream = undefined
    this.remoteStream = undefined
    this.audioEl = undefined
    this.connected = false
    this.dcOpened = false
    this.greetingSent = false
  }
}
