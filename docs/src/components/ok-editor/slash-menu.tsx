'use client';

import type { SlashItem } from './slash-items';

export interface SlashMenuProps {
  items: SlashItem[];
  selectedIndex: number;
  onSelect: (item: SlashItem) => void;
  onHoverIndex: (index: number) => void;
}

export function SlashMenu({ items, selectedIndex, onSelect, onHoverIndex }: SlashMenuProps) {
  if (items.length === 0) {
    return (
      <div className="ok-slash-empty" role="status">
        No results
      </div>
    );
  }
  return (
    <div className="ok-slash-menu" role="listbox" aria-label="Insert block">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <button
            type="button"
            key={item.name}
            role="option"
            aria-selected={i === selectedIndex}
            data-active={i === selectedIndex}
            className="ok-slash-item"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item);
            }}
            onMouseEnter={() => onHoverIndex(i)}
          >
            <Icon className="ok-slash-item-icon" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
