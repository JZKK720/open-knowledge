'use client';

import { ArrowUpRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { classifySplashOs, type SplashOs, splashCtaLayout } from '@/lib/share-splash';
import { SplashCliButton } from './splash-cli-button';
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
          installCommand={installCommand}
          cloneCommand={cloneCommand}
        />
      )}

      {/* macOS/unknown carries the CLI inside the cluster's Download dropdown.
          Linux has no desktop binary, so the CLI popover IS the primary action,
          with View on GitHub as the secondary in the same row (the invariant
          that every OS keeps a GitHub path — cluster / here / Windows notice). */}
      {layout.cliInline && (
        <div className="mt-12 flex flex-wrap items-center gap-4">
          <SplashCliButton
            installCommand={installCommand}
            cloneCommand={cloneCommand}
            variant="primary"
          />
          {layout.showStandaloneGithub && <SplashGithubLink githubUrl={githubUrl} />}
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
    <div className="mt-12 flex gap-4" role="status" data-testid="splash-windows-notice">
      <p
        className="text-base leading-relaxed text-slide-text"
        data-testid="splash-windows-notice-text"
      >
        OpenKnowledge isn&rsquo;t supported on Windows yet.
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
