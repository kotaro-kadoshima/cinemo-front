import { NextResponse } from 'next/server';

// Backend base URL: prefer API_BASE (server env), fallback to NEXT_PUBLIC_API_BASE, then local mock base
const API_BASE = process.env.API_BASE ?? process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8080/cinemo';

export async function POST(req: Request) {
  try {
    // Parse body exactly once
    const raw = (await req.json()) as unknown;
    if (raw === null || typeof raw !== 'object') {
      return NextResponse.json({ error: 'bad request', detail: 'invalid JSON body' }, { status: 400 });
    }

    // Narrowing with safe defaults
    type Incoming = { 
      mood?: string; 
      country?: string; 
      genres?: unknown; 
      limit?: unknown;
      mode?: string;
      conversation?: string;
      prompt?: string;
    };
    const { mood, country, genres, limit, mode, conversation, prompt } = raw as Incoming;

    // サマリーモードの場合
    if (mode === 'summarize') {
      if (typeof conversation !== 'string' || conversation.trim() === '') {
        return NextResponse.json({ error: 'bad request', detail: 'conversation is required for summarize mode' }, { status: 400 });
      }

      try {
        // OpenAI APIを使って会話をサマリー
        const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: prompt || 'この会話から、ユーザーの今日の気分や感情、体験した出来事を簡潔にまとめて。 例）あなたは、〜'
              },
              {
                role: 'user',
                content: conversation
              }
            ],
            max_tokens: 200,
            temperature: 0.3,
          }),
        });

        if (!summaryResponse.ok) {
          throw new Error(`OpenAI API error: ${summaryResponse.status}`);
        }

        const summaryData = await summaryResponse.json();
        const summary = summaryData.choices?.[0]?.message?.content || conversation;

        return NextResponse.json({ summary }, { status: 200 });
      } catch (error) {
        console.error('Summarization error:', error);
        // エラーの場合は元の会話を返す
        return NextResponse.json({ summary: conversation }, { status: 200 });
      }
    }

    // 通常の映画レコメンドモード
    if (typeof mood !== 'string' || mood.trim() === '') {
      return NextResponse.json({ error: 'bad request', detail: 'mood is required' }, { status: 400 });
    }

    const payload = {
      mood: mood.trim(),
      country: typeof country === 'string' ? country : '',
      genres: Array.isArray(genres) ? (genres as unknown[]).filter((x): x is string => typeof x === 'string') : [],
      limit: Number.isFinite(Number(limit)) ? Number(limit) : 3,
    } as const;

    const url = `${API_BASE}/recommend`;
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      return NextResponse.json(
        { error: 'backend error', status: upstream.status, detail },
        { status: upstream.status || 502 }
      );
    }

    const data = (await upstream.json()) as unknown;
    return NextResponse.json(data, { status: 200 });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: 'fetch failed', detail }, { status: 400 });
  }
}

