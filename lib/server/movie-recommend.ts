import { generateText, Output } from "ai";
import { z } from "zod";
import { AI_CALL_OPTIONS, recommendModel } from "./ai";
import type { Movie, ScoredMovie } from "./movie-search";

const INSTRUCTIONS = `あなたは映画を選定するプロフェッショナルです。
回答は日本語で行うこと。`;

const buildPrompt = (question: string, movieList: string) => `# 指示
1. 「ユーザーの質問」からオススメする映画を3つ抽出
2. 映画の候補は「候補映画一覧」から抽出すること

## ユーザーの質問
${question}

## 映画の候補一覧
${movieList}
`;

const schema = z.object({
  recommendations: z.array(
    z.object({
      movieId: z.number().int().describe("候補一覧の movieId"),
      title: z.string(),
      reason: z.string().describe("この映画をすすめる理由"),
    }),
  ),
});

/** 候補の中から、気分に合う映画を3本選び、すすめる理由を付けて返す */
export async function pickMovies(
  question: string,
  candidates: ScoredMovie[],
): Promise<{ movie: Movie; reason: string }[]> {
  const movieList = candidates
    .map(
      ({ movie, score }) =>
        `\n{ movieId: ${movie.movieId}, title: ${movie.title}, overview: ${movie.overview}, emotionScore: ${score}}`,
    )
    .join("");

  const { output } = await generateText({
    model: recommendModel(),
    instructions: INSTRUCTIONS,
    prompt: buildPrompt(question, movieList),
    output: Output.object({ schema }),
    ...AI_CALL_OPTIONS,
  });

  // 候補にない ID と重複は捨てる
  const byId = new Map(candidates.map(({ movie }) => [movie.movieId, movie]));
  const picks: { movie: Movie; reason: string }[] = [];
  for (const r of output.recommendations) {
    const movie = byId.get(r.movieId);
    if (movie && !picks.some((p) => p.movie.movieId === movie.movieId)) {
      picks.push({ movie, reason: r.reason });
    }
  }
  return picks.slice(0, 3);
}
