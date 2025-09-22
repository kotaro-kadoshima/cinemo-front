'use client';

import { LiveAPIProvider } from '@/contexts/LiveAPIContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LiveAPIProvider>
      {children}
    </LiveAPIProvider>
  );
}