import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

mock.module('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

import type { TimelineEntry } from '@inkeep/open-knowledge-core';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TimelineContent } from './TimelinePanel';

function wipEntry(sha: string, author: string): TimelineEntry {
  return {
    sha,
    timestamp: '2026-04-17T00:00:00Z',
    author,
    authorEmail: `${author}@example.test`,
    type: 'wip',
    message: `wip: ${author} edit`,
    contributors: [{ id: author, name: author, docs: ['notes.md'] }],
    checkpoint: null,
  };
}

function checkpointEntry(sha: string): TimelineEntry {
  return {
    sha,
    timestamp: '2026-04-17T00:00:00Z',
    author: 'openknowledge-service',
    authorEmail: 'service@openknowledge.local',
    type: 'checkpoint',
    message: 'checkpoint: cleanup',
    contributors: [],
    checkpoint: null,
  };
}

function upstreamEntry(sha: string): TimelineEntry {
  return {
    sha,
    timestamp: '2026-04-17T00:00:00Z',
    author: 'git-upstream',
    authorEmail: 'upstream@openknowledge.local',
    type: 'upstream',
    message: 'import: upstream sync',
    contributors: [],
    checkpoint: null,
  };
}

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  cleanup();
});

function mockHistory(entries: TimelineEntry[]) {
  globalThis.fetch = mock((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/history')) {
      return Promise.resolve(
        new Response(JSON.stringify({ entries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  }) as never;
}

function renderTimeline() {
  return render(
    <TooltipProvider>
      <TimelineContent docName="notes" diffLayout="unified" onDiffLayoutChange={() => {}} />
    </TooltipProvider>,
  );
}

describe('TimelineContent — actor/system commits only', () => {
  test('filters out checkpoint rows; renders only WIP/system commits', async () => {
    mockHistory([
      wipEntry('a'.repeat(40), 'Alice'),
      checkpointEntry('c'.repeat(40)),
      wipEntry('b'.repeat(40), 'Bob'),
    ]);

    renderTimeline();

    await waitFor(() => {
      expect(screen.getAllByTestId('timeline-entry-expand')).toHaveLength(2);
    });
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.queryByText('checkpoint: cleanup')).toBeNull();
  });

  test('keeps upstream-sync entries visible (exclude-by-type, not a wip allowlist)', async () => {
    mockHistory([wipEntry('a'.repeat(40), 'Alice'), upstreamEntry('u'.repeat(40))]);

    renderTimeline();

    await waitFor(() => {
      expect(screen.getAllByTestId('timeline-entry-expand')).toHaveLength(2);
    });
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Upstream sync')).toBeTruthy();
  });

  test('a checkpoint-only history renders the empty state, never a checkpoint row', async () => {
    mockHistory([checkpointEntry('c'.repeat(40))]);

    renderTimeline();

    await waitFor(() => {
      expect(screen.getByText('No history yet')).toBeTruthy();
    });
    expect(screen.queryAllByTestId('timeline-entry-expand')).toHaveLength(0);
  });

  test('the panel header has no Save Version control', async () => {
    mockHistory([wipEntry('a'.repeat(40), 'Alice')]);

    renderTimeline();

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: /save version/i })).toBeNull();
  });
});
