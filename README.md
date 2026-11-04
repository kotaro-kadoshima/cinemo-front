# シネモ（cinemo-front）

今日の出来事や気分を日記のように書くと、その気持ちに合う映画を3本、理由付きですすめてくれる Web アプリです。
3D のキャラクター「シネモ」が、映画を選んでいる間は踊りながら待ってくれます。

- 本番: https://cinemo-front.vercel.app/search
- 画面は `/search` だけです（トップページ `/` はありません）

## 主な機能

- **気分から映画を推薦**: 文章から感情を読み取り、感情タグの付いた映画の中から AI が3本選び、すすめる理由を添えて返します
- **3D のシネモ**: 入力待ちはリズムを取り、検索中は踊り、結果が出たら喜び、エラーではしょんぼりします。WebGL が使えない環境では 2D のイラストで表示します
- **配信サービスのリンク**: `/search?streaming=true` で開いたときだけ、各映画の配信先（日本）を表示します

## 技術構成

| 用途 | 使っているもの |
|---|---|
| フレームワーク | Next.js 15（App Router / Turbopack）、React 19、TypeScript |
| スタイル | Tailwind CSS 4 |
| 3D | three.js、React Three Fiber |
| AI | Vercel AI SDK（`ai`）＋ Vercel AI Gateway |
| DB | Supabase（PostgreSQL）、postgres.js |
| 配信情報 | Streaming Availability API（RapidAPI） |
| ホスティング | Vercel |

## 推薦の仕組み

```
画面（/search）
  └─ POST /api/recommend  { mood: "今日の気分の文章" }
       1. 感情抽出   … 感情マスタ（24種類）から、文章に近い感情を AI が最大3つ選ぶ
       2. 候補の集計 … 感情の順位に重み（3・2・1）を付けて、感情タグが合う映画を DB から集める
       3. 3本選定   … 候補の中から AI が3本選び、すすめる理由を書く
  └─ { items: [ { title, posterUrl, reason, tmdbId, duration, rating, origin, ... } ] }
```

- 候補は「3つの感情がすべて一致する映画」をすべて入れ、残りをスコア2以上の映画で20本まで埋めます（上限100本）
- AI の呼び出しは、429 や 5xx のときに自動で2回までリトライします
- 失敗したときは 502 を返し、画面にはエラーメッセージを表示します
- 気分の文章は2,000文字まで受け付け、個人的な内容なのでサーバーのログには残しません
- リクエストの `country` / `genres` / `limit` は受け取りますが、今は検索に使っていません

| ファイル | 役割 |
|---|---|
| `app/api/recommend/route.ts` | API の入口（入力チェックとエラー処理） |
| `lib/server/recommend.ts` | 推薦全体の流れ |
| `lib/server/emotion-analysis.ts` | 感情抽出（AI） |
| `lib/server/movie-search.ts` | 感情マスタの取得と候補の集計（SQL） |
| `lib/server/movie-recommend.ts` | 3本選定（AI） |
| `lib/server/ai.ts` | 使うモデルと AI 呼び出しの設定 |
| `lib/server/db.ts` | DB 接続 |
| `lib/recommend-types.ts` | API のレスポンスの型（画面と共有） |

### 使っているテーブル（`cinemo` スキーマ）

| テーブル | 中身 |
|---|---|
| `emotions` | 感情マスタ（プルチックの感情の輪の24種類） |
| `movies` | 映画（タイトル、あらすじ、ポスター、上映時間、評価、原語など。`movie_id` は TMDB の ID） |
| `movie_emotions` | 映画と感情の対応（1本あたり1〜4個） |

## ローカルで動かす

必要なもの: Node.js 20 以上

```bash
npm install
```

`.env.local` を作って、次の環境変数を設定します（値はチームで共有しているものを使ってください）。

```bash
# Supabase の接続文字列（transaction pooler / ポート 6543）
DATABASE_URL=postgresql://<user>:<password>@<host>:6543/postgres
# Vercel AI Gateway のキー（ローカル開発のときだけ必要）
AI_GATEWAY_API_KEY=
# 使うモデル（省略すると anthropic/claude-haiku-5.5）
RECOMMEND_MODEL=google/gemini-2.5-flash-lite
```

```bash
npm run dev
```

