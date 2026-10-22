"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { CinemoLiveInput, CinemoMood } from "./types";

/*
 * シネモ（public/cinemo.png）を three.js のプリミティブで組み立てた 3D モデル。
 *   - 白いボード（黒フチ）＝胴体
 *   - 上部のしましま＝カチンコ。左端を支点に開閉する
 *   - カチンコの上に大きな目が 2 つ（左が小さく、右が大きい）
 *   - 黒い口、細い白い足、黒い靴
 * 線画の雰囲気を出すため、トゥーン陰影 + 背面押し出しのアウトラインで描く。
 */

// ---- 寸法（ワールド単位） ----
const BODY_W = 1.9;
const BODY_H = 1.35;
const BODY_D = 0.26;
const FRAME = 0.07;
const BAR_W = BODY_W + 0.06;
const BAR_H = 0.2;
const LEG_LEN = 0.66;
const LEG_R = 0.036;
const HIP_X = 0.16;
const FOOT_R = 0.11;
const FOOT_SCALE: [number, number, number] = [2.1, 0.6, 1.2];
const FOOT_H = FOOT_R * FOOT_SCALE[1];
const EYE_L = 0.3;
const EYE_R = 0.37;
/** 元イラストのように足を X 字に交差させる角度 */
const CROSS = 0.46;

const INK = "#121212";
const PAPER = "#fbfaf5";
const TAU = Math.PI * 2;

const MOODS: CinemoMood[] = ["idle", "listening", "dancing", "happy", "sad"];

// ---- ちいさな数学ヘルパー ----
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
/** フレームレートに依存しない減衰（k が大きいほど速く追従） */
const damp = (current: number, target: number, k: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-k * dt));
/** period 拍ごとに、拍の直前で開いて拍ちょうどで「カチン」と閉じる */
const clapPulse = (beat: number, period: number) => {
  const x = ((beat % period) + period) % period;
  const start = period - 0.5;
  return x > start ? Math.sin(Math.PI * ((x - start) / 0.5)) : 0;
};

// ---- ポーズ ----
type Pose = {
  hop: number; // 足が地面から離れる高さ
  turn: number; // 体の向き（Y 回転）
  sway: number; // 左右の揺れ（腰を支点）
  lean: number; // 前傾（+）/ 後ろ反り（-）
  squash: number; // 1 = 通常、<1 でつぶれる
  legLz: number; // 足の開き（+ で右へ）
  legLx: number; // 足の前後（- で前に蹴る）
  legRz: number;
  legRx: number;
  clap: number; // カチンコの開き（rad）
  mouth: number; // 口の開き 0..1
  lookX: number; // 黒目の向き -1..1
  lookY: number;
  eye: number; // 目の大きさ倍率
};
const POSE_KEYS: (keyof Pose)[] = [
  "hop",
  "sway",
  "lean",
  "squash",
  "legLz",
  "legLx",
  "legRz",
  "legRx",
  "clap",
  "mouth",
  "lookX",
  "lookY",
  "eye",
];

type PoseContext = {
  t: number;
  lookX: number;
  lookY: number;
  speak: number;
  listen: number;
  calm: boolean;
};

/** 入力待ち：足を交差させたまま、軽くリズムを取ってつま先トントン */
function idlePose({ t, lookX, lookY, calm }: PoseContext): Pose {
  const b = (t * 100) / 60;
  const s = Math.sin(Math.PI * b);
  const bounce = Math.abs(s);
  const tap = Math.max(0, s) ** 2; // 1 拍おきに右足でリズム
  return {
    hop: calm ? 0 : 0.035 * bounce,
    turn: 0.26 + 0.12 * Math.sin(t * 0.45),
    sway: (calm ? 0.03 : 0.08) * s,
    lean: 0.02 * Math.sin(TAU * b),
    squash: 1 - 0.045 * (1 - bounce),
    legLz: CROSS,
    legLx: 0,
    legRz: -CROSS,
    legRx: -0.22 * tap,
    clap: 0.22 * clapPulse(b, 4),
    mouth: 0.06 + 0.06 * Math.max(0, Math.sin(Math.PI * b * 0.5)),
    lookX,
    lookY,
    eye: 1,
  };
}

