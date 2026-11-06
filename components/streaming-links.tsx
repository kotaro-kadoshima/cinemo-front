'use client';
import { useEffect, useState } from 'react';
import {
  getServiceDisplayName,
  getServiceIcon,
  type StreamingLink,
  type StreamingResponse,
} from '@/lib/streaming';

const TYPE_LABELS: Record<string, string> = {
  subscription: '見放題',
  rent: 'レンタル',
  buy: '購入',
};

interface StreamingLinksProps {
  tmdbId: number | null;
}

/** 映画を日本で観られる配信サービスへのリンク。取得できなかったときは何も表示しない */
export function StreamingLinks({ tmdbId }: StreamingLinksProps) {
  // null は「読み込み中」または「取得できなかった（キー未設定・エラー）」で、どちらも表示しない
  const [services, setServices] = useState<StreamingLink[] | null>(null);

  useEffect(() => {
    if (!tmdbId) return;
    const controller = new AbortController();
    fetch(`/api/streaming/${tmdbId}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<StreamingResponse>) : null))
      .then((data) => {
        if (data?.status === 'ok') setServices(data.services);
      })
      .catch(() => {
        // 取得できなかったときは何も表示しない
      });
    return () => controller.abort();
  }, [tmdbId]);

  if (!tmdbId || services === null) return null;

  if (services.length === 0) {
    return <div className="mt-3 text-xs text-gray-500">配信情報なし</div>;
  }

  return (
    <div className="mt-3">
      <div className="text-xs text-gray-400 mb-2">配信中：</div>
      <div className="flex flex-wrap gap-2">
        {services.map((service) => {
          const name = getServiceDisplayName(service.id);
          const icon = getServiceIcon(service.id);
          return (
            <a
              key={service.id}
              href={service.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 bg-black/40 hover:bg-black/60 border border-white/20 hover:border-white/40 rounded-md text-xs text-gray-300 hover:text-white transition-all duration-200 hover:scale-105"
              title={`${name}で視聴`}
            >
              <span className="text-sm flex items-center" aria-hidden="true">
                {icon.startsWith('data:image/') ? (
                  // 埋め込みの小さなアイコン（data URI）なので、画像最適化は不要
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={icon} alt="" className="w-4 h-4" />
                ) : (
                  icon
                )}
              </span>
              <span className="font-medium">{name}</span>
              <span className="text-xs opacity-60">{TYPE_LABELS[service.type] ?? ''}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
