'use client';

import { ArrowUp, Check, GitBranch, Globe, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ClaudeIcon } from '@/components/icons/claude';
import { CodexBrandIcon } from '@/components/icons/codex';
import { CursorIcon } from '@/components/icons/cursor';
import {
  OkEditorBody,
  OkEditorModeToggle,
  OkEditorProvider,
  parseEditorMarkdown,
  useEditorDocStats,
  useOkEditor,
} from '@/components/ok-editor/ok-editor';
import {
  HERO_FRONTMATTER,
  HERO_FRONTMATTER_YAML,
  heroRevealMarkdown,
} from '@/components/ok-editor/seed';
import { OkIcon } from '@/components/ok-icon';
import { OkWordmark } from '@/components/ok-wordmark';
import { useIsInView } from '@/lib/use-is-in-view';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';

const AGENT_META = {
  claude: { label: 'Claude', Icon: ClaudeIcon, brandColor: '#D97757' as string | undefined },
  cursor: {
    label: 'Cursor',
    Icon: CursorIcon,
    brandColor: 'var(--slide-text)' as string | undefined,
  },
  codex: { label: 'Codex', Icon: CodexBrandIcon, brandColor: '#7A9DFF' as string | undefined },
} as const;

export type HeroPreviewAgentId = keyof typeof AGENT_META;

const AGENT_IDS = Object.keys(AGENT_META) as HeroPreviewAgentId[];

const PAUSED = false;

const USER_MESSAGE = 'Help me write up our launch week';
const AGENT_STATUS = 'Drafting your launch recap in OpenKnowledge.';
const DOC_PATH = 'retros/launch-week';
const TOOL_NAME = 'open-knowledge · write';
const TOOL_SUMMARY = 'Create recap + add daily activity chart';

type Phase =
  | 'rest'
  | 'user-typing'
  | 'agent-status'
  | 'tool-appear'
  | 'tool-filling'
  | 'tool-done'
  | 'hold'
  | 'reset';

const SEGMENTS: ReadonlyArray<{ phase: Phase; ms: number }> = [
  { phase: 'rest', ms: 800 },
  { phase: 'user-typing', ms: 800 },
  { phase: 'agent-status', ms: 500 },
  { phase: 'tool-appear', ms: 400 },
  { phase: 'tool-filling', ms: 2000 },
  { phase: 'tool-done', ms: 600 },
  { phase: 'hold', ms: 2200 },
  { phase: 'reset', ms: 500 },
];
const RUN_ONCE_MS = SEGMENTS.filter((s) => s.phase !== 'reset').reduce((sum, s) => sum + s.ms, 0);

const FINAL_STATE: State = {
  phase: 'hold',
  userTypedLen: USER_MESSAGE.length,
  agentTypedLen: AGENT_STATUS.length,
  contentStep: 5,
};

const FILL_THRESHOLDS_MS = [0, 450, 900, 1350] as const;

type State = {
  phase: Phase;
  userTypedLen: number;
  agentTypedLen: number;
  contentStep: number;
};

function computeState(elapsed: number): State {
  let cursor = 0;
  for (const seg of SEGMENTS) {
    if (elapsed < cursor + seg.ms) {
      const local = elapsed - cursor;
      const localProgress = local / seg.ms;
      return computeStateForSegment(seg.phase, local, localProgress);
    }
    cursor += seg.ms;
  }
  return {
    phase: 'hold',
    userTypedLen: USER_MESSAGE.length,
    agentTypedLen: AGENT_STATUS.length,
    contentStep: 5,
  };
}

