"use client";

import { memo, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { CinemoModel } from "./cinemo-model";
import type { CinemoLiveInput, CinemoMood } from "./types";

type Props = {
  mood: CinemoMood;
  liveRef: RefObject<CinemoLiveInput>;
  /** prefers-reduced-motion のときは動きを控えめにする */
  calm: boolean;
  /** 画面外にあるときは描画を止める */
  active: boolean;
};

function CinemoScene({ mood, liveRef, calm, active }: Props) {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 2.6, 8.0], fov: 30, near: 0.1, far: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      // ジャンプやカチンコで目が上に出ても切れないよう、頭上に余白をとる
      onCreated={({ camera }) => camera.lookAt(0, 1.9, 0)}
    >
      <hemisphereLight args={["#ffffff", "#2a2a35", 1.3]} />
      <directionalLight position={[-3, 5, 6]} intensity={2.3} />
      {/* 映画館らしい赤い逆光 */}
      <directionalLight position={[2.5, 3, -4]} intensity={1.2} color="#ff4d4d" />
      <CinemoModel mood={mood} liveRef={liveRef} calm={calm} />
    </Canvas>
  );
}

export default memo(CinemoScene);
