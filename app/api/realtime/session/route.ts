import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs' // 追加

export async function POST() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not set on the server' },
        { status: 500 }
      )
    }

    const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'realtime=v1',
      },
      body: JSON.stringify({
        model: 'gpt-realtime',
        modalities: ['audio', 'text'],
        turn_detection: { type: 'server_vad' },
        voice: 'alloy',
        input_audio_transcription: { model: 'whisper-1' },
      }),
    })

    if (!r.ok) {
      const msg = await r.text()
      return NextResponse.json(
        { error: 'OpenAI /realtime/sessions failed', detail: msg },
        { status: r.status }
      )
    }

    const session = await r.json()
    const token = session?.client_secret?.value
    if (!token) {
      return NextResponse.json({ error: 'Missing client_secret in OpenAI response', detail: session }, { status: 502 })
    }
    return NextResponse.json({ token }, { headers: { 'Cache-Control': 'no-store' } })

    return NextResponse.json(
      { token },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown' }, { status: 500 })
  }
}
