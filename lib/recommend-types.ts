/** /api/recommend のレスポンス。画面とサーバーで共有する */
export type RecommendItem = {
  title: string | null;
  posterUrl: string | null;
  reason: string | null;
  /** cinemo.movies の movie_id（TMDB の ID） */
  tmdbId: number | null;
  /** 上映時間（分） */
  duration: number | null;
  /** 評価（0.0〜10.0） */
  rating: number | null;
  genres: string[];
  emotionTags: string[];
  /** 原語（original_language） */
  origin: string | null;
};

export type RecommendResponse = { items: RecommendItem[] };