/** 音声会話中：身を乗り出して聞く。マイク音量でうなずき、自分の声で口とカチンコが動く */
function listeningPose({ t, lookX, lookY, speak, listen }: PoseContext): Pose {
  const b = (t * 72) / 60;
  const s = Math.sin(Math.PI * b);
  return {
    hop: 0.015 * Math.abs(s) + 0.05 * speak,
    turn: 0.12 * Math.sin(t * 0.4),
    sway: 0.04 * s,
    lean: 0.1 + 0.2 * listen + 0.03 * Math.sin(TAU * b),
    squash: 1 - 0.02 * Math.abs(s) + 0.05 * speak,
    legLz: CROSS - 0.04,
    legLx: 0,
    legRz: -CROSS + 0.04,
    legRx: 0,
    clap: 0.38 * speak,
    mouth: 0.05 + 0.95 * speak,
    lookX: lookX * 0.5,
    lookY: lookY * 0.5 - 0.05,
    eye: 1.02 + 0.08 * speak,
  };
}

/**
 * 映画を探している間のダンス（124 BPM、8 拍で 1 ループ）
 *   0-3 拍: チャールストン（足を交差 ↔ 開く）
 *   4-5 拍: 左右のサイドキック
 *   6-7 拍: ジャンプして 1 回転、着地でカチン！
 */
function dancingPose({ t, calm }: PoseContext): Pose & { spin: number } {
  const b = (t * 124) / 60;
  const p = b - Math.floor(b);
  const x = ((b % 8) + 8) % 8;
  const s = Math.sin(Math.PI * b);
  const hopCurve = Math.sin(Math.PI * p);
  const land = Math.exp(-p * 10);

  // チャールストン
  const cross = 0.5 - 0.5 * Math.cos(Math.PI * b);
  const base: Pose = {
    hop: 0.16 * hopCurve,
    turn: 0.3 * Math.sin(Math.PI * b * 0.5),
    sway: 0.16 * s,
    lean: 0.06 * Math.cos(TAU * b),
    squash: 1 - 0.12 * land + 0.05 * hopCurve,
    legLz: lerp(-0.32, CROSS, cross),
    legLx: -0.35 * Math.max(0, s),
    legRz: -lerp(-0.32, CROSS, cross),
    legRx: -0.35 * Math.max(0, -s),
    clap: 0.35 * clapPulse(b, 2),
    mouth: 0.3 + 0.4 * Math.abs(Math.sin(TAU * b)),
    lookX: 0.75 * s,
    lookY: -0.15,
    eye: 1.08,
  };
  if (calm) return { ...base, hop: 0, sway: base.sway * 0.4, legLx: 0, legRx: 0, spin: 0 };

  // サイドキック
  const kickL = x >= 4 && x < 5 ? Math.sin(Math.PI * (x - 4)) : 0;
  const kickR = x >= 5 && x < 6 ? Math.sin(Math.PI * (x - 5)) : 0;
  const side: Pose = {
    ...base,
    hop: 0.06 * (kickL + kickR),
    turn: 0,
    sway: 0.24 * (kickL - kickR),
    legLz: -1.0 * kickL,
    legLx: 0,
    legRz: 1.0 * kickR,
    legRx: 0,
    lookX: 0.9 * (kickR - kickL),
    lookY: 0.5,
  };

  // ジャンプ＆スピン
  const air = Math.sin(Math.PI * clamp((x - 6) / 1.9, 0, 1));
  const spinPose: Pose = {
    ...base,
    hop: 0.45 * air,
    turn: 0,
    sway: 0,
    lean: -0.08 * air,
    squash: 1 + 0.08 * air,
    legLz: CROSS,
    legLx: 0.35 * air,
    legRz: -CROSS,
    legRx: 0.35 * air,
    clap: 0.4 * Math.sin(Math.PI * clamp((x - 7.2) / 0.8, 0, 1)),
    mouth: 0.8,
    lookX: 0,
    lookY: -0.3,
    eye: 1.18,
  };

  const wSide = smoothstep(3.8, 4.0, x) * (1 - smoothstep(5.8, 6.0, x));
  const wSpin = smoothstep(5.8, 6.0, x) * (1 - smoothstep(7.9, 8.0, x));
  const wBase = Math.max(0, 1 - wSide - wSpin);
  const out = { ...base, spin: TAU * smoothstep(6.0, 8.0, x) };
  for (const k of POSE_KEYS) {
    out[k] = base[k] * wBase + side[k] * wSide + spinPose[k] * wSpin;
  }
  out.turn = base.turn * wBase;
  return out;
}

