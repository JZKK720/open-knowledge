import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { source } from '@/lib/source';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout
      tree={source.pageTree}
      {...baseOptions({ wordmarkClassName: 'h-7 w-auto text-(--slide-text)' })}
    >
      {children}
    </DocsLayout>
  );
}
