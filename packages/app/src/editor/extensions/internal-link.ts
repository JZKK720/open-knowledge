import {
  assertNeverLinkTarget,
  classifyMarkdownHref,
  extractAssetExtension,
  LinkFidelity,
  resolveAssetProjectPath,
} from '@inkeep/open-knowledge-core';
import { type Editor, mergeAttributes } from '@tiptap/core';
import { createElement } from 'react';
import { resolveLinkTargetIntent } from '../../components/link-target-intent';
import { dispatchAssetClick } from '../asset-dispatch';
import {
  openHashHrefInNewTab,
  openInternalHashHrefInNewTab,
  toInternalHashHref,
} from '../internal-link-helpers';
import { getPageListCache } from '../page-list-cache';
import { createAssetContextMenuPlugin } from '../plugins/asset-context-menu';
import { isSafeNavigationUrl } from '../safe-navigation-url';
import { InternalLinkPropPanel } from './InternalLinkPropPanel';
import { isResolvedAssetHref, makeLinkResolutionAttrsComputer } from './link-resolution';
import { linkResolutionDecorationPlugin } from './link-resolution-decoration';
import { createMarkInteractionBridgePlugin, getCurrentMarkInfo } from './mark-interaction-bridge';

export interface InternalLinkOptions {
  docName: string;
}

export const InternalLink = LinkFidelity.extend<InternalLinkOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      docName: '',
    };
  },

  renderHTML({ HTMLAttributes }) {
    const href = typeof HTMLAttributes.href === 'string' ? HTMLAttributes.href : '';
    const ariaLabel = href ? `Link: ${href}` : 'Link';
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-link': '',
        role: 'link',
        tabindex: '0',
        'aria-label': ariaLabel,
        style: 'touch-action: manipulation;',
      }),
      0,
    ];
  },

  addProseMirrorPlugins() {
    const docName = this.options.docName ?? '';
    const handlePrimary = ({
      editor,
      nodeId,
      newTab,
    }: {
      editor: Editor;
      nodeId: string;
      newTab: boolean;
    }): boolean => {
      const info = getCurrentMarkInfo(editor.state, nodeId);
      const href = info?.attrs?.href;
      if (typeof href !== 'string' || !href) return false;

      const sourceForm = info?.attrs?.sourceForm;
      const target = classifyMarkdownHref(href, docName);
      const hrefExt = extractAssetExtension(href);
      const isAssetShape =
        target?.kind === 'asset' || (sourceForm === 'wikiembed' && hrefExt !== null);
      if (isAssetShape) {
        const url = target?.kind === 'asset' ? target.url : href;
        const ext = target?.kind === 'asset' ? target.ext : (hrefExt ?? '');
        const projectRelPath = resolveAssetProjectPath(url, docName);
        if (!projectRelPath) {
          return false;
        }
        const cache = getPageListCache();
        if (cache === null) return false;
        if (
          cache.assetPaths !== undefined &&
          !isResolvedAssetHref(url, docName, cache.assetPaths)
        ) {
          return false;
        }
        void dispatchAssetClick({
          url,
          projectRelPath,
          ext,
          title: projectRelPath.split('/').pop() ?? url,
          forceOsDelegation: newTab,
        });
        return true;
      }

      if (!target) return false;

      switch (target.kind) {
        case 'doc': {
          const cache = getPageListCache();
          const intent = resolveLinkTargetIntent(target.docName, {
            pages: cache?.pages ?? new Set<string>(),
            folderPaths: cache?.folderPaths ?? new Set<string>(),
          });
          if (intent.kind === 'create') return false;
          if (intent.kind === 'navigate' && intent.displayState === 'folder') return false;
          if (newTab) {
            openInternalHashHrefInNewTab({ docName: target.docName, anchor: target.anchor });
          } else {
            window.location.assign(
              toInternalHashHref({ docName: target.docName, anchor: target.anchor }),
            );
          }
          return true;
        }
        case 'anchor':
          if (newTab) {
            openInternalHashHrefInNewTab({ docName, anchor: target.anchor });
          } else {
            window.location.assign(toInternalHashHref({ docName, anchor: target.anchor }));
          }
          return true;
        case 'external':
          if (!isSafeNavigationUrl(target.url)) return false;
          openHashHrefInNewTab(target.url);
          return true;
        default:
          return assertNeverLinkTarget(target);
      }
    };
    return [
      createMarkInteractionBridgePlugin({
        editor: this.editor,
        markTypes: ['link'],
        renderPropPanel: ({ editor, nodeId, deactivate }) =>
          createElement(InternalLinkPropPanel, {
            editor,
            nodeId,
            sourceDocName: docName,
            onClose: deactivate,
            onNavigate: (newTab: boolean) => handlePrimary({ editor, nodeId, newTab }),
          }),
        handlePrimary,
      }),
      linkResolutionDecorationPlugin({
        markTypes: ['link'],
        computeAttrs: makeLinkResolutionAttrsComputer(docName),
      }),
      createAssetContextMenuPlugin({ sourceDocName: docName }),
    ];
  },
});
