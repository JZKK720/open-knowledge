import { ChatGptIcon } from '@/components/icons/chatgpt';
import { ClaudeIcon } from '@/components/icons/claude';
import { CodexIcon } from '@/components/icons/codex';
import { CursorIcon } from '@/components/icons/cursor';

const AGENTS = [
  { name: 'Claude', Icon: ClaudeIcon },
  { name: 'Cursor', Icon: CursorIcon },
  { name: 'Codex', Icon: CodexIcon },
  { name: 'ChatGPT', Icon: ChatGptIcon },
] as const;

export function AgentIcons() {
  return (
    <div className="not-prose my-6 flex flex-wrap items-center gap-6">
      {AGENTS.map(({ name, Icon }) => (
        <div key={name} className="flex items-center gap-2 text-fd-muted-foreground">
          <Icon className="size-6" aria-hidden="true" />
          <span className="text-sm font-medium">{name}</span>
        </div>
      ))}
    </div>
  );
}
