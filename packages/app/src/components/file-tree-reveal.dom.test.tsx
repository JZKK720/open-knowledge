import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { useEffect } from 'react';

const FILE_TREE_TAG_NAME = 'file-tree-container';
mock.module('@pierre/trees', () => ({ FILE_TREE_TAG_NAME }));

const { revealActiveRow } = await import('./file-tree-reveal');

afterEach(cleanup);

type RevealModel = { getFocusedIndex: () => number; getItemHeight: () => number };

function RevealHarness({ host, model }: { host: HTMLElement | null; model: RevealModel }) {
  useEffect(() => {
    revealActiveRow(host, model);
  }, [host, model]);
  return null;
}

interface FakeHostOptions {
  viewportHeight: number;
  scrollTop: number;
  withScrollEl?: boolean;
}

function buildHost({ viewportHeight, scrollTop, withScrollEl = true }: FakeHostOptions) {
  const host = document.createElement('div');
  const container = document.createElement(FILE_TREE_TAG_NAME);
  const shadow = container.attachShadow({ mode: 'open' });
  let scrollEl: HTMLElement | null = null;
  if (withScrollEl) {
    scrollEl = document.createElement('div');
    scrollEl.setAttribute('data-file-tree-virtualized-scroll', 'true');
    Object.defineProperty(scrollEl, 'clientHeight', { value: viewportHeight, configurable: true });
    let stored = scrollTop;
    Object.defineProperty(scrollEl, 'scrollTop', {
      get: () => stored,
      set: (v: number) => {
        stored = v;
      },
      configurable: true,
    });
    shadow.appendChild(scrollEl);
  }
  host.appendChild(container);
  return { host, scrollEl };
}

function stubModel(focusedIndex: number, itemHeight = 24) {
  return { getFocusedIndex: () => focusedIndex, getItemHeight: () => itemHeight };
}

describe('revealActiveRow (via the reveal effect)', () => {
  test('walks the shadow DOM and scrolls a below-fold row into view', () => {
    const { host, scrollEl } = buildHost({ viewportHeight: 240, scrollTop: 0 });
    render(<RevealHarness host={host} model={stubModel(30)} />);
    expect(scrollEl?.scrollTop).toBe(504);
  });

  test('no-ops when there is no focused row (index < 0)', () => {
    const { host, scrollEl } = buildHost({ viewportHeight: 240, scrollTop: 120 });
    render(<RevealHarness host={host} model={stubModel(-1)} />);
    expect(scrollEl?.scrollTop).toBe(120);
  });

  test('leaves scrollTop unchanged when the row is already visible', () => {
    const { host, scrollEl } = buildHost({ viewportHeight: 240, scrollTop: 0 });
    render(<RevealHarness host={host} model={stubModel(5)} />); // row 5 spans 120-144
    expect(scrollEl?.scrollTop).toBe(0);
  });

  test('scrolls up when the row lands under the sticky-folder inset', () => {
    const { host, scrollEl } = buildHost({ viewportHeight: 240, scrollTop: 240 });
    render(<RevealHarness host={host} model={stubModel(10)} />);
    expect(scrollEl?.scrollTop).toBe(216);
  });

  test('does not throw when the virtualized scroll element is absent', () => {
    const { host } = buildHost({ viewportHeight: 240, scrollTop: 0, withScrollEl: false });
    expect(() => render(<RevealHarness host={host} model={stubModel(30)} />)).not.toThrow();
  });

  test('no-ops on a null host', () => {
    expect(() => render(<RevealHarness host={null} model={stubModel(30)} />)).not.toThrow();
  });
});
