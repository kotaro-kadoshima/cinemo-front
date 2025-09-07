import { NextResponse } from 'next/server';

// Backend base URL: prefer API_BASE (server env), fallback to NEXT_PUBLIC_API_BASE, then localhost:8080
const API_BASE = process.env.API_BASE ?? process.env.NEXT_PUBLIC_API_BASE ?? 'http://127.0.0.1:3658/m1/1056062-1043685-default';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[recommend route] API_BASE =', API_BASE);
    console.log('[recommend route] received body =', body);

    let { mood, country, genres, limit } = body ?? {};

    if (!mood || typeof mood !== 'string' || mood.trim() === '') {
      return NextResponse.json({ error: 'mood is required', received: body, apiBase: API_BASE }, { status: 400 });
    }

    const url = `${API_BASE}/recommend`;
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood, country, genres, limit }),
      cache: 'no-store',
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return NextResponse.json(
        { error: 'backend error', url, status: upstream.status, detail: text },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'fetch failed', detail: err?.message ?? String(err), apiBase: API_BASE, envNextPublic: process.env.NEXT_PUBLIC_API_BASE, envApiBase: process.env.API_BASE },
      { status: 400 }
    );
  }
}

