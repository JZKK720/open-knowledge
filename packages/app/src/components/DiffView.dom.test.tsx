import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DiffView } from './DiffView';

describe('DiffView oursOverride (FR3)', () => {
  afterEach(() => {
    cleanup();
  });

  test('uses oursOverride as the ours pane content when present', () => {
    const { container } = render(
      <DiffView
        oldContent="# Base\nold paragraph\n"
        newContent="# DEFAULT_NEW\nignored bytes\n"
        oursOverride="# OVERRIDE\nhello world\n"
        layout="unified"
        conflictMode
      />,
    );

    const cmContent = container.querySelector('.cm-content');
    expect(cmContent).not.toBeNull();
    const rendered = cmContent?.textContent ?? '';
    expect(rendered).toContain('OVERRIDE');
    expect(rendered).toContain('hello world');
    expect(rendered).not.toContain('DEFAULT_NEW');
    expect(rendered).not.toContain('ignored bytes');
  });

  test('falls back to newContent when oursOverride is absent', () => {
    const { container } = render(
      <DiffView
        oldContent="# Base\nold paragraph\n"
        newContent="# DEFAULT_NEW\nlegacy bytes\n"
        layout="unified"
        conflictMode
      />,
    );

    const cmContent = container.querySelector('.cm-content');
    expect(cmContent).not.toBeNull();
    const rendered = cmContent?.textContent ?? '';
    expect(rendered).toContain('DEFAULT_NEW');
    expect(rendered).toContain('legacy bytes');
  });

  test('renders conflict merge controls with shadcn Button', async () => {
    const { container } = render(
      <DiffView
        oldContent="# DiffView conflict sample\n\nThe incoming branch replaces the editor copy.\n"
        newContent="# DiffView conflict sample\n\nThe local branch keeps the current editor copy.\n"
        layout="unified"
        conflictMode
      />,
    );

    const accept = await screen.findByRole('button', { name: 'Accept' });
    const reject = await screen.findByRole('button', { name: 'Reject' });
    expect(accept.closest('.cm-chunkButtons')).not.toBeNull();
    expect(reject.closest('.cm-chunkButtons')).not.toBeNull();
    expect(accept.getAttribute('data-slot')).toBe('button');
    expect(reject.getAttribute('data-slot')).toBe('button');
    expect(accept.getAttribute('data-size')).toBe('xs');
    expect(reject.getAttribute('data-size')).toBe('xs');
    expect(accept.getAttribute('data-variant')).toBe('default');
    expect(reject.getAttribute('data-variant')).toBe('destructive');
    expect(container.querySelectorAll('.cm-chunkButtons button[data-slot="button"]').length).toBe(
      2,
    );
    fireEvent.click(accept);
    await screen.findByText('All hunks resolved');
  });
});

describe('DiffView conflict footer height contract', () => {
  afterEach(() => {
    cleanup();
  });

  test('conflictMode publishes --conflict-footer-height on the document root while mounted', () => {
    const { unmount } = render(
      <DiffView
        oldContent="# Base\ntheirs\n"
        newContent="# Base\nours\n"
        layout="unified"
        conflictMode
      />,
    );

    const value = document.documentElement.style.getPropertyValue('--conflict-footer-height');
    expect(value).toBe('0px');

    unmount();
    expect(document.documentElement.style.getPropertyValue('--conflict-footer-height')).toBe('');
  });

  test('non-conflict renders never publish --conflict-footer-height', () => {
    render(<DiffView oldContent="# Base\ntheirs\n" newContent="# Base\nours\n" layout="unified" />);

    expect(document.documentElement.style.getPropertyValue('--conflict-footer-height')).toBe('');
  });
});
