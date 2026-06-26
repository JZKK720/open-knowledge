'use client';

import type { Editor } from '@tiptap/react';
import {
  BarChart3,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  type LucideIcon,
  Minus,
  Quote,
} from 'lucide-react';

export interface SlashItem {
  name: string;
  label: string;
  icon: LucideIcon;
  aliases?: string[];
  command: (editor: Editor) => void;
}

const CHART_HTML = `<div style="font-family:system-ui,-apple-system,sans-serif;padding:13px 16px 11px;color:var(--foreground)">
  <h3 style="margin:0 0 16px;font-size:15px;font-weight:500">Revenue by region</h3>
  <div id="bars" style="display:flex;align-items:flex-end;gap:14px;height:170px"></div>
  <script>
    var data = [['North', 42], ['South', 58], ['East', 71], ['West', 64], ['Central', 80]];
    var max = Math.max.apply(null, data.map(function (d) { return d[1]; }));
    document.getElementById('bars').innerHTML = data.map(function (d, i) {
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;' +
        'gap:6px;height:100%;justify-content:flex-end">' +
        '<span style="font-size:12px;color:var(--muted-foreground)">' + d[1] + '</span>' +
        '<div style="width:100%;height:' + (d[1] / max * 100) + '%;' +
        'background:var(--chart-' + (i + 1) + ');' +
        'border-radius:var(--radius) var(--radius) 0 0"></div>' +
        '<span style="font-size:12px;color:var(--muted-foreground)">' + d[0] + '</span>' +
        '</div>';
    }).join('');
  </script>
</div>`;

const SLASH_ITEMS: readonly SlashItem[] = [
  {
    name: 'heading1',
    label: 'Heading 1',
    icon: Heading1,
    aliases: ['h1', 'title'],
    command: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    name: 'heading2',
    label: 'Heading 2',
    icon: Heading2,
    aliases: ['h2'],
    command: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    name: 'heading3',
    label: 'Heading 3',
    icon: Heading3,
    aliases: ['h3'],
    command: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    name: 'bulletList',
    label: 'Bullet List',
    icon: List,
    aliases: ['ul', 'unordered'],
    command: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    name: 'orderedList',
    label: 'Numbered List',
    icon: ListOrdered,
    aliases: ['ol', 'ordered', 'numbered'],
    command: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    name: 'taskList',
    label: 'Task List',
    icon: ListTodo,
    aliases: ['todo', 'checklist', 'checkbox'],
    command: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    name: 'blockquote',
    label: 'Quote',
    icon: Quote,
    aliases: ['quote'],
    command: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    name: 'codeBlock',
    label: 'Code Block',
    icon: Code2,
    aliases: ['code', 'fence'],
    command: (e) => e.chain().focus().toggleCodeBlock({ language: 'js' }).run(),
  },
  {
    name: 'separator',
    label: 'Separator',
    icon: Minus,
    aliases: ['hr', 'divider', 'rule'],
    command: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    name: 'chart',
    label: 'Chart',
    icon: BarChart3,
    aliases: ['embed', 'graph', 'html'],
    command: (e) =>
      e
        .chain()
        .focus()
        .insertContent({
          type: 'codeBlock',
          attrs: { language: 'html', meta: 'preview h=230' },
          content: [{ type: 'text', text: CHART_HTML }],
        })
        .run(),
  },
];

export function filterSlashItems(query: string): SlashItem[] {
  if (!query) return [...SLASH_ITEMS];
  const q = query.toLowerCase();
  return SLASH_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.aliases?.some((a) => a.toLowerCase().includes(q)),
  );
}
