import type { StreamingLink } from "@/lib/streaming";

const API_HOST = "streaming-availability.p.rapidapi.com";

/** 配信状況はそれほど頻繁に変わらないので、成功した結果は1日キャッシュする */
export const STREAMING_CACHE_SECONDS = 60 * 60 * 24;

type ApiStreamingOption = {
  service?: { id?: string; name?: string };
  type?: string;
  streamingType?: string;
  link?: string;
};

/**
 * 日本で観られる配信サービスを返す（Streaming Availability API / RapidAPI）。
 * キーが未設定のときや API が失敗したときは null を返し、画面には何も表示しない。
 */
export async function fetchStreamingLinks(tmdbId: number): Promise<StreamingLink[] | null> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return null;

  const res = await fetch(`https://${API_HOST}/shows/movie/${tmdbId}?country=jp`, {
    headers: { "x-rapidapi-key": apiKey, "x-rapidapi-host": API_HOST },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  // 404 はその映画のデータがないだけなので、「配信なし」として扱う
  if (res.status === 404) return [];
  if (!res.ok) {
    console.warn(`[streaming] API error ${res.status} (tmdbId=${tmdbId})`);
    return null;
  }

  const data = (await res.json()) as { streamingOptions?: { jp?: ApiStreamingOption[] } };
  const links: StreamingLink[] = [];
  for (const option of data.streamingOptions?.jp ?? []) {
    const id = option.service?.id;
    if (!id || !option.link) continue;
    const link: StreamingLink = {
      id,
      name: option.service?.name ?? id,
      type: option.type ?? option.streamingType ?? "",
      link: option.link,
    };
    // 同じサービスが複数（見放題と購入など）あるときは、見放題 → レンタル → 購入 の順で1件だけ残す
    const i = links.findIndex((l) => l.id === id);
    if (i < 0) links.push(link);
    else if (typePriority(link.type) < typePriority(links[i].type)) links[i] = link;
  }
  return links;
}

const TYPE_ORDER = ["subscription", "free", "addon", "rent", "buy"];
const typePriority = (type: string) => {
  const i = TYPE_ORDER.indexOf(type);
  return i < 0 ? TYPE_ORDER.length : i;
};
