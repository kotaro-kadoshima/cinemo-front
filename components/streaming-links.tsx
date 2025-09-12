'use client';
import { useEffect, useState } from 'react';
import { fetchStreamingInfo, getServiceDisplayName, getServiceIcon } from '@/lib/streaming';

interface StreamingService {
  service: {
    id: string;
    name: string;
    imageSet?: {
      lightThemeImage: string;
      darkThemeImage: string;
    };
  };
  streamingType: string;
  link: string;
}

interface StreamingLinksProps {
  tmdbId: number | null;
}

export function StreamingLinks({ tmdbId }: StreamingLinksProps) {
  const [services, setServices] = useState<StreamingService[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!tmdbId || loaded) return;

    const loadStreamingInfo = async () => {
      setLoading(true);
      try {
        const streamingServices = await fetchStreamingInfo(tmdbId);
        setServices(streamingServices);
        setLoaded(true);
      } catch (error) {
        console.error('Error loading streaming info:', error);
      } finally {
        setLoading(false);
      }
    };

    // 少し遅延させて非同期で読み込み
    const timeoutId = setTimeout(loadStreamingInfo, 500);
    return () => clearTimeout(timeoutId);
  }, [tmdbId, loaded]);

  if (!tmdbId) return null;

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
        <div className="animate-spin w-3 h-3 border border-gray-500 border-t-transparent rounded-full"></div>
        配信情報を確認中...
      </div>
    );
  }

  if (services.length === 0) {
    return loaded ? (
      <div className="mt-3 text-xs text-gray-500">
        配信情報なし
      </div>
    ) : null;
  }

  // 重複した配信サイトを除去（同じservice.idの場合、最初のもののみ残す）
  const uniqueServices = services.filter((service, index, array) => 
    array.findIndex(s => s.service.id === service.service.id) === index
  );

  return (
    <div className="mt-3">
      <div className="text-xs text-gray-400 mb-2">配信中：</div>
      <div className="flex flex-wrap gap-2">
        {uniqueServices.map((service, index) => (
          <a
            key={`${service.service.id}-${index}`}
            href={service.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 bg-black/40 hover:bg-black/60 border border-white/20 hover:border-white/40 rounded-md text-xs text-gray-300 hover:text-white transition-all duration-200 hover:scale-105"
            title={`${getServiceDisplayName(service.service.id)}で視聴`}
          >
            <span className="text-sm flex items-center" aria-hidden="true">
              {getServiceIcon(service.service.id).startsWith('data:image/') ? (
                <img 
                  src={getServiceIcon(service.service.id)} 
                  alt={getServiceDisplayName(service.service.id)}
                  className="w-4 h-4"
                />
              ) : (
                getServiceIcon(service.service.id)
              )}
            </span>
            <span className="font-medium">
              {getServiceDisplayName(service.service.id)}
            </span>
            <span className="text-xs opacity-60">
              {service.streamingType === 'subscription' ? '見放題' : service.streamingType === 'rent' ? 'レンタル' : service.streamingType === 'buy' ? '購入' : ''}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}