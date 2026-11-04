/** 推薦に使うモデル（AI Gateway のモデル ID）。RECOMMEND_MODEL で切り替えられる */
export function recommendModel(): string {
  return process.env.RECOMMEND_MODEL || "anthropic/claude-haiku-5.5";
}

/** 1回の AI 呼び出しの設定。429 や 5xx は SDK が自動でリトライする */
export const AI_CALL_OPTIONS = { maxRetries: 2, timeout: 25_000 } as const;
