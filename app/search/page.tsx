"use client";
import {
  useEffect,
  useState,
  Suspense,
  useRef,
  useCallback,
  useMemo,
} from "react";
import Image from "next/image";
import { StreamingLinks } from "@/components/streaming-links";
import { useSearchParams } from "next/navigation";
import { CinemoStage, type CinemoMood } from "@/components/cinemo/cinemo-stage";
import type { RecommendItem, RecommendResponse } from "@/lib/recommend-types";

/** 任意の速度でスクロール（CSS smooth より滑らかに） */
function smoothScrollTo(targetY: number, duration = 1200) {
  const startY = window.scrollY;
  const diff = targetY - startY;
  const start = performance.now();
  const ease = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
  function step(now: number) {
    const elapsed = now - start;
    const t = Math.min(1, elapsed / duration);
    window.scrollTo(0, startY + diff * ease(t));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}


/** 背面から“拡大＋フェード”で登場させるラッパー */
function BackZoomReveal({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  // active=true の瞬間に入場（scale 0.96 → 1, opacity 0 → 1）
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (active) requestAnimationFrame(() => setOn(true));
    else setOn(false);
  }, [active]);
  return (
    <div
      style={{
        transform: on ? "scale(1)" : "scale(0.96)",
        opacity: on ? 1 : 0,
        filter: on ? "none" : "blur(1px)",
        transition:
          "opacity 800ms cubic-bezier(.22,.61,.36,1), transform 800ms cubic-bezier(.22,.61,.36,1), filter 800ms cubic-bezier(.22,.61,.36,1)",
        willChange: "transform, opacity, filter",
      }}
    >
      {children}
    </div>
  );
}

/** 見出し＋ボタンのオーバーレイ。ロード中は上品なプログレス演出を表示 */
function HeroOverlay({
  loading,
  phase,
  onReveal,
}: {
  loading: boolean;
  phase: "idle" | "leaving" | "gone";
  onReveal: () => void;
}) {
  if (phase === "gone") return null;
  const leaving = phase === "leaving";
  return (
    <section
      className="relative my-24 overflow-hidden rounded-3xl shadow-[0_40px_160px_rgba(0,0,0,0.5)]"
      style={{ perspective: 1600 }}
    >
      <div
        className="relative min-h-[46vh] md:min-h-[52vh] bg-black/60"
        style={{
          background:
            "radial-gradient(80% 50% at 50% 30%, rgba(255,255,255,0.14), rgba(255,255,255,0.02) 60%, transparent 70%), radial-gradient(60% 40% at 50% 70%, rgba(255,255,255,0.08), transparent 60%)",
          transition:
            "opacity 600ms ease, transform 600ms ease, filter 600ms ease",
          opacity: leaving ? 0 : 1,
          transform: leaving ? "translateY(-6px) scale(0.995)" : "none",
          filter: leaving ? "blur(2px)" : "none",
        }}
      >
        {/* タイトル・コピー・ボタン */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center text-center px-6">
          <div className="text-[10px] md:text-xs tracking-[0.35em] text-gray-400 uppercase">
            Feature Presentation
          </div>
          <h2 className="mt-2 text-3xl md:text-5xl font-extrabold tracking-widest uppercase drop-shadow">
            Now Showing For You
          </h2>
          <p className="mt-3 text-sm md:text-base text-gray-300">
            いまの気持ちに寄り添う3本をセレクトしました
          </p>

          {/* 仕切りライン */}
          <div className="mt-8 h-1 w-56 md:w-72 mx-auto bg-gradient-to-r from-transparent via-white/60 to-transparent rounded-full" />

          {/* ボタン（ロード完了で有効化） */}
          <button
            onClick={onReveal}
            disabled={loading}
            aria-label="表示する"
            className="mt-8 inline-flex items-center gap-3 rounded-xl border border-white/40 bg-gradient-to-b from-white/10 to-black/60 px-6 py-3 text-sm md:text-base font-semibold text-white disabled:opacity-50 hover:text-white hover:border-white/70 hover:shadow-[0_10px_30px_rgba(255,255,255,0.25)] transition"
          >
            {loading ? (
              <>
                <div className="relative">
                  <div className="animate-spin w-5 h-5 border-2 border-white/50 border-t-white rounded-full"></div>
                  <div className="absolute inset-0 animate-pulse w-5 h-5 bg-white/10 rounded-full"></div>
                </div>
                <span className="animate-pulse">
                  映画を選んでいます
                  <span className="inline-block animate-bounce ml-0.5">.</span>
                  <span
                    className="inline-block animate-bounce ml-0.5"
                    style={{ animationDelay: "0.15s" }}
                  >
                    .
                  </span>
                  <span
                    className="inline-block animate-bounce ml-0.5"
                    style={{ animationDelay: "0.3s" }}
                  >
                    .
                  </span>
                </span>
              </>
            ) : (
              "表示する"
            )}
          </button>
        </div>

        {/* ヴィネット */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
          }}
        />
      </div>
    </section>
  );
}