/** 結果が出た：ぴょんぴょん跳ねて、下の「表示する」ボタンを見る */
function happyPose({ t, calm }: PoseContext): Pose {
  const b = (t * 150) / 60;
  const s = Math.sin(Math.PI * b);
  const jump = Math.abs(s);
  return {
    hop: (calm ? 0.04 : 0.26) * jump,
    turn: 0.15 * Math.sin(Math.PI * b * 0.5),
    sway: 0.1 * s,
    lean: -0.06,
    squash: 1 - 0.1 * (1 - jump) ** 4 + 0.05 * jump,
    legLz: -0.1 - 0.16 * jump,
    legLx: 0.25 * jump,
    legRz: 0.1 + 0.16 * jump,
    legRx: 0.25 * jump,
    clap: 0.3 * Math.abs(Math.sin(TAU * b)),
    mouth: 0.75,
    lookX: 0.2 * Math.sin(t * 1.3),
    lookY: 0.6,
    eye: 1.12,
  };
}

/** エラー：うつむいて、ゆっくり揺れる */
function sadPose({ t }: PoseContext): Pose {
  const b = (t * 45) / 60;
  return {
    hop: 0,
    turn: 0.1 * Math.sin(t * 0.3),
    sway: 0.05 * Math.sin(Math.PI * b),
    lean: 0.22,
    squash: 0.93,
    legLz: CROSS + 0.06,
    legLx: 0,
    legRz: -CROSS - 0.06,
    legRx: 0,
    clap: 0,
    mouth: 0,
    lookX: 0.25 * Math.sin(t * 0.6),
    lookY: 0.8,
    eye: 0.9,
  };
}

/** スポットライトの色（線形 RGB）と明るさ */
const SPOT: Record<CinemoMood, { color: [number, number, number]; power: number }> = {
  idle: { color: [1.0, 0.92, 0.8], power: 0.8 },
  listening: { color: [0.45, 1.0, 0.6], power: 0.9 },
  dancing: { color: [1.0, 0.25, 0.3], power: 1.1 },
  happy: { color: [1.0, 0.78, 0.3], power: 1.0 },
  sad: { color: [0.35, 0.45, 1.0], power: 0.45 },
};
/** ダンス中はスポットライトの色を 2 拍ごとに切り替える */
const DISCO: [number, number, number][] = [
  [1.0, 0.2, 0.25],
  [0.9, 0.3, 1.0],
  [0.3, 0.55, 1.0],
  [1.0, 0.75, 0.25],
];

