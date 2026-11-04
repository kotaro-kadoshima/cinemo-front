import { NextResponse } from "next/server";
import { recommend } from "@/lib/server/recommend";

// AI を2回続けて呼ぶので、Vercel の関数の実行時間を明示しておく
export const maxDuration = 60;

/** 気分の文章の上限（公開 API なので、極端に長い入力で費用がかさまないようにする） */
const MAX_MOOD_LENGTH = 2000;

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request", detail: "invalid JSON body" }, { status: 400 });
  }
  if (raw === null || typeof raw !== "object") {
    return NextResponse.json({ error: "bad request", detail: "invalid JSON body" }, { status: 400 });
  }

  // country / genres / limit も受け取るが、旧 API と同じく検索にはまだ使っていない
  const { mood } = raw as { mood?: unknown };
  if (typeof mood !== "string" || mood.trim() === "") {
    return NextResponse.json({ error: "bad request", detail: "mood is required" }, { status: 400 });
  }
  if (mood.length > MAX_MOOD_LENGTH) {
    return NextResponse.json(
      { error: "bad request", detail: `mood must be ${MAX_MOOD_LENGTH} characters or less` },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await recommend(mood.trim()));
  } catch (e: unknown) {
    console.error("[recommend] failed:", e);
    return NextResponse.json(
      { error: "recommend failed", detail: "映画の推薦に失敗しました" },
      { status: 502 },
    );
  }
}
