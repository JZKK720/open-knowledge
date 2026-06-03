import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';

const { AssetPreview } = await import('./AssetPreview.tsx');

describe('AssetPreview — text-viewer dispatch', () => {
  afterEach(() => {
    cleanup();
  });

  test('mediaKind=text on a json asset mounts TextViewer (not the fallback)', () => {
    const { container } = render(<AssetPreview assetPath="docs/sample.json" mediaKind="text" />);
    expect(container.querySelector('[data-text-viewer]')).not.toBeNull();
    expect(container.querySelector('[data-text-viewer-extension="json"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="asset-preview-open-as-text"]')).toBeNull();
  });

  test('fallback pane exposes both "Open file" + "Open with built-in text editor"', () => {
    const { container } = render(<AssetPreview assetPath="docs/data.zip" mediaKind={null} />);
    expect(container.querySelector('a[href*="/api/asset"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="asset-preview-open-as-text"]')).not.toBeNull();
    expect(container.querySelector('[data-text-viewer]')).toBeNull();
  });

  test('clicking "Open with built-in text editor" flips into the text branch', () => {
    const { container } = render(<AssetPreview assetPath="docs/report.pdf" mediaKind={null} />);
    const btn = container.querySelector(
      '[data-testid="asset-preview-open-as-text"]',
    ) as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    fireEvent.click(btn as HTMLButtonElement);
    expect(container.querySelector('[data-text-viewer]')).not.toBeNull();
    expect(container.querySelector('[data-text-viewer-extension="pdf"]')).not.toBeNull();
  });
});
