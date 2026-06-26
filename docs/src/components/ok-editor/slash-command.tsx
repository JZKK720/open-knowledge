'use client';

import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';
import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion';
import { filterSlashItems, type SlashItem } from './slash-items';
import { SlashMenu, type SlashMenuProps } from './slash-menu';

const slashKey = new PluginKey('okSlashCommand');

export const SlashCommand = Extension.create({
  name: 'okSlashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        pluginKey: slashKey,
        char: '/',
        items: ({ query }) => filterSlashItems(query),
        command: ({ editor, range, props: item }) => {
          editor.chain().focus().deleteRange(range).run();
          item.command(editor);
        },
        render: () => {
          let renderer: ReactRenderer<unknown, SlashMenuProps> | null = null;
          let popup: HTMLElement | null = null;
          let current: SuggestionProps<SlashItem> | null = null;
          let selectedIndex = 0;
          let stopAutoUpdate: (() => void) | null = null;

          const anchor = {
            getBoundingClientRect: () => current?.clientRect?.() ?? new DOMRect(),
            get contextElement() {
              return current?.editor.view.dom;
            },
          };

          const reposition = () => {
            if (!popup) return;
            computePosition(anchor, popup, {
              strategy: 'fixed',
              placement: 'bottom-start',
              middleware: [offset(6), flip(), shift({ padding: 8 })],
            }).then(({ x, y }) => {
              if (!popup) return;
              popup.style.left = `${x}px`;
              popup.style.top = `${y}px`;
              const caret = current?.clientRect?.();
              const onScreen = !!caret && caret.bottom > 0 && caret.top < window.innerHeight;
              popup.style.visibility = onScreen ? 'visible' : 'hidden';
            });
          };

          const update = () => {
            if (!renderer || !current) return;
            renderer.updateProps({
              items: current.items,
              selectedIndex,
              onSelect: current.command,
              onHoverIndex: (i: number) => {
                selectedIndex = i;
                update();
              },
            });
          };

          return {
            onStart(props: SuggestionProps<SlashItem>) {
              current = props;
              selectedIndex = 0;
              popup = document.createElement('div');
              popup.className = 'ok-slash-popup';
              popup.style.visibility = 'hidden'; // revealed once positioned
              document.body.appendChild(popup);
              renderer = new ReactRenderer<unknown, SlashMenuProps>(SlashMenu, {
                props: {
                  items: props.items,
                  selectedIndex,
                  onSelect: props.command,
                  onHoverIndex: (i: number) => {
                    selectedIndex = i;
                    update();
                  },
                },
                editor: props.editor,
              });
              popup.appendChild(renderer.element);
              stopAutoUpdate = autoUpdate(anchor, popup, reposition);
            },
            onUpdate(props: SuggestionProps<SlashItem>) {
              current = props;
              selectedIndex = Math.min(selectedIndex, Math.max(0, props.items.length - 1));
              update();
              reposition();
            },
            onKeyDown({ event }: SuggestionKeyDownProps) {
              if (!current || current.items.length === 0) return false;
              const items = current.items;
              if (event.key === 'ArrowDown') {
                selectedIndex = (selectedIndex + 1) % items.length;
                update();
                return true;
              }
              if (event.key === 'ArrowUp') {
                selectedIndex = (selectedIndex - 1 + items.length) % items.length;
                update();
                return true;
              }
              if (event.key === 'Enter' || event.key === 'Tab') {
                const item = items[selectedIndex];
                if (item) current.command(item);
                return true;
              }
              return false;
            },
            onExit() {
              stopAutoUpdate?.();
              renderer?.destroy();
              popup?.remove();
              stopAutoUpdate = null;
              renderer = null;
              popup = null;
              current = null;
              selectedIndex = 0;
            },
          };
        },
      }),
    ];
  },
});
