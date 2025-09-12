// app/api/realtime/session/route.ts
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime'
  const voice = process.env.OPENAI_REALTIME_VOICE || 'alloy'

  if (!apiKey) {
    return new Response('Missing OPENAI_API_KEY', { status: 500 })
  }

  // OpenAI Realtime セッション（短命トークン）作成
  const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'realtime=v1',
    },
    body: JSON.stringify({
      model,
      voice,                 // ここで既定ボイスも付けておく
      modalities: ['text','audio'],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    return new Response(`Failed to create session: ${res.status} ${res.statusText}\n${text}`, { status: 500 })
  }

  const json = await res.json()

  // クライアントで使いやすい形に正規化
  // OpenAI は { client_secret: { value } } で返すので token に詰め替える
  const token =
    json?.client_secret?.value ??
    json?.client_secret ??
    json?.value ??
    json?.token

  if (!token) {
    return new Response(`Unexpected session response:\n${JSON.stringify(json, null, 2)}`, { status: 500 })
  }

  return Response.json({ token })
}