function computeStateForSegment(phase: Phase, local: number, localProgress: number): State {
  switch (phase) {
    case 'rest':
      return { phase, userTypedLen: 0, agentTypedLen: 0, contentStep: 0 };
    case 'user-typing':
      return {
        phase,
        userTypedLen: Math.floor(localProgress * USER_MESSAGE.length),
        agentTypedLen: 0,
        contentStep: 0,
      };
    case 'agent-status':
      return {
        phase,
        userTypedLen: USER_MESSAGE.length,
        agentTypedLen: Math.floor(localProgress * AGENT_STATUS.length),
        contentStep: 0,
      };
    case 'tool-appear':
      return {
        phase,
        userTypedLen: USER_MESSAGE.length,
        agentTypedLen: AGENT_STATUS.length,
        contentStep: 1,
      };
    case 'tool-filling': {
      let step = 1;
      for (let i = 0; i < FILL_THRESHOLDS_MS.length; i++) {
        if (local >= FILL_THRESHOLDS_MS[i]) step = 2 + i;
      }
      return {
        phase,
        userTypedLen: USER_MESSAGE.length,
        agentTypedLen: AGENT_STATUS.length,
        contentStep: step,
      };
    }
    case 'tool-done':
    case 'hold':
      return {
        phase,
        userTypedLen: USER_MESSAGE.length,
        agentTypedLen: AGENT_STATUS.length,
        contentStep: 5,
      };
    case 'reset':
      return {
        phase,
        userTypedLen: USER_MESSAGE.length,
        agentTypedLen: AGENT_STATUS.length,
        contentStep: 5,
      };
  }
}

