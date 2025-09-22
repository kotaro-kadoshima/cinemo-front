'use client';

import { LiveAPIProvider } from '@/contexts/LiveAPIContext';
import { LiveClientOptions } from '@/app/types';

const options: LiveClientOptions = {
  // TODO: APIキーを環境変数から取得するようにする
  apiKey:  process.env.GEMINI_API_KEY || "AIzaSyDtAQhK3YNx44RB_Uw84sIc5NeuKxLG5w0"
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LiveAPIProvider options={options}>
      {children}
    </LiveAPIProvider>
  );
}