import postgres from "postgres";

// 開発中のホットリロードで接続が増え続けないよう、1つの接続プールを使い回す
const globalForDb = globalThis as unknown as { cinemoSql?: postgres.Sql };

/** Supabase（Postgres）への接続。DATABASE_URL は実行時に確認する */
export function getSql(): postgres.Sql {
  if (globalForDb.cinemoSql) return globalForDb.cinemoSql;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");

  const sql = postgres(url, {
    ssl: "require",
    // Supabase の transaction pooler（6543）はプリペアドステートメントに対応していない
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  globalForDb.cinemoSql = sql;
  return sql;
}
