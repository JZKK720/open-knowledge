'use client';

import { ArrowUpRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { classifySplashOs, type SplashOs, splashCtaLayout } from '@/lib/share-splash';
import { SplashCliBlock } from './splash-cli-block';
import { SplashCtaCluster } from './splash-cta-cluster';

interface SplashCtaPanelProps {
  downloadUrl: string;
  customSchemeUrl: string;
  githubUrl: string;
  installCommand: string;
  cloneCommand: string;
}

export function SplashCtaPanel({
  downloadUrl,
  customSchemeUrl,
  githubUrl,
  installCommand,
  cloneCommand,
}: SplashCtaPanelProps) {
  const [os, setOs] = useState<SplashOs>('unknown');

  useEffect(() => {
    setOs(classifySplashOs(readPlatformInput()));
  }, []);

  const layout = splashCtaLayout(os);

  if (layout.showWindowsNotice) {
    return <SplashWindowsNotice githubUrl={githubUrl} />;
  }

  return (
    <>
      {layout.showCluster && (
        <SplashCtaCluster
          downloadUrl={downloadUrl}
          customSchemeUrl={customSchemeUrl}
          githubUrl={githubUrl}
        />
      )}

      <SplashCliBlock
        installCommand={installCommand}
        cloneCommand={cloneCommand}
        disclosureSummary={
          layout.cliInline ? undefined : { lead: 'Have an Intel Mac?', action: 'Open with the CLI' }
        }
      />

      {/* Linux drops the cluster (no desktop binary, no deep link) but keeps a
          standalone GitHub fallback so a recipient who can't run the CLI still
          reaches the content. splashCtaLayout encodes the invariant that every
          OS keeps a GitHub path (cluster / standalone / Windows notice). */}
      {layout.showStandaloneGithub && (
        <div className="mt-6">
          <SplashGithubLink githubUrl={githubUrl} />
        </div>
      )}
    </>
  );
}

function readPlatformInput(): string | null {
  if (typeof navigator === 'undefined') return null;
  const withUaData = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  return withUaData.userAgentData?.platform ?? navigator.userAgent ?? null;
}

function SplashWindowsNotice({ githubUrl }: { githubUrl: string }) {
  return (
    <div className="mt-12 flex flex-col gap-4" role="status" data-testid="splash-windows-notice">
      <p
        className="text-base leading-relaxed text-slide-text"
        data-testid="splash-windows-notice-text"
      >
        Open Knowledge isn&rsquo;t supported on Windows yet.
      </p>
      <SplashGithubLink githubUrl={githubUrl} />
    </div>
  );
}

function SplashGithubLink({ githubUrl }: { githubUrl: string }) {
  return (
    <a
      href={githubUrl}
      data-testid="splash-github-cta"
      rel="noopener noreferrer"
      target="_blank"
      className="inline-flex w-fit touch-manipulation items-center gap-1.5 font-mono text-sm uppercase tracking-wide text-slide-muted transition-colors hover:text-slide-text focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slide-accent"
    >
      View on GitHub
      <ArrowUpRight className="size-3.5" aria-hidden="true" />
    </a>
  );
}
