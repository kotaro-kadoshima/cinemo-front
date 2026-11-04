import { getSql } from "./db";

export type Emotion = { id: number; name: string };

export type Movie = {
  movieId: number;
  title: string | null;
  overview: string | null;
  posterUrl: string | null;
  duration: number | null;
  rating: number | null;
  originalLanguage: string | null;
};

export type ScoredMovie = { movie: Movie; score: number };

/** 感情の順位ごとの重み（1位=3, 2位=2, 3位=1） */
const WEIGHTS = [3, 2, 1];
/** 満点以外の映画で候補を埋めるときの件数 */
const FILL_LIMIT = 20;
/** 満点以外の映画を候補に入れる最低スコア */
const SCORE_THRESHOLD = 2;
/** プロンプトが大きくなりすぎないための上限（感情が3つそろうときは最大でも 100 件未満） */
const HARD_LIMIT = 100;

export async function getEmotions(): Promise<Emotion[]> {
  const sql = getSql();
  return sql<Emotion[]>`
    select emotion_id::int as id, name
      from cinemo.emotions
     order by emotion_id`;
}

/**
 * 感情（順位順）に合う映画を、重み付きスコアの高い順に返す。
 * 旧 API（MovieRepository.searchScoredMovies）と同じく、満点の映画はすべて入れ、
 * 残りをスコア 2 以上の映画で 20 件まで埋める。
 */
export async function searchScoredMovies(emotionIds: number[]): Promise<ScoredMovie[]> {
  const ids = emotionIds.slice(0, WEIGHTS.length);
  if (ids.length === 0) return [];
  const weights = WEIGHTS.slice(0, ids.length);
  const perfect = weights.reduce((a, b) => a + b, 0);

  const sql = getSql();
  const rows = await sql<(Movie & { score: number })[]>`
    with weights as (
      select * from unnest(${ids}::int[], ${weights}::int[]) as w(emotion_id, weight)
    ),
    scores as (
      select me.movie_id, sum(w.weight)::int as score
        from cinemo.movie_emotions me
        join weights w on w.emotion_id = me.emotion_id
       group by me.movie_id
    )
    select m.movie_id::int as "movieId",
           m.title,
           m.overview,
           m.poster_url as "posterUrl",
           m.duration::int as duration,
           m.rating::float8 as rating,
           m.original_language as "originalLanguage",
           s.score
      from scores s
      join cinemo.movies m on m.movie_id = s.movie_id
     where s.score >= ${SCORE_THRESHOLD}
     order by s.score desc, m.rating desc nulls last, m.movie_id
     limit ${HARD_LIMIT + FILL_LIMIT}`;

  const toScored = ({ score, ...movie }: Movie & { score: number }): ScoredMovie => ({ movie, score });
  const top = rows.filter((r) => r.score === perfect).slice(0, HARD_LIMIT).map(toScored);
  const others = rows.filter((r) => r.score !== perfect).map(toScored);
  return [...top, ...others.slice(0, Math.max(0, FILL_LIMIT - top.length))];
}