// ---- 形・マテリアル ----

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** 元イラストの口：丸い山形で、下側にギザギザ（白い切れ込み 3 つ） */
function mouthShape() {
  const s = new THREE.Shape();
  const o = -0.2; // 上端を y=0 にそろえる（開くと下に伸びる）
  s.moveTo(-0.37, -0.17 + o);
  s.bezierCurveTo(-0.4, 0.06 + o, -0.22, 0.2 + o, 0, 0.2 + o);
  s.bezierCurveTo(0.22, 0.2 + o, 0.4, 0.06 + o, 0.37, -0.15 + o);
  s.quadraticCurveTo(0.34, -0.21 + o, 0.29, -0.16 + o);
  s.quadraticCurveTo(0.24, -0.02 + o, 0.17, -0.12 + o);
  s.quadraticCurveTo(0.135, -0.18 + o, 0.1, -0.12 + o);
  s.quadraticCurveTo(0.035, -0.01 + o, -0.03, -0.12 + o);
  s.quadraticCurveTo(-0.065, -0.18 + o, -0.1, -0.12 + o);
  s.quadraticCurveTo(-0.17, -0.02 + o, -0.25, -0.14 + o);
  s.quadraticCurveTo(-0.31, -0.22 + o, -0.37, -0.17 + o);
  return s;
}

/** カチンコのしましま（白黒のブロック） */
function createStripeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const g = canvas.getContext("2d");
  if (g) {
    g.fillStyle = INK;
    g.fillRect(0, 0, canvas.width, canvas.height);
    const cells = 9;
    const cellW = canvas.width / cells;
    g.fillStyle = PAPER;
    for (let i = 0; i < cells; i++) {
      g.fillRect(i * cellW + cellW * 0.3, 11, cellW * 0.5, 42);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 法線方向に押し出した裏面を黒で塗る → 手描き風の輪郭線 */
function createOutlineMaterial(thickness: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      thickness: { value: thickness },
      color: { value: new THREE.Color(INK) },
    },
    vertexShader: /* glsl */ `
      uniform float thickness;
      void main() {
        vec3 p = position + normal * thickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      void main() { gl_FragColor = vec4(color, 1.0); }
    `,
    side: THREE.BackSide,
  });
}

