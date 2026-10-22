"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import {
  Component,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { CinemoLiveInput, CinemoMood } from "./types";

export type { CinemoMood } from "./types";

// three.js は重いので、ページ表示後に読み込む（SSR しない）
const CinemoScene = dynamic(() => import("./cinemo-scene"), {
  ssr: false,
  loading: () => null,
});

type Props = {
  mood: CinemoMood;
  /** 吹き出しのセリフ */
  message?: string;
  /** シネモの声の音量（RMS, だいたい 0..0.3） */
  speakingVolume?: number;
  /** マイクの音量（RMS, だいたい 0..0.3） */
  listeningVolume?: number;
  className?: string;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** RMS 音量を 0..1 に */
const normalizeVolume = (v: number) => clamp(v * 4, 0, 1);

function hasWebGL2() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

/** WebGL が途中で失敗しても、ページ全体を壊さずに 2D 表示へ切り替える */
class SceneBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("Cinemo 3D is unavailable, falling back to 2D:", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** WebGL が使えない環境向け：元のイラストを CSS で踊らせる */
function CinemoFallback({ mood }: { mood: CinemoMood }) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-hidden">
      <Image
        src="/cinemo.png"
        alt=""
        width={866}
        height={1200}
        className={`cinemo-2d cinemo-2d-${mood} h-[150%] w-auto max-w-none invert mix-blend-screen`}
      />
    </div>
  );
}

const NOTES = [
  { ch: "♪", dx: -120, delay: 0, dur: 2.4, drift: -18 },
  { ch: "♫", dx: 95, delay: 0.6, dur: 2.8, drift: 16 },
  { ch: "♪", dx: -80, delay: 1.3, dur: 2.2, drift: -10 },
  { ch: "♬", dx: 130, delay: 1.9, dur: 2.6, drift: 20 },
];

function MusicNotes() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {NOTES.map((n, i) => (
        <span
          key={i}
          className="cinemo-note absolute bottom-[35%] text-xl text-red-300/90 md:text-2xl"
          style={
            {
              left: `calc(50% + ${n.dx}px)`,
              animationDelay: `${n.delay}s`,
              animationDuration: `${n.dur}s`,
              "--drift": `${n.drift}px`,
            } as CSSProperties
          }
        >
          {n.ch}
        </span>
      ))}
    </div>
  );
}

/**
 * 3D のシネモが立つステージ。mood に合わせて踊ったり、聞いたり、喜んだりする。
 * マウスを目で追い、タップするとジャンプする。
 */
export function CinemoStage({
  mood,
  message,
  speakingVolume = 0,
  listeningVolume = 0,
  className = "",
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<CinemoLiveInput>({
    speaking: 0,
    listening: 0,
    pointerX: 0,
    pointerY: 0,
    pointerAt: 0,
    pokedAt: -Infinity,
  });
  const [webgl, setWebgl] = useState<"checking" | "ok" | "none">("checking");
  const [visible, setVisible] = useState(true);
  const [calm, setCalm] = useState(false);

  useEffect(() => {
    setWebgl(hasWebGL2() ? "ok" : "none");
  }, []);

  // 音量は毎フレーム読むので ref 経由で渡す（3D を再レンダーさせない）
  useEffect(() => {
    liveRef.current.speaking = normalizeVolume(speakingVolume);
  }, [speakingVolume]);
  useEffect(() => {
    liveRef.current.listening = normalizeVolume(listeningVolume);
  }, [listeningVolume]);

  // 視線：マウスの位置を追う。文字入力中は入力欄を見る
  useEffect(() => {
    const live = liveRef.current;
    const lookAt = (x: number, y: number) => {
      const box = boxRef.current;
      if (!box) return;
      const r = box.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.35;
      live.pointerX = clamp((x - cx) / (window.innerWidth * 0.4), -1, 1);
      live.pointerY = clamp((y - cy) / (window.innerHeight * 0.4), -1, 1);
      live.pointerAt = performance.now();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse") lookAt(e.clientX, e.clientY);
    };
    const onDown = (e: PointerEvent) => lookAt(e.clientX, e.clientY);
    const onKey = () => {
      const el = document.activeElement;
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
        const r = el.getBoundingClientRect();
        lookAt(r.left + r.width / 2, r.top + r.height / 2);
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // 画面外では描画を止めて電池を節約
  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: "120px",
    });
    io.observe(box);
    return () => io.disconnect();
  }, []);

  // 「視差効果を減らす」設定なら控えめに動く
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setCalm(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const fallback = <CinemoFallback mood={mood} />;

  return (
    <div className={`relative mx-auto w-full max-w-3xl ${className}`}>
      <div
        ref={boxRef}
        className="relative h-60 w-full select-none [mask-image:linear-gradient(to_bottom,transparent,black_14%)] md:h-80"
        aria-hidden
      >
        {webgl === "ok" && (
          <div className="cinemo-fade-in absolute inset-0">
            <SceneBoundary fallback={fallback}>
              <CinemoScene mood={mood} liveRef={liveRef} calm={calm} active={visible} />
            </SceneBoundary>
          </div>
        )}
        {webgl === "none" && fallback}
        {mood === "dancing" && !calm && <MusicNotes />}
      </div>

      {/* 読み上げ用のライブ領域は作り直さず、中の吹き出しだけ差し替える */}
      <div role="status" aria-live="polite" className="relative -mt-1 flex justify-center px-4">
        {message && (
          <p
            key={message}
            className="cinemo-bubble relative max-w-md rounded-2xl border border-white/15 bg-[#151515] px-5 py-2.5 text-center text-sm text-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.45)] md:text-base"
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