const EXAMPLES = [
  "上司に褒められて嬉しい一日だった",
  "恋人と喧嘩して気分が沈んでる",
  "仕事でくたくた。頭空っぽにしたい",
  "昔の友だちを思い出してノスタルジック",
  "大事な予定を忘れてしまい自己嫌悪",
  "プレゼンがうまくいって自信がついた",
];


function SearchPageContent() {
  const [text, setText] = useState("");
  const [posterText, setPosterText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RecommendItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false); // 幕が開いたら true
  const [formPhase, setFormPhase] = useState<"shown" | "collapsing" | "hidden">(
    "shown"
  );
  const [resultsPhase, setResultsPhase] = useState<
    "shown" | "collapsing" | "hidden"
  >("hidden");
  const [overlayPhase, setOverlayPhase] = useState<"idle" | "leaving" | "gone">(
    "idle"
  );
  const formHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchParams = useSearchParams();
  const showStreaming = searchParams.get("streaming") === "true";

  // フィルタ設定
  const country = "";
  const genres = useMemo(() => [], []);
  const limit = 3;

  // 結果が用意できて、オーバーレイが完全に消えたら自動スクロール（位置ズレ防止）
  useEffect(() => {
    if (!(results && !loading && overlayPhase === "gone")) return;

    const container = document.getElementById("results");
    const firstCard = container?.querySelector("article") as HTMLElement | null;
    const target = firstCard ?? container;
    if (!target) return;

    const OFFSET = 96; // 上端から少し下げる
    const scrollToTargetTop = () => {
      const rect = target.getBoundingClientRect();
      const top = window.scrollY + rect.top - OFFSET;
      smoothScrollTo(top, 1200);
    };

    // オーバーレイ退場直後のリフローに合わせて2段階で実行
    const t0 = setTimeout(scrollToTargetTop, 20); // 直後
    const t1 = setTimeout(scrollToTargetTop, 740); // 退場アニメ（700ms）後の再調整

    // 画像ロード後の高さズレ対策：結果内の画像がロードされたら再スクロール
    const imgs = Array.from(container?.querySelectorAll("img") ?? []);
    const pending = imgs.filter((img) => !img.complete);
    const handlers: Array<() => void> = [];

    if (pending.length > 0) {
      pending.forEach((img) => {
        const onLoad = () => {
          scrollToTargetTop();
        };
        img.addEventListener("load", onLoad, { once: true });
        handlers.push(() => img.removeEventListener("load", onLoad));
      });

      const t2 = setTimeout(scrollToTargetTop, 200);
      const t3 = setTimeout(scrollToTargetTop, 1000);
      handlers.push(() => clearTimeout(t2));
      handlers.push(() => clearTimeout(t3));
    }

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      handlers.forEach((fn) => fn());
    };
  }, [results, loading, overlayPhase]);

  // 結果アニメーション制御
  useEffect(() => {
    if (results && !loading && revealed) {
      // 次フレームで表示フェーズにし、ふわっと入れる
      requestAnimationFrame(() => setResultsPhase("shown"));
    } else {
      setResultsPhase("hidden");
    }
  }, [results, loading, revealed]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const mood = text.trim();
    if (!mood) {
      setError("今日の出来事や気分を入力してください。");
      return;
    }

    await handleMovieSearch(mood);
  }

  function onResetSearch() {
    // 結果ブロックを高級感アニメで隠す
    setResultsPhase("collapsing");
    setTimeout(() => {
      // 結果とポスターを消し、フォームを再表示
      setResults(null);
      setPosterText(null);
      setRevealed(false);
      setFormPhase("shown");
      setOverlayPhase("idle");
      // 上部へスムーススクロール
      smoothScrollTo(0, 900);
    }, 800);
  }

  // 映画検索を実行する関数
  const handleMovieSearch = useCallback(async (mood: string) => {
    setError(null);
    setResults(null);
    setRevealed(false);

    // ① 入力テキストをそのまま「ポスターのタイトル」にする
    setPosterText(mood);
    setOverlayPhase("idle");
    // 入力ブロックを高級感のあるアニメーションで消す
    setFormPhase("collapsing");
    if (formHideTimer.current) clearTimeout(formHideTimer.current);
    formHideTimer.current = setTimeout(() => setFormPhase("hidden"), 800);
    // 待っている間、踊っているシネモが見えるように上へ戻す
    smoothScrollTo(0, 700);

    // ② レコメンド取得（フィルタ同梱）
    setLoading(true);
    try {
      const r = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood, country, genres, limit }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: RecommendResponse = await r.json();
      setResults(Array.isArray(data.items) ? data.items : []);
    } catch (e: unknown) {
      const detail = e instanceof Error ? `（${e.message}）` : "";
      // フォームを戻さないと、エラー表示が隠れたまま「映画を選んでいます…」が回り続けてしまう
      if (formHideTimer.current) clearTimeout(formHideTimer.current);
      setPosterText(null);
      setFormPhase("shown");
      setError(
        `映画を見つけられませんでした${detail}。少し時間をおいてもう一度お試しください。`
      );
    } finally {
      setLoading(false);
    }
  }, [country, genres, limit]);

  // シネモの気分：待ち時間は踊る、結果が出たら喜ぶ
  const cinemoMood: CinemoMood = loading
    ? "dancing"
    : error
      ? "sad"
      : results && results.length > 0 && overlayPhase === "idle"
        ? "happy"
        : "idle";

  const cinemoMessage = (() => {
    switch (cinemoMood) {
      case "dancing":
        return "踊りながら映画を選んでるよ♪ ちょっと待っててね";
      case "sad":
        return "うまくいかなかったみたい…もう一度ためしてみて";
      case "happy":
        return "見つかったよ！下の「表示する」を押してね";
      default:
        if (results) return "気になる映画は見つかった？";
        return "やあ、シネモだよ！今日のこと、聞かせてね♪";
    }
  })();

  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      {/* ヘッダ */}
      <section className="text-center">
        <section className="text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold inline-flex items-center justify-center gap-2">
            <span aria-hidden className="text-2xl md:text-3xl">
              🎬
            </span>
            シネモ
            <span aria-hidden className="text-2xl md:text-3xl">
              🎥
            </span>
          </h1>
          <p className="mt-2 text-gray-400">心が求める映画を</p>
        </section>
      </section>

      {/* 3D のシネモ（待ち時間は踊って待つ） */}
      <CinemoStage
        className="mt-2"
        mood={cinemoMood}
        message={cinemoMessage}
      />

      {/* 入力カード */}
      <section
        className="mt-8"
        aria-hidden={formPhase !== "shown"}
        style={{
          transition:
            "opacity 700ms cubic-bezier(.22,.61,.36,1), transform 700ms cubic-bezier(.22,.61,.36,1), filter 700ms cubic-bezier(.22,.61,.36,1), max-height 800ms cubic-bezier(.22,.61,.36,1)",
          opacity: formPhase === "shown" ? 1 : 0,
          transform:
            formPhase === "shown"
              ? "translateY(0) scale(1)"
              : "translateY(-12px) scale(0.98)",
          filter: formPhase === "shown" ? "none" : "blur(3px)",
          maxHeight: formPhase === "hidden" ? 0 : 2000,
          overflow: "hidden",
          pointerEvents: formPhase === "shown" ? "auto" : "none",
        }}
      >
        <form
          onSubmit={onSubmit}
          className="mx-auto w-full max-w-3xl rounded-2xl border border-white/10 bg-black/50 backdrop-blur-sm p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
          aria-busy={loading}
        >
          <div className="flex flex-col items-center text-center mb-4">
            <h1 className="text-3xl">今日はどんな一日だった？</h1>
            <p className="mt-2 text-gray-300">
              日記みたいに気持ちを書いてください。
              <br className="hidden md:inline" />
              映画でお返事します。
            </p>
            <div aria-hidden className="mx-auto mt-3 h-1 w-24 " />
          </div>

          {/* テキスト入力 */}
          <div className="space-y-4">
            <label htmlFor="mood" className="block text-sm text-gray-400">
              今日の出来事や気分（自由に）
            </label>

            <div className="rounded-xl border border-white/15 bg-[#0F172A]/60 p-2">
              <textarea
                id="mood"
                rows={5}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={`例：上司に褒められて嬉しかった。\n例：恋人と喧嘩して心がざわざわしてる。\n例：仕事でくたびれて何も考えたくない。`}
                className="w-full resize-none rounded-lg bg-[#111827] text-white/90 px-4 py-3 outline-none placeholder:text-gray-500 focus:ring-2 focus:ring-red-500/60"
              />
            </div>

            {/* 例文チップ */}
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setText(ex)}
                  className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs text-gray-300 hover:border-red-500 hover:text-white transition-all duration-200 hover:scale-105"
                  aria-label={`例文: ${ex}`}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* 送信ボタン */}
          <div className="mt-6 flex justify-center">
            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="group relative inline-flex items-center gap-3 rounded-2xl border border-red-500/60 bg-gradient-to-r from-red-600/20 to-red-500/20 px-8 py-4 text-base font-semibold text-red-400 hover:text-white hover:border-red-400 hover:from-red-600/40 hover:to-red-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-red-500/20"
            >
              <span className="text-xl">🎬</span>
              <span>この気持ちに合う映画を教えて</span>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-red-600/0 to-red-500/0 group-hover:from-red-600/10 group-hover:to-red-500/10 transition-all duration-300" />
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-400/50 bg-gradient-to-r from-red-500/10 to-red-600/10 px-4 py-3 text-sm text-red-200 backdrop-blur-sm shadow-lg flex items-center gap-3"
            >
              <span className="text-lg">⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </form>
      </section>

      {/* ③ 今日の気持ちポスター */}
      {posterText && (
        <section className="mt-12 mx-auto w-full max-w-3xl">
          <div
            className="relative aspect-[3/4] rounded-3xl border-4 border-red-600 bg-gradient-to-b from-[#141414] to-[#000] shadow-[0_0_40px_rgba(255,0,0,0.35)] overflow-hidden"
            aria-label="今日の気持ちポスター"
          >
            {/* うっすら光沢 */}
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent"
              aria-hidden
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-widest uppercase drop-shadow">
                {posterText}
              </h2>
              <p className="mt-3 text-[10px] md:text-xs tracking-[0.25em] text-gray-300 uppercase">
                — A Movie-Recommend Production —
              </p>
            </div>
          </div>
        </section>
      )}

      {/* オーバーレイ（文字＋ボタン）は常に前面。結果は背後で待機し、ボタン押下で上品に入場 */}
      {posterText && (
        <HeroOverlay
          loading={loading || !results}
          phase={overlayPhase}
          onReveal={() => {
            if (loading || !results) return; // まだロード中
            setOverlayPhase("leaving");
            // 少し遅らせて完全非表示
            setTimeout(() => setOverlayPhase("gone"), 700);
            setRevealed(true);
          }}
        />
      )}

      {results && !loading && (
        <BackZoomReveal
          active={overlayPhase === "leaving" || overlayPhase === "gone"}
        >
          <>
            <section
              id="results"
              className="mt-10 max-w-6xl mx-auto pb-40 md:pb-64"
              aria-hidden={resultsPhase !== "shown"}
              style={{
                transition:
                  "opacity 700ms cubic-bezier(.22,.61,.36,1), transform 700ms cubic-bezier(.22,.61,.36,1), filter 700ms cubic-bezier(.22,.61,.36,1), max-height 800ms cubic-bezier(.22,.61,.36,1)",
                opacity: resultsPhase === "shown" ? 1 : 0,
                transform:
                  resultsPhase === "shown"
                    ? "translateY(0) scale(1)"
                    : "translateY(12px) scale(0.98)",
                filter: resultsPhase === "shown" ? "none" : "blur(3px)",
                maxHeight: resultsPhase === "hidden" ? 0 : 4000,
                overflow: "hidden",
                pointerEvents: resultsPhase === "shown" ? "auto" : "none",
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {results.map((m, i) => (
                  <article
                    key={`movie-${i}-${m.tmdbId ?? m.title ?? "item"}`}
                    className="rounded-xl border border-white/10 bg-gray-900 p-3"
                  >
                    {m.posterUrl ? (
                      <Image
                        src={m.posterUrl}
                        alt={`${m.title ?? ""}のポスター`}
                        width={300}
                        height={450}
                        className="w-full aspect-[2/3] rounded-md object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] rounded-md bg-gray-800 grid place-items-center text-gray-400">
                        No Image
                      </div>
                    )}
                    <h2 className="mt-3 font-semibold">{m.title}</h2>
                    <div className="mt-1 text-xs text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
                      {m.rating != null && <span>★ {m.rating.toFixed(1)}</span>}
                      {m.duration != null && <span>{m.duration} min</span>}
                      {m.origin && <span>lang: {m.origin}</span>}
                    </div>
                    <p className="text-sm text-gray-300 mt-1">{m.reason}</p>
                    {showStreaming && <StreamingLinks tmdbId={m.tmdbId} />}
                  </article>
                ))}
              </div>

              {/* 再検索ボタン */}
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={onResetSearch}
                  className="group relative inline-flex items-center gap-3 rounded-2xl border border-white/40 bg-gradient-to-r from-gray-800/60 to-gray-700/60 px-8 py-4 text-base font-semibold text-white hover:border-white/70 hover:from-gray-700/80 hover:to-gray-600/80 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-white/10 backdrop-blur-sm"
                >
                  <span>もう一度探す</span>
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/0 to-white/0 group-hover:from-white/5 group-hover:to-white/5 transition-all duration-300" />
                </button>
              </div>
            </section>
            <div aria-hidden className="h-[30vh]" />
          </>
        </BackZoomReveal>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black text-white px-6 py-12 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border border-gray-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">読み込み中...</p>
          </div>
        </main>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
