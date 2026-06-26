import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { DocumentStats } from '@/lib/document-stats';

mock.module('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: ReactNode }) => <>{children}</>,
  Plural: ({ value, one, other }: { value: number; one: string; other: string }) => (
    <>{value === 1 ? one : other}</>
  ),
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((acc, part, index) => `${acc}${part}${values[index] ?? ''}`, ''),
  }),
}));

mock.module('@/hooks/use-editor-footer-identity', () => ({
  useEditorFooterIdentity: () => null,
}));

const STATS: DocumentStats = { words: 10, chars: 50, tokens: 12 };

async function renderFooter(composerBadge?: { onReopen: () => void } | null) {
  const { EditorFooter } = await import('./EditorFooter');
  return render(<EditorFooter stats={STATS} composerBadge={composerBadge} />);
}

afterEach(() => cleanup());

describe('EditorFooter (Ask AI reopen badge)', () => {
  test('renders the Ask AI badge when composerBadge is set', async () => {
    await renderFooter({ onReopen: () => {} });

    const badge = screen.getByTestId('ask-ai-reopen-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('Ask AI');
    expect(screen.getByText(/words/)).toBeTruthy();
  });

  test('clicking the badge calls onReopen', async () => {
    const onReopen = mock(() => {});
    await renderFooter({ onReopen });

    fireEvent.click(screen.getByTestId('ask-ai-reopen-badge'));

    expect(onReopen).toHaveBeenCalledTimes(1);
  });

  test('no badge when composerBadge is absent', async () => {
    await renderFooter(null);

    expect(screen.queryByTestId('ask-ai-reopen-badge')).toBeNull();
  });
});