export function HeroPreview({ activeAgentId }: { activeAgentId: HeroPreviewAgentId }) {
  const activeAgent = AGENT_META[activeAgentId];
  const [state, setState] = useState<State>(() => computeState(0));
  const [animationDone, setAnimationDone] = useState(false);

  const [containerRef, inView] = useIsInView<HTMLDivElement>('100px');
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (PAUSED) return;
    if (animationDone) return;
    if (prefersReducedMotion) {
      setState(FINAL_STATE);
      setAnimationDone(true);
      return;
    }
    if (!inView) return;
    let raf = 0;
    let lastPhase: Phase | null = null;
    let lastUserLen = -1;
    let lastAgentLen = -1;
    let lastStep = -1;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= RUN_ONCE_MS) {
        setState(FINAL_STATE);
        setAnimationDone(true);
        return;
      }
      const next = computeState(elapsed);
      if (
        next.phase !== lastPhase ||
        next.userTypedLen !== lastUserLen ||
        next.agentTypedLen !== lastAgentLen ||
        next.contentStep !== lastStep
      ) {
        lastPhase = next.phase;
        lastUserLen = next.userTypedLen;
        lastAgentLen = next.agentTypedLen;
        lastStep = next.contentStep;
        setState(next);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, prefersReducedMotion, animationDone]);

  const mobileScene: 'chat' | 'editor' =
    state.phase === 'rest' ||
    state.phase === 'user-typing' ||
    state.phase === 'agent-status' ||
    state.phase === 'tool-appear'
      ? 'chat'
      : 'editor';

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full bg-[#fdfdfc] font-(family-name:--font-inter)"
    >
      {/* Two layout modes:
          - <lg: single-pane slider — both panels sit side-by-side in a 200%-wide
            track that translates between scenes (one visible at a time, full size).
          - lg+: both panels side-by-side, filling the card. */}
      <div className="relative h-full w-full overflow-hidden">
        <div
          className={cn(
            'flex h-full w-[200%]',
            prefersReducedMotion ? '' : 'transition-transform duration-500 ease-out',
            mobileScene === 'editor' ? '-translate-x-1/2' : 'translate-x-0',
            'lg:grid lg:h-full lg:w-full lg:flex-none lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)] lg:grid-rows-1',
            'lg:translate-x-0 lg:transition-none',
          )}
        >
          {/* Chat cell — one chat panel per agent, stacked and cross-faded. All
              share the single animation state; only the active agent's branding
              is visible, so switching agents just cross-fades the chat. */}
          <div className="relative h-full w-1/2 shrink-0 lg:w-auto">
            {AGENT_IDS.map((id) => {
              const meta = AGENT_META[id];
              return (
                <div
                  key={id}
                  aria-hidden={activeAgentId !== id}
                  className={cn(
                    'absolute inset-0 transition-opacity duration-500 ease-out',
                    activeAgentId === id ? 'opacity-100' : 'pointer-events-none opacity-0',
                  )}
                >
                  <ChatPanel
                    AgentIcon={meta.Icon}
                    brandColor={meta.brandColor}
                    agentLabel={meta.label}
                    phase={state.phase}
                    userTypedLen={state.userTypedLen}
                    agentTypedLen={state.agentTypedLen}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex h-full w-1/2 shrink-0 flex-col lg:block lg:w-auto lg:p-2">
            <EditorPanel
              contentStep={state.contentStep}
              AgentIcon={activeAgent.Icon}
              brandColor={activeAgent.brandColor}
              agentLabel={activeAgent.label}
              animationDone={animationDone}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Window chrome
 * --------------------------------------------------------------------------- */

function TrafficLights() {
  return (
    <div className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
      <span className="size-[11px] rounded-full bg-[#ff5f57]" />
      <span className="size-[11px] rounded-full bg-[#febc2e]" />
      <span className="size-[11px] rounded-full bg-[#28c840]" />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Chat panel (left)
 * --------------------------------------------------------------------------- */

function ChatPanel({
  AgentIcon,
  brandColor,
  agentLabel,
  phase,
  userTypedLen,
  agentTypedLen,
}: {
  AgentIcon: typeof ClaudeIcon;
  brandColor: string | undefined;
  agentLabel: string;
  phase: Phase;
  userTypedLen: number;
  agentTypedLen: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const userTyped = USER_MESSAGE.slice(0, userTypedLen);
  const userRest = USER_MESSAGE.slice(userTypedLen);
  const agentTyped = AGENT_STATUS.slice(0, agentTypedLen);
  const agentRest = AGENT_STATUS.slice(agentTypedLen);

  const showUserBubble = userTypedLen > 0;
  const showUserCaret = phase === 'user-typing';
  const showAgentLine =
    phase === 'agent-status' ||
    phase === 'tool-appear' ||
    phase === 'tool-filling' ||
    phase === 'tool-done' ||
    phase === 'hold';
  const showAgentCaret = phase === 'agent-status';
  const showToolCall =
    phase === 'tool-appear' ||
    phase === 'tool-filling' ||
    phase === 'tool-done' ||
    phase === 'hold';
  const showFollowUp = phase === 'tool-done' || phase === 'hold';
  const isResetting = phase === 'reset';

  useEffect(() => {
    if (phase === 'reset') return;
    const el = scrollRef.current;
    if (!el) return;
    const scroll = () => {
      const top = phase === 'rest' ? 0 : el.scrollHeight;
      el.scrollTo({ top, behavior: 'smooth' });
    };
    scroll();
    const t = window.setTimeout(scroll, 350);
    return () => window.clearTimeout(t);
  }, [phase]);

  return (
    <div className="flex h-full min-h-0 flex-col border-b border-border lg:border-b-0">
      {/* Chat sub-header — traffic lights + agent label, only on this side */}
      <div className="flex shrink-0 items-center gap-6 px-4 py-3">
        <TrafficLights />
        <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-slide-muted">
          <AgentIcon className="size-4" aria-hidden="true" style={{ color: brandColor }} />
          <span>{agentLabel}</span>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-hidden px-4 pt-1 pb-3 text-left"
      >
        {/* User bubble */}
        <div
          className="flex justify-end transition-opacity duration-300"
          style={{ opacity: isResetting ? 0 : showUserBubble ? 1 : 0 }}
          aria-hidden={!showUserBubble}
        >
          <div className="max-w-[88%] rounded-2xl rounded-br-sm bg-slide-text/[0.05] px-3 py-2 text-left text-sm leading-snug text-slide-text mb-4">
            <span>{userTyped}</span>
            {showUserCaret && (
              <span
                className="ml-px inline-block h-[0.9em] w-[1.5px] translate-y-[1px] motion-safe:animate-pulse bg-slide-text/60 align-middle"
                aria-hidden="true"
              />
            )}
            <span aria-hidden="true" className="invisible">
              {userRest}
            </span>
          </div>
        </div>

        {/* Agent status line — fades in at Beat 2 */}
        <div
          className="flex items-start gap-2 transition-opacity duration-300"
          style={{ opacity: isResetting ? 0 : showAgentLine ? 1 : 0 }}
          aria-hidden={!showAgentLine}
        >
          <AgentIcon
            className="mt-[3px] size-4 shrink-0"
            aria-hidden="true"
            style={{ color: brandColor }}
          />
          <div className="text-sm leading-snug text-slide-text">
            <span>{agentTyped}</span>
            {showAgentCaret && (
              <span
                className="ml-px inline-block h-[0.9em] w-[1.5px] translate-y-[1px] motion-safe:animate-pulse bg-slide-text/60 align-middle"
                aria-hidden="true"
              />
            )}
            <span aria-hidden="true" className="invisible">
              {agentRest}
            </span>
          </div>
        </div>

        <ToolCallCard phase={phase} visible={showToolCall} isResetting={isResetting} />

        {/* Agent follow-up message after the tool call lands */}
        <div
          className="flex items-start gap-2 transition-opacity duration-300"
          style={{ opacity: isResetting ? 0 : showFollowUp ? 1 : 0 }}
          aria-hidden={!showFollowUp}
        >
          <AgentIcon
            className="mt-[3px] size-4 shrink-0"
            aria-hidden="true"
            style={{ color: brandColor }}
          />
          <div className="text-sm leading-snug text-slide-text">
            Updated <span className="text-primary">{DOC_PATH}.md</span> — added a "Highlights"
            section with three wins and the daily activity chart.
          </div>
        </div>
      </div>

      {/* Mock chat input — pinned below the scrolling messages region */}
      <div className="shrink-0 px-4 pt-2 pb-4">
        <div className="flex items-center gap-2 rounded-xl bg-slide-bg-elevated px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_2px_6px_-2px_rgba(15,23,42,0.06)]">
          <span className="flex-1 text-left text-sm text-slide-muted/60">Ask anything</span>
          <span className="flex size-5 items-center justify-center rounded-full" aria-hidden="true">
            <ArrowUp className="size-3.5 text-slide-muted opacity-60" strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </div>
  );
}

function ToolCallCard({
  phase,
  visible,
  isResetting,
}: {
  phase: Phase;
  visible: boolean;
  isResetting: boolean;
}) {
  const isPending = phase === 'tool-appear' || phase === 'tool-filling';
  const isDone = phase === 'tool-done' || phase === 'hold';
  const cardOpacity = isResetting ? 0 : !visible ? 0 : phase === 'tool-appear' ? 0.85 : 1;

  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl border px-3 py-2 text-left transition-[opacity,transform] duration-300 ease-out"
      style={{
        opacity: cardOpacity,
        transform: phase === 'tool-appear' ? 'translateY(4px)' : 'translateY(0)',
      }}
      aria-hidden={!visible}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 font-mono text-[12px] text-slide-muted">
          <span className="truncate text-slide-text/70">{TOOL_NAME}</span>
        </div>
        {/* Badge sizes to content — the right edge is pinned by the parent's
            justify-between so the tool name's left edge is stable. */}
        {isPending ? (
          <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-slide-muted">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            Calling
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            <Check className="size-3" aria-hidden="true" />
            Done
          </span>
        )}
      </div>
      {/* Line 2 — reserved at zero opacity during pending so the card doesn't jump */}
      <div
        className="flex flex-col gap-1 text-[12px] leading-snug text-slide-muted transition-opacity duration-300"
        style={{ opacity: isDone ? 1 : 0 }}
        aria-hidden={!isDone}
      >
        <span className="font-mono text-slide-text/70">{DOC_PATH}.md</span>
        <span className="text-1sm">{TOOL_SUMMARY}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Editor panel (right) — OpenKnowledge editor
 * --------------------------------------------------------------------------- */

function EditorPanel({
  contentStep,
  AgentIcon,
  brandColor,
  agentLabel,
  animationDone,
}: {
  contentStep: number;
  AgentIcon: typeof ClaudeIcon;
  brandColor: string | undefined;
  agentLabel: string;
  animationDone: boolean;
}) {
  return (
    <OkEditorProvider
      initialMarkdown={heroRevealMarkdown(contentStep)}
      frontmatter={HERO_FRONTMATTER_YAML}
    >
      <div className="flex h-full min-h-0 flex-col bg-slide-bg-elevated lg:overflow-hidden lg:rounded-lg lg:shadow-[0_0px_48px_-16px_rgba(35,31,32,0.18)]">
        {/* Editor sub-header — row 1: URL bar; row 2: mode toggle + presence avatar */}
        <div className="relative flex shrink-0 flex-col gap-3 px-4 py-3 text-left">
          <div className="flex items-center gap-2 rounded-md bg-slide-text/[0.04] px-3 py-1.5 text-[11.5px] text-slide-muted">
            <Globe className="size-3.5 shrink-0 opacity-50" aria-hidden="true" />
            <span className="truncate">https://openknowledge.ai/{DOC_PATH}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <span className="flex items-center gap-1.5 truncate text-[11px] text-slide-muted">
              {/* Icon-only on small screens; the full wordmark lockup on large. */}
              <OkIcon className="size-[24px] shrink-0 lg:hidden" aria-hidden="true" />
              <OkWordmark
                aria-label="OpenKnowledge"
                className="hidden h-[24px] w-auto shrink-0 lg:block"
              />
            </span>
            <div className="justify-self-center">
              {animationDone ? <OkEditorModeToggle /> : <ModeTogglePreview />}
            </div>
            <div className="flex justify-self-end">
              <div
                className="flex size-6 items-center justify-center rounded-full"
                style={{
                  backgroundColor: brandColor
                    ? `color-mix(in srgb, ${brandColor} 18%, transparent)`
                    : undefined,
                }}
                title={`${agentLabel} is editing`}
              >
                <AgentIcon className="size-3.5" aria-hidden="true" style={{ color: brandColor }} />
              </div>
            </div>
          </div>
          {/* Fade beneath the header so document content scrolls in softly. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-full z-10 h-3 bg-linear-to-b from-slide-bg-elevated to-transparent"
          />
        </div>

        <div
          data-revealing={animationDone ? undefined : 'true'}
          className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pt-1 pb-4 text-left subtle-scrollbar"
        >
          <FrontmatterPanel />

          <OkEditorBody />
          <HeroEditorReveal step={contentStep} live={animationDone} />
        </div>

        {/* Word-count footer — pinned below the scrolling document body */}
        <div className="relative flex shrink-0 items-center justify-between bg-slide-bg-elevated px-6 py-2 font-mono text-[11px] text-slide-muted tabular-nums">
          {/* Fade above the footer so document content dissolves into it. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-full h-3 bg-linear-to-t from-slide-bg-elevated to-transparent"
          />
          <span className="flex items-center gap-1">
            <GitBranch size={11} /> main
          </span>
          {/* Invisible placeholder pins a min width; live stats overlay it. */}
          <span className="relative inline-grid">
            <span className="invisible col-start-1 row-start-1" aria-hidden="true">
              76 words · 385 chars · ~97 tokens
            </span>
            <HeroEditorStats />
          </span>
        </div>
      </div>
    </OkEditorProvider>
  );
}

function HeroEditorReveal({ step, live }: { step: number; live: boolean }) {
  const { editor } = useOkEditor();
  const appliedStep = useRef(step);
  useEffect(() => {
    if (!editor) return;
    if (appliedStep.current !== step) {
      appliedStep.current = step;
      const json = parseEditorMarkdown(heroRevealMarkdown(step));
      queueMicrotask(() => {
        if (!editor.isDestroyed) editor.commands.setContent(json);
      });
    }
    editor.setEditable(live);
  }, [editor, step, live]);
  return null;
}

function HeroEditorStats() {
  const { words, chars, tokens } = useEditorDocStats();
  return (
    <span className="col-start-1 row-start-1">
      {words} words · {chars} chars · ~{tokens} tokens
    </span>
  );
}

function PropertyRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-12 shrink-0 text-slide-muted/70">{label}</span>
      <span className="text-slide-text">{value}</span>
    </div>
  );
}

function FrontmatterPanel() {
  const { mode } = useOkEditor();
  if (mode === 'source') return null;
  return (
    <div className="flex flex-col gap-2.5 pl-6 text-1sm">
      <PropertyRow label="title" value={HERO_FRONTMATTER.title} />
      <PropertyRow
        label="tags"
        value={
          <span className="inline-flex flex-wrap gap-1.5">
            {HERO_FRONTMATTER.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-slide-accent/10 px-2 py-[2px] text-xs font-medium text-slide-accent"
              >
                #{t}
              </span>
            ))}
          </span>
        }
      />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * ModeTogglePreview — static mirror of the editor's Visual/Markdown toggle.
 * Mirrors the real ToggleGroup with variant="segmented" size="sm". Pinned to Visual.
 * --------------------------------------------------------------------------- */

function ModeTogglePreview() {
  return (
    <div
      className="inline-flex shrink-0 items-center gap-0.5 rounded-[8px] p-0.5"
      style={{ backgroundColor: 'color-mix(in srgb, var(--slide-text) 5%, transparent)' }}
    >
      <span
        className="flex h-6 items-center gap-1 rounded-[6px] px-1.5 font-mono text-[10px] font-medium uppercase tracking-wide"
        style={{
          color: 'var(--slide-text)',
          backgroundColor: 'var(--slide-bg-elevated)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
        }}
      >
        <TextboxIcon className="size-3 shrink-0" />
        Visual
      </span>
      <span className="flex h-6 items-center gap-1 rounded-[6px] px-1.5 font-mono text-[10px] font-medium uppercase tracking-wide text-slide-muted">
        <MarkdownIcon className="size-3 shrink-0" />
        Markdown
      </span>
    </div>
  );
}

function TextboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M112,40a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80v96a16,16,0,0,0,16,16h80v16a8,8,0,0,0,16,0V48A8,8,0,0,0,112,40ZM24,176V80h80v96ZM248,80v96a16,16,0,0,1-16,16H144a8,8,0,0,1,0-16h88V80H144a8,8,0,0,1,0-16h88A16,16,0,0,1,248,80ZM88,112a8,8,0,0,1-8,8H72v24a8,8,0,0,1-16,0V120H48a8,8,0,0,1,0-16H80A8,8,0,0,1,88,112Z" />
    </svg>
  );
}

function MarkdownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M232,48H24A16,16,0,0,0,8,64V192a16,16,0,0,0,16,16H232a16,16,0,0,0,16-16V64A16,16,0,0,0,232,48Zm0,144H24V64H232V192ZM128,104v48a8,8,0,0,1-16,0V123.31L93.66,141.66a8,8,0,0,1-11.32,0L64,123.31V152a8,8,0,0,1-16,0V104a8,8,0,0,1,13.66-5.66L88,124.69l26.34-26.35A8,8,0,0,1,128,104Zm77.66,18.34a8,8,0,0,1,0,11.32l-24,24a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L168,132.69V104a8,8,0,0,1,16,0v28.69l10.34-10.35A8,8,0,0,1,205.66,122.34Z" />
    </svg>
  );
}
