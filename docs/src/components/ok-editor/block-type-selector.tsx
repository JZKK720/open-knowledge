'use client';

import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  ChevronDown,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Pilcrow,
  Quote,
  SquareCode,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type BlockType = {
  name: string;
  label: string;
  Icon: typeof Pilcrow;
  isActive: (e: Editor) => boolean;
  run: (e: Editor) => void;
};

const BLOCK_TYPES: BlockType[] = [
  {
    name: 'paragraph',
    label: 'Text',
    Icon: Pilcrow,
    isActive: (e) => e.isActive('paragraph') && !e.isActive('list'),
    run: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    name: 'heading1',
    label: 'Heading 1',
    Icon: Heading1,
    isActive: (e) => e.isActive('heading', { level: 1 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    name: 'heading2',
    label: 'Heading 2',
    Icon: Heading2,
    isActive: (e) => e.isActive('heading', { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    name: 'heading3',
    label: 'Heading 3',
    Icon: Heading3,
    isActive: (e) => e.isActive('heading', { level: 3 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    name: 'bulletList',
    label: 'Bullet List',
    Icon: List,
    isActive: (e) => e.isActive('list', { ordered: false }),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    name: 'orderedList',
    label: 'Ordered List',
    Icon: ListOrdered,
    isActive: (e) => e.isActive('list', { ordered: true }),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    name: 'taskList',
    label: 'Task List',
    Icon: ListTodo,
    isActive: (e) =>
      e.isActive('listItem', { checked: true }) || e.isActive('listItem', { checked: false }),
    run: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    name: 'blockquote',
    label: 'Quote',
    Icon: Quote,
    isActive: (e) => e.isActive('blockquote'),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    name: 'codeBlock',
    label: 'Code Block',
    Icon: SquareCode,
    isActive: (e) => e.isActive('codeBlock'),
    run: (e) => e.chain().focus().toggleCodeBlock({ language: 'js' }).run(),
  },
];

const DEFAULT_TYPE = BLOCK_TYPES[0] as BlockType;

export function BlockTypeSelector({ editor }: { editor: Editor }) {
  const { current, activeStates } = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const activeStates = Object.fromEntries(BLOCK_TYPES.map((b) => [b.name, b.isActive(e)]));
      const current = BLOCK_TYPES.find((b) => activeStates[b.name]) ?? DEFAULT_TYPE;
      return { current, activeStates };
    },
  });
  const CurrentIcon = current.Icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="ok-bubble-blocktype" aria-label="Block type">
          <CurrentIcon className="ok-bubble-icon" />
          <span>{current.label}</span>
          <ChevronDown className="size-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-44">
        {BLOCK_TYPES.map((b) => {
          const Icon = b.Icon;
          return (
            <DropdownMenuItem
              key={b.name}
              className={cn(activeStates[b.name] && 'bg-slide-text/[0.06] text-slide-text')}
              onMouseDown={(e) => e.preventDefault()}
              onSelect={() => b.run(editor)}
            >
              <Icon className="size-4" />
              <span>{b.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
