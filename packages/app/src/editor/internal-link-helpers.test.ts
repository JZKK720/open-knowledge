import { describe, expect, it, mock } from 'bun:test';
import { handleChipLinkClick, toInternalHashHref } from './internal-link-helpers';

describe('handleChipLinkClick', () => {
  function makeEvent(overrides: Partial<{ metaKey: boolean; ctrlKey: boolean }> = {}) {
    return {
      metaKey: false,
      ctrlKey: false,
      preventDefault: mock(() => {}),
      ...overrides,
    };
  }

  it('bare click: navigates same-tab, suppresses native nav, closes the panel', () => {
    const event = makeEvent();
    const onNavigate = mock((_newTab: boolean) => true);
    const onClose = mock(() => {});

    handleChipLinkClick(event, onNavigate, onClose);

    expect(onNavigate).toHaveBeenCalledWith(false);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Cmd/Ctrl click: navigates new-tab, suppresses native nav, leaves panel open', () => {
    for (const mod of [{ metaKey: true }, { ctrlKey: true }] as const) {
      const event = makeEvent(mod);
      const onNavigate = mock((_newTab: boolean) => true);
      const onClose = mock(() => {});

      handleChipLinkClick(event, onNavigate, onClose);

      expect(onNavigate).toHaveBeenCalledWith(true);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    }
  });

  it('handler declines (non-navigable / unsafe scheme): native <a href> proceeds, panel stays open', () => {
    const event = makeEvent();
    const onNavigate = mock((_newTab: boolean) => false);
    const onClose = mock(() => {});

    handleChipLinkClick(event, onNavigate, onClose);

    expect(onNavigate).toHaveBeenCalledWith(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('toInternalHashHref', () => {
  it('builds standard fragment anchors for document sections', () => {
    expect(toInternalHashHref({ docName: 'docs/guide', anchor: 'install' })).toBe(
      '#/docs/guide#install',
    );
  });

  it('encodes section anchors', () => {
    expect(toInternalHashHref({ docName: 'docs/guide', anchor: 'hello world' })).toBe(
      '#/docs/guide#hello%20world',
    );
  });

  it('omits the fragment for null anchors', () => {
    expect(toInternalHashHref({ docName: 'docs/guide', anchor: null })).toBe('#/docs/guide');
  });
});
