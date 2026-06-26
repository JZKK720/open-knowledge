import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { OkWordmark } from '@/components/ok-wordmark';

export function baseOptions({
  wordmarkClassName = 'h-8 w-auto text-(--slide-text)',
}: {
  wordmarkClassName?: string;
} = {}): BaseLayoutProps {
  return {
    nav: {
      title: <OkWordmark aria-label="OpenKnowledge" className={wordmarkClassName} />,
    },
    githubUrl: 'https://github.com/inkeep/open-knowledge',
  };
}
