import { NextResponse } from "next/server";
import { fetchStreamingLinks, STREAMING_CACHE_SECONDS } from "@/lib/server/streaming";
import type { StreamingResponse } from "@/lib/streaming";

/** 映画（TMDB の ID）を日本で観られる配信サービスを返す */
export async function GET(_req: Request, { params }: { params: Promise<{ tmdbId: string }> }) {
  const { tmdbId } = await params;
  const id = Number(tmdbId);
  if (!/^\d+$/.test(tmdbId) || !Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: "bad request", detail: "invalid tmdbId" }, { status: 400 });
  }

  try {
    const services = await fetchStreamingLinks(id);
    if (services) {
      return NextResponse.json<StreamingResponse>(
        { status: "ok", services },
        {
          // 成功した結果は CDN にキャッシュして、RapidAPI の利用回数を抑える
          headers: {
            "Cache-Control": `public, s-maxage=${STREAMING_CACHE_SECONDS}, stale-while-revalidate=${STREAMING_CACHE_SECONDS * 7}`,
          },
        },
      );
    }
  } catch (e: unknown) {
    console.warn("[streaming] failed:", e instanceof Error ? e.message : e);
  }

  // キー未設定や API の失敗。キーを設定したらすぐ表示されるよう、キャッシュしない
  return NextResponse.json<StreamingResponse>(
    { status: "unavailable" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
