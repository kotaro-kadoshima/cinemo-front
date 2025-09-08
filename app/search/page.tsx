'use client';
import { useEffect, useState, type CSSProperties } from 'react';

/** 任意の速度でスクロール（CSS smooth より滑らかに） */
function smoothScrollTo(targetY: number, duration = 1200) {
  const startY = window.scrollY;
  const diff = targetY - startY;
  const start = performance.now();
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // easeInOutCubic
  function step(now: number) {
    const elapsed = now - start;
    const t = Math.min(1, elapsed / duration);
    window.scrollTo(0, startY + diff * ease(t));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/** 巨大カーテン・インタールード（ポスターと結果の間に挟む） */
function CurtainInterlude({
  onReveal,
  revealed,
}: {
  onReveal?: () => void;
  revealed?: boolean;
}) {
  const [phase, setPhase] = useState<'idle' | 'opening' | 'opened'>('idle');
  const [prefersReduced, setPrefersReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = () => setPrefersReduced(m.matches);
    listener();
    m.addEventListener?.('change', listener);
    return () => m.removeEventListener?.('change', listener);
  }, []);

  function openCurtain() {
    if (phase !== 'idle') return;
    setPhase('opening');
    const total = prefersReduced ? 400 : 1200;
    setTimeout(() => {
      setPhase('opened');
      onReveal?.();
      const el = document.getElementById('results');
      el?.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
    }, total);
  }

  // 背景のスポットライトとダストは inline style で再現（追加CSS不要）
  const bgStyle: CSSProperties = {
    backgroundImage: `
      radial-gradient(80% 50% at 50% 30%, rgba(255,255,255,0.16), rgba(255,255,255,0.02) 60%, transparent 70%),
      radial-gradient(60% 40% at 50% 70%, rgba(255,255,255,0.08), transparent 60%)
    `,
  };
  const dustStyle: CSSProperties = {
    backgroundImage:
      'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
    backgroundSize: '3px 3px, 2px 2px',
    backgroundPosition: '0 0, 1px 1px',
    opacity: 0.25,
  };
  const vignetteStyle: CSSProperties = {
    background: 'radial-gradient(120% 80% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)',
    opacity: 0.6,
  };
  const curtainStripe =
    'repeating-linear-gradient(90deg, rgba(185,28,28,0.95) 0 12px, rgba(127,19,19,0.95) 12px 24px)';

  return (
    <section className="relative my-24 overflow-hidden rounded-3xl shadow-[0_40px_160px_rgba(0,0,0,0.5)]" style={{ perspective: 1600 }}>
      <div className="relative min-h-[60vh] md:min-h-[70vh] bg-black">
        {/* 背景のスポットライトと粒子 */}
        <div className="absolute inset-0 pointer-events-none mix-blend-screen" style={bgStyle} />
        <div className="absolute inset-0 pointer-events-none" style={dustStyle} />

        {/* タイトル・コピー */}
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

          {/* 大きめの区切り（光のライン） */}
          <div className="mt-10 h-1 w-64 mx-auto bg-gradient-to-r from-transparent via-red-500 to-transparent rounded-full" />

          {/* 開幕ボタン（phase !== 'idle'時は不可視でスペース維持） */}
          <button
            onClick={openCurtain}
            aria-label="幕を開ける"
            className={`mt-10 inline-flex items-center gap-2 rounded-xl border border-white/50 bg-gradient-to-b from-white/10 to-black/60 px-6 py-3 text-sm md:text-base font-semibold text-white hover:text-white hover:border-white hover:shadow-[0_10px_30px_rgba(255,255,255,0.25)] transition ${phase !== 'idle' ? 'invisible pointer-events-none' : ''}`}
          >
            🎬 幕を開ける
          </button>
        </div>

        {/* ヴィネット */}
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={vignetteStyle} />

        {/* 左カーテン */}
        <div
          aria-hidden
          className="absolute top-[-6%] bottom-[-6%] left-[-3%] w-[58%] border-r border-white/10 will-change-transform will-change-filter"
          style={{
            backgroundImage: curtainStripe,
            boxShadow: 'inset 0 0 80px rgba(0,0,0,0.55), 0 0 120px rgba(255,0,0,0.18)',
            transition: prefersReduced
              ? 'transform 400ms ease-out, filter 400ms ease-out'
              : 'transform 1200ms cubic-bezier(.22,.61,.36,1), filter 1200ms cubic-bezier(.22,.61,.36,1)',
            transform:
              phase === 'idle'
                ? 'translateX(0) rotateY(0deg) skewY(0deg)'
                : phase === 'opening'
                ? 'translateX(-96%) rotateY(-22deg) skewY(-1.5deg)'
                : 'translateX(-120%) rotateY(-28deg) skewY(-2deg)',
            filter: phase === 'opening' ? 'saturate(1.1) brightness(1.05) blur(0.6px)' : 'none',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* 光のスイープ */}
          <div
            className="absolute inset-y-0 -left-1/3 w-1/3 pointer-events-none"
            style={{
              background:
                'linear-gradient(75deg, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.22) 40%, rgba(255,255,255,0.0) 80%)',
              transition: prefersReduced ? 'transform 400ms ease-out' : 'transform 900ms ease-out',
              transform: phase === 'opening' || phase === 'opened' ? 'translateX(220%)' : 'translateX(0%)',
              mixBlendMode: 'screen',
            }}
          />
        </div>

        {/* 右カーテン */}
        <div
          aria-hidden
          className="absolute top-[-6%] bottom-[-6%] right-[-3%] w-[58%] border-l border-white/10 will-change-transform will-change-filter"
          style={{
            backgroundImage: curtainStripe,
            boxShadow: 'inset 0 0 80px rgba(0,0,0,0.55), 0 0 120px rgba(255,0,0,0.18)',
            transition: prefersReduced
              ? 'transform 400ms ease-out, filter 400ms ease-out'
              : 'transform 1200ms cubic-bezier(.22,.61,.36,1), filter 1200ms cubic-bezier(.22,.61,.36,1)',
            transform:
              phase === 'idle'
                ? 'translateX(0) rotateY(0deg) skewY(0deg)'
                : phase === 'opening'
                ? 'translateX(96%) rotateY(22deg) skewY(1.5deg)'
                : 'translateX(120%) rotateY(28deg) skewY(2deg)',
            filter: phase === 'opening' ? 'saturate(1.1) brightness(1.05) blur(0.6px)' : 'none',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* 光のスイープ */}
          <div
            className="absolute inset-y-0 -right-1/3 w-1/3 pointer-events-none"
            style={{
              background:
                'linear-gradient(105deg, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.22) 40%, rgba(255,255,255,0.0) 80%)',
              transition: prefersReduced ? 'transform 400ms ease-out' : 'transform 900ms ease-out',
              transform: phase === 'opening' || phase === 'opened' ? 'translateX(-220%)' : 'translateX(0%)',
              mixBlendMode: 'screen',
            }}
          />
        </div>
      </div>
    </section>
  );
}

/** 背面から“拡大＋フェード”で登場させるラッパー */
function BackZoomReveal({ active, children }: { active: boolean; children: React.ReactNode }) {
  // active=true の瞬間に入場（scale 0.96 → 1, opacity 0 → 1）
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (active) requestAnimationFrame(() => setOn(true));
    else setOn(false);
  }, [active]);
  return (
    <div
      style={{
        transform: on ? 'scale(1)' : 'scale(0.96)',
        opacity: on ? 1 : 0,
        filter: on ? 'none' : 'blur(1px)',
        transition:
          'opacity 800ms cubic-bezier(.22,.61,.36,1), transform 800ms cubic-bezier(.22,.61,.36,1), filter 800ms cubic-bezier(.22,.61,.36,1)',
        willChange: 'transform, opacity, filter',
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
  phase: 'idle' | 'leaving' | 'gone';
  onReveal: () => void;
}) {
  if (phase === 'gone') return null;
  const leaving = phase === 'leaving';
  return (
    <section
      className="relative my-24 overflow-hidden rounded-3xl shadow-[0_40px_160px_rgba(0,0,0,0.5)]"
      style={{ perspective: 1600 }}
    >
      <div
        className="relative min-h-[46vh] md:min-h-[52vh] bg-black/60"
        style={{
          background:
            'radial-gradient(80% 50% at 50% 30%, rgba(255,255,255,0.14), rgba(255,255,255,0.02) 60%, transparent 70%), radial-gradient(60% 40% at 50% 70%, rgba(255,255,255,0.08), transparent 60%)',
          transition: 'opacity 600ms ease, transform 600ms ease, filter 600ms ease',
          opacity: leaving ? 0 : 1,
          transform: leaving ? 'translateY(-6px) scale(0.995)' : 'none',
          filter: leaving ? 'blur(2px)' : 'none',
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
            className="mt-8 inline-flex items-center gap-2 rounded-xl border border-white/40 bg-gradient-to-b from-white/10 to-black/60 px-6 py-3 text-sm md:text-base font-semibold text-white disabled:opacity-50 hover:text-white hover:border-white/70 hover:shadow-[0_10px_30px_rgba(255,255,255,0.25)] transition"
          >
            {loading ? '読み込み中…' : '表示する'}
          </button>

        </div>

        {/* ヴィネット */}
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(120% 80% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)',
        }} />
      </div>

    </section>
  );
}

type RecommendItem = {
  title: string | null;
  posterUrl: string | null;
  reason: string | null;
  tmdbId: number | null;
  duration: number | null;
  rating: number | null;
  genres: string[];
  emotionTags: string[];
  origin: string | null;
};
type RecommendResponse = { items: RecommendItem[] };

const EXAMPLES = [
  '上司に褒められて嬉しい一日だった',
  '恋人と喧嘩して気分が沈んでる',
  '仕事でくたくた。頭空っぽにしたい',
  '昔の友だちを思い出してノスタルジック',
  '大事な予定を忘れてしまい自己嫌悪',
  'プレゼンがうまくいって自信がついた'
];

const COUNTRY_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: 'japan', label: '邦画' },
  { value: 'korea', label: '韓国' },
  { value: 'india', label: 'インド' },
  { value: 'other', label: 'その他洋画' },
] as const;

const GENRE_OPTIONS = [
  'アクション',
  'アドベンチャー',
  'アニメーション',
  'コメディ',
  'サイエンスフィクション',
  'スリラー',
  'テレビ映画',
  'ドキュメンタリー',
  'ドラマ',
  'ファミリー',
  'ファンタジー',
  'ホラー',
  'ロマンス',
  '履歴',
  '戦争',
  '犯罪',
  '西洋',
  '謎',
  '音楽',
] as const;

export default function Page() {
  const [text, setText] = useState('');
  const [posterText, setPosterText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RecommendItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false); // 幕が開いたら true
  const [formPhase, setFormPhase] = useState<'shown' | 'collapsing' | 'hidden'>('shown');
  const [resultsPhase, setResultsPhase] = useState<'shown' | 'collapsing' | 'hidden'>('hidden');
  const [overlayPhase, setOverlayPhase] = useState<'idle' | 'leaving' | 'gone'>('idle');

  // NEW: フィルタ
  const [country, setCountry] = useState<string>(''); // '', 'japan', 'korea', 'india', 'other'
  const [genres, setGenres] = useState<string[]>([]);
  const [limit] = useState<number>(3);

  // 結果が用意できて、オーバーレイが完全に消えたら自動スクロール（位置ズレ防止）
  useEffect(() => {
    if (!(results && !loading && overlayPhase === 'gone')) return;

    const container = document.getElementById('results');
    const firstCard = container?.querySelector('article') as HTMLElement | null;
    const target = firstCard ?? container;
    if (!target) return;

    const OFFSET = 96; // 上端から少し下げる
    const scrollToTargetTop = () => {
      const rect = target.getBoundingClientRect();
      const top = window.scrollY + rect.top - OFFSET;
      smoothScrollTo(top, 1200);
    };

    // オーバーレイ退場直後のリフローに合わせて2段階で実行
    const t0 = setTimeout(scrollToTargetTop, 20);   // 直後
    const t1 = setTimeout(scrollToTargetTop, 740);  // 退場アニメ（700ms）後の再調整

    // 画像ロード後の高さズレ対策：結果内の画像がロードされたら再スクロール
    const imgs = Array.from(container?.querySelectorAll('img') ?? []);
    const pending = imgs.filter((img) => !img.complete);
    const handlers: Array<() => void> = [];

    if (pending.length > 0) {
      pending.forEach((img) => {
        const onLoad = () => {
          scrollToTargetTop();
        };
        img.addEventListener('load', onLoad, { once: true });
        handlers.push(() => img.removeEventListener('load', onLoad));
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
      requestAnimationFrame(() => setResultsPhase('shown'));
    } else {
      setResultsPhase('hidden');
    }
  }, [results, loading, revealed]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResults(null);
    setRevealed(false); // 新しい検索では再び幕が閉じた状態に戻す

    const mood = text.trim();
    if (!mood) {
      setError('今日の出来事や気分を入力してください。');
      return;
    }

    // ① 入力テキストをそのまま「ポスターのタイトル」にする
    setPosterText(mood);
    setOverlayPhase('idle');
    // 入力ブロックを高級感のあるアニメーションで消す（フェード＋少し縮小＋ブラー→高さを畳む）
    setFormPhase('collapsing');
    setTimeout(() => setFormPhase('hidden'), 800); // アニメーション後に実際に非表示化

    // ② レコメンド取得（フィルタ同梱）
    setLoading(true);
    try {
      const r = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood, country, genres, limit }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: RecommendResponse = await r.json();
      setResults(Array.isArray(data.items) ? data.items : []);
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : '取得に失敗しました。少し時間をおいて再実行してください。';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function onResetSearch() {
    // 結果ブロックを高級感アニメで隠す
    setResultsPhase('collapsing');
    setTimeout(() => {
      // 結果とポスターを消し、フォームを再表示
      setResults(null);
      setPosterText(null);
      setRevealed(false);
      setFormPhase('shown');
      setOverlayPhase('idle');
      // 上部へスムーススクロール
      smoothScrollTo(0, 900);
    }, 800);
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      {/* ヘッダ */}
      <section className="text-center">
<section className="text-center">
  <h1
    className="text-3xl md:text-4xl font-extrabold inline-flex items-center justify-center gap-2"

  >
    <span aria-hidden className="text-2xl md:text-3xl">🎬</span>
    シネモ
    <span aria-hidden className="text-2xl md:text-3xl">🎥</span>
  </h1>
  <p className="mt-2 text-gray-400">心が求める映画を</p>

</section>
      </section>

      {/* 入力カード */}
      <section
        className="mt-8"
        aria-hidden={formPhase !== 'shown'}
        style={{
          transition:
            'opacity 700ms cubic-bezier(.22,.61,.36,1), transform 700ms cubic-bezier(.22,.61,.36,1), filter 700ms cubic-bezier(.22,.61,.36,1), max-height 800ms cubic-bezier(.22,.61,.36,1)',
          opacity: formPhase === 'shown' ? 1 : 0,
          transform: formPhase === 'shown' ? 'translateY(0) scale(1)' : 'translateY(-12px) scale(0.98)',
          filter: formPhase === 'shown' ? 'none' : 'blur(3px)',
          maxHeight: formPhase === 'hidden' ? 0 : 2000,
          overflow: 'hidden',
          pointerEvents: formPhase === 'shown' ? 'auto' : 'none',
        }}
      >
        
<form
  onSubmit={onSubmit}
  className="mx-auto w-full max-w-3xl rounded-2xl border border-white/10 bg-black/50 backdrop-blur-sm p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
  aria-busy={loading}
>
  <div className="flex flex-col items-center text-center mb-4">
    <h1
      className="text-3xl"
    >
      今日はどんな一日だった？
    </h1>
    <p className="mt-2 text-gray-300">日記みたいに気持ちを書いてください。<br className="hidden md:inline" />映画でお返事します。</p>
    <div
      aria-hidden
      className="mx-auto mt-3 h-1 w-24 "
    />
  </div>

          <label htmlFor="mood" className="block text-sm text-gray-400 mb-2">
            今日の出来事や気分（自由に）
          </label>

          <div className="rounded-xl border border-white/15 bg-[#0F172A]/60 p-2">
            <textarea
              id="mood"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`例：上司に褒められて嬉しかった。\n例：恋人と喧嘩して心がざわざわしてる。\n例：仕事でくたびれて何も考えたくない。`}
              className="w-full resize-none rounded-lg bg-[#111827] text-white/90 px-4 py-3 outline-none placeholder:text-gray-500 focus:ring-2 focus:ring-red-500/60"
            />
          </div>

          {/* 例文チップ */}
          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setText(ex)}
                className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs text-gray-300 hover:border-red-500 hover:text-white transition"
                aria-label={`例文: ${ex}`}
              >
                {ex}
              </button>
            ))}
          </div>


          {/* 送信ボタン */}
          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/80 px-5 py-3 text-sm font-semibold text-red-400 hover:text-white hover:bg-red-500/90 disabled:opacity-50 transition"
            >
              この気持ちに合う映画を教えて
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-3 rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            >
              {error}
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
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" aria-hidden />
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
            setOverlayPhase('leaving');
            // 少し遅らせて完全非表示
            setTimeout(() => setOverlayPhase('gone'), 700);
            setRevealed(true);
          }}
        />
      )}

      {results && !loading && (
        <BackZoomReveal active={overlayPhase === 'leaving' || overlayPhase === 'gone'}>
          <>
            <section
              id="results"
              className="mt-10 max-w-6xl mx-auto pb-40 md:pb-64"
              aria-hidden={resultsPhase !== 'shown'}
              style={{
                transition:
                  'opacity 700ms cubic-bezier(.22,.61,.36,1), transform 700ms cubic-bezier(.22,.61,.36,1), filter 700ms cubic-bezier(.22,.61,.36,1), max-height 800ms cubic-bezier(.22,.61,.36,1)',
                opacity: resultsPhase === 'shown' ? 1 : 0,
                transform: resultsPhase === 'shown' ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.98)',
                filter: resultsPhase === 'shown' ? 'none' : 'blur(3px)',
                maxHeight: resultsPhase === 'hidden' ? 0 : 4000,
                overflow: 'hidden',
                pointerEvents: resultsPhase === 'shown' ? 'auto' : 'none',
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {results.map((m, i) => (
                  <article key={m.tmdbId ?? `${m.title ?? 'item'}-${i}`} className="rounded-xl border border-white/10 bg-gray-900 p-3">
                    {m.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.posterUrl}
                        alt={`${m.title ?? ''}のポスター`}
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
                  </article>
                ))}
              </div>

              {/* 再検索ボタン */}
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={onResetSearch}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/50 bg-black/60 px-6 py-3 text-sm md:text-base font-semibold text-white hover:text-white hover:border-white hover:bg-black/80 hover:shadow-[0_0_15px_rgba(255,255,255,0.8)] transition"
                >
                  もう一度探す
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