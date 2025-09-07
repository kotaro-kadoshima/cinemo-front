import { NextResponse } from 'next/server';

// Backend base URL: prefer API_BASE (server env), fallback to NEXT_PUBLIC_API_BASE, then local mock base
const API_BASE = process.env.API_BASE ?? process.env.NEXT_PUBLIC_API_BASE ?? 'http://127.0.0.1:3658/m1/1056062-1043685-default';

export async function POST(req: Request) {
  try {
    // Parse body exactly once
    const raw = (await req.json()) as unknown;
    if (raw === null || typeof raw !== 'object') {
      return NextResponse.json({ error: 'bad request', detail: 'invalid JSON body' }, { status: 400 });
    }

    // Narrowing with safe defaults
    type Incoming = { mood?: string; country?: string; genres?: unknown; limit?: unknown };
    const { mood, country, genres, limit } = raw as Incoming;

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

