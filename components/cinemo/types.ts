/** シネモの気分（アニメーションの種類） */
export type CinemoMood =
  | "idle" // 入力待ち：ゆるくリズムを取りながら待つ
  | "listening" // 音声会話中：うなずきながら聞く・話すと口が動く
  | "dancing" // 映画を探している間：ノリノリで踊る
  | "happy" // 結果が出た：跳ねて喜ぶ
  | "sad"; // エラー：しょんぼり

/** 3D シーンへ毎フレーム渡す値（再レンダーを避けるため ref で共有する） */
export type CinemoLiveInput = {
  /** シネモ自身の声の大きさ 0..1 */
  speaking: number;
  /** ユーザーのマイク音量 0..1 */
  listening: number;
  /** ポインタ位置（キャンバス中心基準、-1..1。y は下が正） */
  pointerX: number;
  pointerY: number;
  /** 最後にポインタが動いた時刻（performance.now） */
  pointerAt: number;
  /** 最後にシネモをタップした時刻（performance.now） */
  pokedAt: number;
};
