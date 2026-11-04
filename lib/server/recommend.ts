import type { RecommendResponse } from "@/lib/recommend-types";
import { analyzeEmotions } from "./emotion-analysis";
import { pickMovies } from "./movie-recommend";
import { getEmotions, searchScoredMovies } from "./movie-search";

/**
 * 気分の文章から映画を3本推薦する（旧 cinemo-api の POST /recommend と同じ流れ）。
 * 1. 感情マスタから近い感情を AI で3つ選ぶ
 * 2. その感情に重みを付けて DB から候補の映画を集める
 * 3. 候補から AI が3本選び、理由を付ける
 */
export async function recommend(mood: string): Promise<RecommendResponse> {
  const startedAt = Date.now();

  const master = await getEmotions();
  const emotions = await analyzeEmotions(mood, master);
  if (emotions.length === 0) throw new Error("no emotions detected");
  const analyzedAt = Date.now();

  const candidates = await searchScoredMovies(emotions.map((e) => e.id));
  if (candidates.length === 0) throw new Error("no candidate movies");

  const picks = await pickMovies(mood, candidates);
  if (picks.length === 0) throw new Error("no movies picked");

  // 気分の文章は個人的な内容なのでログに残さない
  console.info(
    "[recommend]",
    JSON.stringify({
      emotions: emotions.map((e) => e.name),
      candidates: candidates.length,
      picks: picks.length,
      emotionMs: analyzedAt - startedAt,
      totalMs: Date.now() - startedAt,
    }),
  );

  return {
    items: picks.map(({ movie, reason }) => ({
      title: movie.title,
      posterUrl: movie.posterUrl,
      reason,
      tmdbId: movie.movieId,
      duration: movie.duration,
      rating: movie.rating,
      // 旧 API と同じく、ジャンルと感情タグはまだ返さない
      genres: [],
      emotionTags: [],
      origin: movie.originalLanguage,
    })),
  };
}
