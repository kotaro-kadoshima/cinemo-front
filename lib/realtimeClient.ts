// =============================
// 2) クライアント: Realtime接続ヘルパ
//    ファイル: lib/realtimeClient.ts
// =============================
export type RealtimeClientOptions = {
  onUserTranscript?: (text: string) => void
  onAssistantText?: (delta: string, done?: boolean) => void
  onState?: (s: 'idle' | 'connecting' | 'recording' | 'thinking' | 'ended') => void
}

export class RealtimeClient {
  private pc?: RTCPeerConnection
  private dc?: RTCDataChannel
  private localStream?: MediaStream
  private audioEl?: HTMLAudioElement
  private opts: RealtimeClientOptions

  constructor(opts: RealtimeClientOptions = {}) {
    this.opts = opts
  }

  async start() {
    this.opts.onState?.('connecting')

    // 1) 画面から短命トークンを取得
    const tokenRes = await fetch('/api/realtime/session', { method: 'POST', cache: 'no-store' })
    if (!tokenRes.ok) {
      const t = await tokenRes.text()
      throw new Error(`/api/realtime/session failed: ${tokenRes.status} ${tokenRes.statusText}\n${t}`)
    }
    const { token } = await tokenRes.json()
    if (!token) throw new Error('Failed to obtain ephemeral token from /api/realtime/session')

    // 2) マイク取得
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true })

    // 3) WebRTC 準備
    this.pc = new RTCPeerConnection()

    // 再生用のリモート音声
   this.audioEl = document.createElement('audio')
   this.audioEl.autoplay = true
   // 自動再生を安定させるためDOMに追加
   try { document.body.appendChild(this.audioEl) } catch {}

   this.pc.ontrack = (e) => {
     const [remote] = e.streams
     if (this.audioEl) {
       this.audioEl.srcObject = remote
       this.audioEl.play().catch(() => {})
     }
   }

    // 双方向音声
    this.pc.addTrack(this.localStream.getTracks()[0])
   this.pc.addTransceiver('audio', { direction: 'sendrecv' })
   // 一部環境で video m-line を要求されるため受信専用を追加
   this.pc.addTransceiver('video', { direction: 'recvonly' })

    // 一部の時期・環境で video m-line を要求されるケースに備える（受信専用）
    // カメラ権限は不要（recvonly）
    this.pc.addTransceiver('video', { direction: 'recvonly' })

    // 受信用データチャンネル（イベント受け取り）
   this.dc = this.pc.createDataChannel('oai-events')
   this.dc.onmessage = (ev) => this.onMessage(ev)
   this.dc.onopen = () => {
     // バッファ吐き出し
     const buf: any[] = (this as any)._buffer || []
     for (const m of buf) this.dc!.send(JSON.stringify(m))
     ;(this as any)._buffer = []

     // セッション設定（open後に送る）
     this.send({
       type: 'session.update',
       session: {
         instructions: 'あなたはフレンドリーな聞き役です。日本語で会話し、相手の発話を理解して短めに返答してください。',
         input_audio_transcription: { model: 'whisper-1' },
         turn_detection: { type: 'server_vad' },
       },
     })
     // スピーカー確認のため最初に一言（任意）
     this.send({
       type: 'response.create',
       response: { modalities: ['text','audio'], instructions: 'こんにちは！準備OKです。話しかけてください。' }
     })
     this.opts.onState?.('recording')
   }

    // 4) Offer → SDPをRealtimeへPOST
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)

    async function postSDP(bearer: string) {
      return fetch('https://api.openai.com/v1/realtime?model=gpt-realtime', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bearer}`,
          'Content-Type': 'application/sdp',
          'OpenAI-Beta': 'realtime=v1',
        },
        body: offer.sdp,
      })
    }

    let resp = await postSDP(token)
    let contentType = resp.headers.get('content-type') || ''
    let answerSDP = await resp.text()

    // 401 → エフェメラル失効の可能性。1回だけトークン更新してリトライ。
    if (resp.status === 401) {
      const retryRes = await fetch('/api/realtime/session', { method: 'POST', cache: 'no-store' })
      const retryJson = await retryRes.json()
      if (retryJson?.token) {
        resp = await postSDP(retryJson.token)
        contentType = resp.headers.get('content-type') || ''
        answerSDP = await resp.text()
      }
    }

    // Validate: 201/200 OK かつ、Content-Type が application/sdp
    // もしくは本文が SDP 先頭記号（v=）で始まっていれば通す
    if (!resp.ok) {
      let err: any = {}
      try { err = JSON.parse(answerSDP) } catch {}
      throw new Error(`Realtime SDP error: ${resp.status} ${resp.statusText} ${err?.error?.message ?? answerSDP}`)
    }
    const isSdpByHeader = contentType.includes('application/sdp')
    const isSdpByBody = answerSDP.trim().startsWith('v=')
    if (!(isSdpByHeader || isSdpByBody)) {
      let err: any = {}
      try { err = JSON.parse(answerSDP) } catch {}
      throw new Error(`Realtime SDP error: ${resp.status} ${resp.statusText} ${err?.error?.message ?? answerSDP}`)
    }

    await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSDP })

  }

  // 会話の締め（応答停止→接続終了）
  async stop() {
    this.opts.onState?.('ended')
    try {
      this.dc?.close()
      this.pc?.close()
      this.localStream?.getTracks().forEach(t => t.stop())
      if (this.audioEl) this.audioEl.srcObject = null
    } catch {}
  }

  // 最終的に「会話録JSON」を取得したい場合（任意）
  requestConversationLog() {
    this.send({
      type: 'response.create',
      response: {
        instructions:
          'これまでの会話の逐語録を、ユーザー発話/アシスタント発話の配列で返してください。JSONのみ出力。',
        modalities: ['text'],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'conversation_log',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                lang: { type: 'string', enum: ['ja'] },
                turns: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      role: { type: 'string', enum: ['user', 'assistant'] },
                      text: { type: 'string' },
                    },
                    required: ['role', 'text'],
                  },
                },
              },
              required: ['lang', 'turns'],
            },
            strict: true,
          },
        },
      },
    })
  }

  private send(obj: any) {
    if (!this.dc || this.dc.readyState !== 'open') {
      ;(this as any)._buffer = (this as any)._buffer || []
      ;(this as any)._buffer.push(obj)
      return
    }
    this.dc.send(JSON.stringify(obj))
  }

  // 受信イベントの超簡易ハンドラ
  private onMessage(ev: MessageEvent) {
    try {
      const msg = JSON.parse(ev.data)
      // 入力音声の文字起こし（ユーザーの発話）
      if (msg.type === 'input_audio_transcription.completed' && msg.transcript) {
        this.opts.onUserTranscript?.(msg.transcript)
      }

      // アシスタントのテキスト出力（逐次）
      if (msg.type === 'response.output_text.delta' && typeof msg.delta === 'string') {
        this.opts.onAssistantText?.(msg.delta, false)
      }
      if (msg.type === 'response.completed') {
        this.opts.onAssistantText?.('', true)
        this.opts.onState?.('recording') // 応答が終わったら次の発話へ
      }

      // 参考: 必要に応じて他のイベント型も拾う
      // console.log('oai event', msg)
    } catch {
      // 非JSONメッセージは無視
    }
  }
}