/** 上から差し込むスポットライトの光の筋（加算合成） */
function createBeamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(1, 1, 1) },
      power: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vFacing;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vFacing = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float power;
      varying vec2 vUv;
      varying float vFacing;
      void main() {
        float a = (0.12 + 0.88 * pow(vUv.y, 1.5)) * pow(vFacing, 1.6) * 0.2 * power;
        gl_FragColor = vec4(color, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

/** 円形グラデーション（床のスポット・影で共用） */
function createRadialMaterial(opts: {
  color: THREE.ColorRepresentation;
  strength: number;
  falloff: number;
  additive: boolean;
}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(opts.color) },
      power: { value: 1 },
      strength: { value: opts.strength },
      falloff: { value: opts.falloff },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float power;
      uniform float strength;
      uniform float falloff;
      varying vec2 vUv;
      void main() {
        float d = distance(vUv, vec2(0.5)) * 2.0;
        float a = pow(clamp(1.0 - d, 0.0, 1.0), falloff) * strength * power;
        gl_FragColor = vec4(color, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

function useCinemoAssets() {
  const assets = useMemo(() => {
    const gradientMap = new THREE.DataTexture(
      new Uint8Array([0, 110, 200, 255]),
      4,
      1,
      THREE.RedFormat
    );
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.generateMipmaps = false;
    gradientMap.needsUpdate = true;
    const stripeTexture = createStripeTexture();

    const ink = new THREE.MeshToonMaterial({ color: INK, gradientMap });
    const geometries = {
      board: new RoundedBoxGeometry(BODY_W, BODY_H, BODY_D, 4, 0.07),
      face: new THREE.ShapeGeometry(
        roundedRect(BODY_W - FRAME * 2, BODY_H - FRAME * 2, 0.05),
        6
      ),
      bar: new THREE.BoxGeometry(BAR_W, BAR_H, BODY_D + 0.03),
      mouth: new THREE.ShapeGeometry(mouthShape(), 24),
      eyeL: new THREE.SphereGeometry(EYE_L, 40, 28),
      eyeR: new THREE.SphereGeometry(EYE_R, 40, 28),
      unitSphere: new THREE.SphereGeometry(1, 24, 16),
      leg: new THREE.CapsuleGeometry(LEG_R, LEG_LEN - LEG_R * 2, 6, 12),
      foot: new THREE.SphereGeometry(FOOT_R, 24, 16),
      beam: new THREE.ConeGeometry(1.9, 6, 48, 1, true),
      disc: new THREE.CircleGeometry(1, 48),
    };
    const stripes = new THREE.MeshToonMaterial({ map: stripeTexture, gradientMap });
    const materials = {
      paper: new THREE.MeshToonMaterial({ color: PAPER, gradientMap }),
      eyeWhite: new THREE.MeshToonMaterial({ color: "#ffffff", gradientMap }),
      ink,
      // BoxGeometry の面順: +x, -x, +y, -y, +z(前), -z(後)
      bar: [ink, ink, ink, ink, stripes, stripes],
      stripes,
      mouth: new THREE.MeshBasicMaterial({
        color: INK,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
      highlight: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
      outline: createOutlineMaterial(0.024),
      legOutline: createOutlineMaterial(0.02),
      beam: createBeamMaterial(),
      floor: createRadialMaterial({ color: "#ffffff", strength: 0.55, falloff: 1.6, additive: true }),
      shadow: createRadialMaterial({ color: "#000000", strength: 0.75, falloff: 1.8, additive: false }),
    };
    return { gradientMap, stripeTexture, geometries, materials };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(assets.geometries).forEach((g) => g.dispose());
      const mats = new Set<THREE.Material>();
      Object.values(assets.materials).forEach((m) =>
        (Array.isArray(m) ? m : [m]).forEach((x) => mats.add(x))
      );
      mats.forEach((m) => m.dispose());
      assets.gradientMap.dispose();
      assets.stripeTexture.dispose();
    };
  }, [assets]);

  return assets;
}

type Assets = ReturnType<typeof useCinemoAssets>;

function Eye({
  radius,
  geometry,
  position,
  bias,
  assets,
  eyeRef,
  pupilRef,
}: {
  radius: number;
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  /** 黒目のクセ（元イラストは少し寄り目） */
  bias: number;
  assets: Assets;
  eyeRef: RefObject<THREE.Group | null>;
  pupilRef: RefObject<THREE.Group | null>;
}) {
  const { geometries: g, materials: m } = assets;
  return (
    <group position={position}>
      <group ref={eyeRef} scale={[1, 1.06, 0.85]}>
        <mesh geometry={geometry} material={m.eyeWhite} />
        <mesh geometry={geometry} material={m.outline} />
        <group ref={pupilRef} userData={{ bias }}>
          <mesh
            geometry={g.unitSphere}
            material={m.ink}
            position={[0, 0, radius * 0.93]}
            scale={[radius * 0.45, radius * 0.45, radius * 0.13]}
          />
          <mesh
            geometry={g.unitSphere}
            material={m.highlight}
            position={[0, 0, radius * 1.05]}
            scale={[radius * 0.13, radius * 0.13, radius * 0.05]}
          />
        </group>
      </group>
    </group>
  );
}

function Leg({
  side,
  assets,
  legRef,
  footRef,
  shoeRef,
}: {
  side: -1 | 1;
  assets: Assets;
  legRef: RefObject<THREE.Group | null>;
  footRef: RefObject<THREE.Group | null>;
  shoeRef: RefObject<THREE.Mesh | null>;
}) {
  const { geometries: g, materials: m } = assets;
  return (
    // 交差したときに重ならないよう、左足を少し奥に置く
    <group ref={legRef} position={[side * HIP_X, 0, side * 0.035]}>
      <mesh geometry={g.leg} material={m.paper} position={[0, -LEG_LEN / 2, 0]} />
      <mesh geometry={g.leg} material={m.legOutline} position={[0, -LEG_LEN / 2, 0]} />
      <group ref={footRef} position={[0, -LEG_LEN, 0]}>
        <mesh
          ref={shoeRef}
          geometry={g.foot}
          material={m.ink}
          position={[side * 0.12, 0, 0.05]}
          scale={FOOT_SCALE}
        />
      </group>
    </group>
  );
}

/** つま先が外側を向くように靴をずらす量（足が交差したら向きも入れ替わる） */
function shoeOffset(hipX: number, legZ: number) {
  const footX = hipX + LEG_LEN * Math.sin(legZ);
  return 0.12 * Math.tanh(footX / 0.06);
}

export function CinemoModel({
  mood,
  liveRef,
  calm,
}: {
  mood: CinemoMood;
  liveRef: RefObject<CinemoLiveInput>;
  calm: boolean;
}) {
  const assets = useCinemoAssets();
  const { geometries: g, materials: m } = assets;

  const root = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const clapper = useRef<THREE.Group>(null);
  const mouthRef = useRef<THREE.Group>(null);
  const eyeL = useRef<THREE.Group>(null);
  const eyeR = useRef<THREE.Group>(null);
  const pupilL = useRef<THREE.Group>(null);
  const pupilR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const footL = useRef<THREE.Group>(null);
  const footR = useRef<THREE.Group>(null);
  const shoeL = useRef<THREE.Mesh>(null);
  const shoeR = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);

  // フレーム間で持ち越す値
  const state = useRef({
    weights: { idle: 1, listening: 0, dancing: 0, happy: 0, sad: 0 } as Record<CinemoMood, number>,
    pose: idlePose({ t: 0, lookX: 0, lookY: 0, speak: 0, listen: 0, calm: false }),
    look: { x: 0, y: 0, pointerWeight: 0 },
    speak: 0,
    listen: 0,
    spot: new THREE.Color(1, 0.92, 0.8),
    spotPower: 0.8,
    nextBlink: 2,
    blinkStart: -1,
  });

  const tmpColor = useMemo(() => new THREE.Color(), []);

  useFrame((frame, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    const t = frame.clock.elapsedTime;
    const live = liveRef.current;
    const st = state.current;
    const now = performance.now();

    // 気分の切り替えはクロスフェード
    for (const md of MOODS) {
      st.weights[md] = damp(st.weights[md], md === mood ? 1 : 0, 4, dt);
    }

    // 声・マイク音量（口パクは速く、うなずきはゆっくり）
    st.speak = damp(st.speak, clamp(live.speaking, 0, 1), 18, dt);
    st.listen = damp(st.listen, clamp(live.listening, 0, 1), 6, dt);

    // 視線：マウスが動いていればそちらを見る。止まっていればキョロキョロ
    const pointerActive = live.pointerAt > 0 && now - live.pointerAt < 3500;
    st.look.pointerWeight = damp(st.look.pointerWeight, pointerActive ? 1 : 0, 3, dt);
    const wanderX = 0.55 * Math.sin(t * 0.63) + 0.2 * Math.sin(t * 1.7);
    const wanderY = 0.25 * Math.sin(t * 0.41 + 1);
    st.look.x = damp(st.look.x, lerp(wanderX, live.pointerX, st.look.pointerWeight), 8, dt);
    st.look.y = damp(st.look.y, lerp(wanderY, live.pointerY, st.look.pointerWeight), 8, dt);

    const ctx: PoseContext = {
      t,
      lookX: st.look.x,
      lookY: st.look.y,
      speak: st.speak,
      listen: st.listen,
      calm,
    };
    const dance = dancingPose(ctx);
    const poses: Record<CinemoMood, Pose> = {
      idle: idlePose(ctx),
      listening: listeningPose(ctx),
      dancing: dance,
      happy: happyPose(ctx),
      sad: sadPose(ctx),
    };

    // 重み付きでブレンド（向きは角度の折り返しに強いようにベクトル平均）
    let total = 0;
    for (const md of MOODS) total += st.weights[md];
    const pose = st.pose;
    for (const k of POSE_KEYS) pose[k] = 0;
    let turnX = 0;
    let turnY = 0;
    for (const md of MOODS) {
      const w = st.weights[md] / total;
      if (w < 1e-4) continue;
      const src = poses[md];
      for (const k of POSE_KEYS) pose[k] += src[k] * w;
      const angle = src.turn + (md === "dancing" ? dance.spin : 0);
      turnX += Math.cos(angle) * w;
      turnY += Math.sin(angle) * w;
    }
    pose.turn = Math.atan2(turnY, turnX);

    // タップされたら、ぴょんと跳んでくるっと回る
    const tp = (now - live.pokedAt) / 1000;
    if (tp >= 0 && tp < 0.9) {
      const k = Math.sin((Math.PI * tp) / 0.9);
      pose.hop += (calm ? 0.1 : 0.45) * k;
      if (!calm) pose.turn += TAU * smoothstep(0, 0.9, tp);
      pose.clap += 0.35 * k;
      pose.eye += 0.25 * k;
      pose.mouth = Math.max(pose.mouth, 0.8 * k);
      pose.legLx += 0.4 * k;
      pose.legRx += 0.4 * k;
    }

    // まばたき（たまに 2 回）
    if (t > st.nextBlink) {
      st.blinkStart = t;
      st.nextBlink = t + (Math.random() < 0.2 ? 0.28 : 2.2 + Math.random() * 3.2);
    }
    const bt = (t - st.blinkStart) / 0.14;
    const blink = bt >= 0 && bt < 1 ? Math.sin(Math.PI * bt) : 0;

    // ---- 反映 ----
    // 支えている足の長さに合わせて腰の高さを決め、足が地面に着くようにする
    const reachL = LEG_LEN * Math.cos(pose.legLz) * Math.cos(pose.legLx);
    const reachR = LEG_LEN * Math.cos(pose.legRz) * Math.cos(pose.legRx);
    if (root.current) {
      root.current.position.y = FOOT_H + Math.max(reachL, reachR) + Math.max(0, pose.hop);
      root.current.rotation.y = pose.turn;
    }
    if (upper.current) {
      const sq = clamp(pose.squash, 0.7, 1.3);
      const thin = 1 / Math.sqrt(sq);
      upper.current.scale.set(thin, sq, thin);
      upper.current.rotation.set(pose.lean, 0, pose.sway);
    }
    if (clapper.current) clapper.current.rotation.z = clamp(pose.clap, 0, 0.75);
    if (mouthRef.current) {
      const open = clamp(pose.mouth, 0, 1);
      mouthRef.current.scale.set(1.12 * (1 - 0.12 * open), 1 + 0.75 * open, 1);
    }
    const eyeScaleY = 1.06 * (1 - 0.92 * blink);
    for (const eye of [eyeL.current, eyeR.current]) {
      if (!eye) continue;
      eye.scale.set(pose.eye, pose.eye * eyeScaleY, pose.eye * 0.85);
    }
    for (const pupil of [pupilL.current, pupilR.current]) {
      if (!pupil) continue;
      const bias = (pupil.userData.bias as number) ?? 0;
      pupil.rotation.set(clamp(pose.lookY, -1, 1) * 0.45, clamp(pose.lookX + bias, -1.2, 1.2) * 0.55, 0);
    }
    if (legL.current) legL.current.rotation.set(pose.legLx, 0, pose.legLz);
    if (legR.current) legR.current.rotation.set(pose.legRx, 0, pose.legRz);
    // 靴はなるべく地面と平行に
    if (footL.current) footL.current.rotation.set(-pose.legLx * 0.6, 0, -pose.legLz);
    if (footR.current) footR.current.rotation.set(-pose.legRx * 0.6, 0, -pose.legRz);
    if (shoeL.current) shoeL.current.position.x = shoeOffset(-HIP_X, pose.legLz);
    if (shoeR.current) shoeR.current.position.x = shoeOffset(HIP_X, pose.legRz);

    // 影はジャンプすると小さく薄く
    if (shadow.current) {
      const h = Math.max(0, pose.hop);
      const s = 1.05 - h * 0.6;
      shadow.current.scale.set(s, s, 1);
      (shadow.current.material as THREE.ShaderMaterial).uniforms.power.value = clamp(1 - h * 1.1, 0.25, 1);
    }

    // スポットライトの色
    let r = 0;
    let gr = 0;
    let bl = 0;
    let power = 0;
    for (const md of MOODS) {
      const w = st.weights[md] / total;
      let c = SPOT[md].color;
      let pw = SPOT[md].power;
      if (md === "dancing") {
        const beat = (t * 124) / 60;
        c = DISCO[Math.floor(beat / 2) % DISCO.length];
        pw += 0.35 * Math.exp(-(beat % 1) * 6);
      }
      r += c[0] * w;
      gr += c[1] * w;
      bl += c[2] * w;
      power += pw * w;
    }
    tmpColor.setRGB(r, gr, bl);
    st.spot.lerp(tmpColor, 1 - Math.exp(-6 * dt));
    st.spotPower = damp(st.spotPower, power, 8, dt);
    m.beam.uniforms.color.value.copy(st.spot);
    m.beam.uniforms.power.value = st.spotPower;
    m.floor.uniforms.color.value.copy(st.spot);
    m.floor.uniforms.power.value = st.spotPower;
  });

  const setCursor = (cursor: string) => {
    if (typeof document !== "undefined") document.body.style.cursor = cursor;
  };
  useEffect(() => () => setCursor(""), []);

  return (
    <>
      {/* 光の筋と床のスポット */}
      <mesh geometry={g.beam} material={m.beam} position={[0, 3, -0.4]} renderOrder={1} />
      <mesh
        geometry={g.disc}
        material={m.floor}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.002, 0]}
        scale={1.9}
        renderOrder={2}
      />
      <mesh
        ref={shadow}
        geometry={g.disc}
        material={m.shadow}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.004, 0.05]}
        scale={1}
        renderOrder={3}
      />

      <group
        ref={root}
        onPointerDown={(e) => {
          e.stopPropagation();
          liveRef.current.pokedAt = performance.now();
        }}
        onPointerOver={() => setCursor("pointer")}
        onPointerOut={() => setCursor("")}
      >
        {/* 上半身（腰を支点に揺れる・つぶれる） */}
        <group ref={upper}>
          <group position={[0, BODY_H / 2, 0]}>
            <mesh geometry={g.board} material={m.ink} />
            <mesh geometry={g.face} material={m.paper} position={[0, 0, BODY_D / 2 + 0.002]} />
            <mesh
              geometry={g.face}
              material={m.paper}
              position={[0, 0, -BODY_D / 2 - 0.002]}
              rotation={[0, Math.PI, 0]}
            />
            <group ref={mouthRef} position={[0.04, 0.5, BODY_D / 2 + 0.006]}>
              <mesh geometry={g.mouth} material={m.mouth} />
            </group>

            {/* カチンコ（左端が支点）。目もここに乗っている */}
            <group ref={clapper} position={[-BODY_W / 2 - 0.03, BODY_H / 2, 0]}>
              <mesh
                geometry={g.bar}
                material={m.bar}
                position={[BAR_W / 2, BAR_H / 2 + 0.015, 0]}
              />
              <Eye
                radius={EYE_L}
                geometry={g.eyeL}
                position={[BODY_W / 2 - 0.42, BAR_H + 0.27, 0.06]}
                bias={0.12}
                assets={assets}
                eyeRef={eyeL}
                pupilRef={pupilL}
              />
              <Eye
                radius={EYE_R}
                geometry={g.eyeR}
                position={[BODY_W / 2 + 0.29, BAR_H + 0.33, 0.1]}
                bias={-0.22}
                assets={assets}
                eyeRef={eyeR}
                pupilRef={pupilR}
              />
            </group>
          </group>
        </group>

        <Leg side={-1} assets={assets} legRef={legL} footRef={footL} shoeRef={shoeL} />
        <Leg side={1} assets={assets} legRef={legR} footRef={footR} shoeRef={shoeR} />
      </group>
    </>
  );
}
