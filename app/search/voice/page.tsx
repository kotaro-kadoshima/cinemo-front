// app/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { RealtimeClient } from '@/lib/realtimeClient'

export default function Home() {
  const [state, setState] = useState<'idle'|'connecting'|'recording'|'thinking'|'ended'>('idle')
  const [userText, setUserText] = useState('')
  const [assistantText, setAssistantText] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const clientRef = useRef<RealtimeClient | null>(null)

  const client = useMemo(() => {
    const c = new RealtimeClient({
      onState: s => setState(s),
      onUserTranscript: t => setUserText(t),
      onAssistantText: (d, done) => {
        setAssistantText(prev => (done ? prev : prev + d))
        if (done) setAssistantText(prev => prev + '\n')
      },
      onLog: line => setLogs(prev => [...prev, line]),
    })
    clientRef.current = c
    return c
  }, [])

  useEffect(() => {
    return () => {
      clientRef.current?.stop()
    }
  }, [])

  const start = async () => {
    setAssistantText('') // 新しい応答を準備
    await client.start()
  }

  const stop = async () => {
    await client.stop()
  }

  return (
    <main className="min-h-dvh p-6 flex flex-col gap-4">
      <h1 className="text-2xl font-bold">OpenAI Realtime（音声）最小セット</h1>

      <div className="flex gap-3">
        <button
          className="rounded-lg px-4 py-2 bg-black text-white disabled:opacity-50"
          onClick={start}
          disabled={state === 'connecting' || state === 'recording'}
        >
          🎙️ 開始
        </button>
        <button
          className="rounded-lg px-4 py-2 border"
          onClick={stop}
        >
          ⏹ 停止
        </button>
        <span className="px-2 py-2 text-sm opacity-70">state: {state}</span>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3 border rounded-lg">
          <h2 className="font-semibold mb-2">ユーザー逐語録</h2>
          <pre className="whitespace-pre-wrap text-sm">{userText || '（あなたが話すとここに文字起こし）'}</pre>
        </div>
        <div className="p-3 border rounded-lg">
          <h2 className="font-semibold mb-2">アシスタント出力</h2>
          <pre className="whitespace-pre-wrap text-sm">{assistantText || '（モデルのテキスト出力）'}</pre>
        </div>
      </section>

      <details className="p-3 border rounded-lg">
        <summary className="cursor-pointer">デバッグログ</summary>
        <pre className="text-xs whitespace-pre-wrap">
{logs.map((l,i)=> `${i.toString().padStart(2,'0')}: ${l}`).join('\n')}
        </pre>
      </details>
    </main>
  )
}
