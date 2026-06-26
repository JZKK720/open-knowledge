'use client';
import { RootProvider } from 'fumadocs-ui/provider/next';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const SearchDialog = dynamic(() => import('@/components/inkeep-search-and-chat'), { ssr: false });

const LIGHT_ONLY_ROUTES = new Set(['/']);

export function Provider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const forcedTheme = LIGHT_ONLY_ROUTES.has(pathname) ? 'light' : undefined;

  return (
    <RootProvider
      theme={{ forcedTheme }}
      search={{
        SearchDialog,
      }}
    >
      {children}
    </RootProvider>
  );
}
