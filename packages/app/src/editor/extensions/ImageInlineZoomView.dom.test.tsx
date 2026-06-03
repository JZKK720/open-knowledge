import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';

mock.module('react-medium-image-zoom', () => ({
  default: ({
    children,
    wrapElement,
    zoomMargin,
    zoomImg,
  }: {
    children: React.ReactNode;
    wrapElement?: string;
    zoomMargin?: number;
    zoomImg?: { sizes?: string };
  }) => (
    <span
      data-zoom-mock
      data-wrap-element={wrapElement}
      data-zoom-margin={String(zoomMargin)}
      data-zoom-img-sizes={zoomImg !== undefined ? String(zoomImg.sizes) : 'ABSENT'}
    >
      {children}
    </span>
  ),
}));

const { ImageInlineZoomView } = await import('./ImageInlineZoomView');

function makeNode(attrs: { src?: string; alt?: string; title?: string }) {
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  return { node: { attrs } } as any;
}

describe('ImageInlineZoomView — inline-image lightbox wrap', () => {
  afterEach(() => {
    cleanup();
  });

  test('wraps the inline `<img>` in `<Zoom>` with descriptor-side parity args (wrapElement / zoomMargin / zoomImg.sizes)', () => {
    render(<ImageInlineZoomView {...makeNode({ src: '/a.png', alt: 'A', title: 't' })} />);
    const zoom = document.querySelector('[data-zoom-mock]');
    expect(zoom).not.toBeNull();
    expect(zoom?.getAttribute('data-wrap-element')).toBe('span');
    expect(zoom?.getAttribute('data-zoom-margin')).toBe('20');
    expect(zoom?.getAttribute('data-zoom-img-sizes')).toBe('undefined');
  });

  test('outer NodeViewWrapper renders as `<span>` so inline images fit inside a `<p>` (HTML spec compliance)', () => {
    render(<ImageInlineZoomView {...makeNode({ src: '/a.png', alt: 'A' })} />);
    const wrapper = document.querySelector('[data-image-inline-zoom]');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.tagName.toLowerCase()).toBe('span');
  });

  test('outer wrapper carries `data-clipboard-inline-leaf` so clipboard `findDescriptorRoot` skips it', () => {
    render(<ImageInlineZoomView {...makeNode({ src: '/a.png', alt: 'A' })} />);
    const wrapper = document.querySelector('[data-image-inline-zoom]');
    expect(wrapper?.getAttribute('data-clipboard-inline-leaf')).toBe('image');
  });

  test('renders the inner `<img>` with src/alt/title passed through from PM attrs', () => {
    render(
      <ImageInlineZoomView
        {...makeNode({ src: '/assets/cat.png', alt: 'A cat', title: 'Hover' })}
      />,
    );
    const img = document.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('alt')).toBe('A cat');
    expect(img?.getAttribute('title')).toBe('Hover');
  });

  test('alt defaults to empty string when PM attrs has no alt — matches descriptor `Image.tsx` decorative-image contract', () => {
    render(<ImageInlineZoomView {...makeNode({ src: '/a.png' })} />);
    const img = document.querySelector('img');
    expect(img?.getAttribute('alt')).toBe('');
  });

  test('src passes through unchanged when `toDesktopAssetHref` is a no-op (server-absolute URL — non-desktop runtime)', () => {
    render(<ImageInlineZoomView {...makeNode({ src: '/assets/pic.png', alt: '' })} />);
    const img = document.querySelector('img');
    expect(img?.getAttribute('src')).toContain('/assets/pic.png');
  });
});
