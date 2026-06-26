'use client';

import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { splashOutlineButton, splashSolidButton } from './splash-buttons';
import { SplashCliPopover } from './splash-cli-popover';

export function SplashCliButton({
  installCommand,
  cloneCommand,
  variant = 'outline',
}: {
  installCommand: string;
  cloneCommand?: string;
  variant?: 'primary' | 'outline';
}) {
  return (
    <SplashCliPopover
      installCommand={installCommand}
      cloneCommand={cloneCommand}
      align="start"
      trigger={(open) => (
        <button
          type="button"
          data-testid="splash-cli-trigger"
          className={variant === 'primary' ? splashSolidButton : splashOutlineButton}
        >
          <span className="relative z-[1] whitespace-nowrap font-mono">Open with CLI</span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-5 shrink-0 transition-transform duration-200 motion-reduce:transition-none',
              open && 'rotate-180',
            )}
          />
        </button>
      )}
    />
  );
}