http://localhost:3000/search を開きます。

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` | 本番用にビルド |
| `npm run start` | ビルドしたものを起動 |
| `npm run lint` | ESLint を実行 |

> 開発サーバーを動かしたまま `npm run build` すると、`.next` が上書きされて開発サーバーが 500 を返すようになります。その場合は開発サーバーを起動し直してください。

## 環境変数

| 名前 | 必須 | 説明 |
|---|---|---|
| `DATABASE_URL` | 必須 | Supabase（Postgres）の接続文字列。transaction pooler はプリペアドステートメントに対応していないため、コード側で `prepare: false` にしています |
| `AI_GATEWAY_API_KEY` | ローカルのみ | Vercel AI Gateway のキー。Vercel 上では OIDC で自動的に認証されるので不要です |
| `RECOMMEND_MODEL` | 任意 | 推薦に使うモデル（AI Gateway のモデル ID）。省略すると `anthropic/claude-haiku-5.5` |

### モデルについて

- AI Gateway の**無料枠では使えるモデルが限られていて**、`anthropic/claude-haiku-5.5` は使えません。無料枠のあいだは `RECOMMEND_MODEL=google/gemini-2.5-flash-lite` を設定してください
- AI Gateway のクレジットを購入して有料枠にすれば、`RECOMMEND_MODEL` を消すだけで Claude Haiku 5.5 に切り替わります
- 無料枠はモデルごとの回数制限が厳しいので、利用者が増えると 429 になることがあります

## デプロイ（Vercel）

`main` にマージすると本番にデプロイされます。

1. Vercel のプロジェクトの Settings → Environment Variables に、`DATABASE_URL` と `RECOMMEND_MODEL` を **Production と Preview の両方**に設定します
2. 環境変数は**新しいデプロイから反映**されます。変更したら Redeploy してください
3. `/api/recommend` は誰でも呼べるので、AI Gateway の予算（利用額の上限）を設定しておくと安心です

本番で推薦が 502 になるときは、Vercel のプロジェクトの Logs で `[recommend] failed` を検索すると原因が分かります。

## これまでの大きな変更

### 2026-11: バックエンドを cinemo-api から移行（PR #5）

推薦の処理は、以前は別リポジトリの [cinemo-api](https://github.com/kotaro-kadoshima/cinemo-api)（Spring Boot / Vertex AI の Gemini）で動いていて、このリポジトリの `/api/recommend` は中継するだけでした。
今は Next.js の中で処理が完結します。流れ・プロンプト・候補の集計は旧 API と同じで、候補の集計結果が一致することも確認しています。

旧 API から変えた点:

- 感情が3つそろわなくても検索するようにした（旧 API は 500 になっていた）
- 候補の上限を100本にした（感情が3つのときは最大でも64本なので、結果は変わらない）
- AI が返した重複や、候補にない映画を除外するようにした
- 気分の文章を2,000文字までにし、ログに残さないようにした
- 会話メモリ（Spring AI の ChatMemory）と、10リージョンへのフォールバックは移していない（前者は実際には効いておらず、後者は AI SDK のリトライで代わりにした）
- 使っていなかった API（映画の CRUD、`/ollama`、`/gemini`、`/emotion`、`/health`）は移していない

### 2026-11: 音声会話を廃止

Gemini Live API を使った音声会話は、費用を抑えるため一旦廃止しました（コミット `d93b098`）。
戻すときは、そのコミットの1つ前から音声会話のファイルを復元します。

```bash
git checkout d93b098^ -- contexts hooks lib/worklets lib/genai-live-client.ts lib/audio-recorder.ts lib/audio-streamer.ts lib/audioworklet-registry.ts lib/store-logger.ts lib/utils.ts app/providers.tsx app/types.ts app/api/auth-token app/api/summarize-conversation
```

あわせて、`app/layout.tsx` と `app/search/page.tsx` の音声会話の部分を `d93b098` の差分を見ながら戻し、`@google/genai`・`eventemitter3`・`lodash`・`zustand` を入れ直してください。
Gemini の API キーは漏えい扱いで無効になっているので、新しいキーが必要です。
3D のシネモは、声の大きさに合わせて口を動かす仕組みを残してあります（`components/cinemo/cinemo-stage.tsx` の `speakingVolume` / `listeningVolume`）。

## 既知の課題

- 配信情報の取得（`lib/streaming.ts`）は、RapidAPI のキーをコードに直接書いてブラウザから呼んでいます。サーバー側の API に移して、キーを環境変数にする必要があります
- API は `country` / `genres` / `limit` を受け取りますが、画面には入力欄がなく固定値（空・3）を送っていて、検索にも使っていません
- レスポンスの `genres` と `emotionTags` は、まだ空の配列です
