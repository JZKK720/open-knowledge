'use client';

import { ArrowUp, Check, GitBranch, Globe, Loader2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { ClaudeIcon } from '@/components/icons/claude';
import { CodexBrandIcon } from '@/components/icons/codex';
import { CursorIcon } from '@/components/icons/cursor';
import { OkIcon } from '@/components/ok-icon';
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
const CYCLE_MS = SEGMENTS.reduce((sum, s) => sum + s.ms, 0);

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

export function HeroPreview({
  agentId,
  active = true,
}: {
  agentId: HeroPreviewAgentId;
  active?: boolean;
}) {
  const { label, Icon, brandColor } = AGENT_META[agentId];
  const [state, setState] = useState<State>({
    phase: 'hold',
    userTypedLen: USER_MESSAGE.length,
    agentTypedLen: AGENT_STATUS.length,
    contentStep: 5,
  });

  const [containerRef, inView] = useIsInView<HTMLDivElement>('100px');
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (PAUSED) return;
    if (prefersReducedMotion) return;
    if (!inView) return;
    if (!active) return;
    let raf = 0;
    let lastPhase: Phase | null = null;
    let lastUserLen = -1;
    let lastAgentLen = -1;
    let lastStep = -1;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = (now - start) % CYCLE_MS;
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
  }, [inView, prefersReducedMotion, active]);

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
          - <md: slider — both panels sit side-by-side in a 200%-wide track that
            translates between scenes.
          - md+: side-by-side at a fixed natural size (1024×576), scaled via
            `transform: scale(calc(100cqw / 1024px))` to fit the card. Container
            queries (cqw) drive the scale, so the layout stays at its natural
            readable proportions and just shrinks/grows proportionally. */}
      <div className="relative h-full w-full overflow-hidden md:flex md:items-center md:justify-center md:[container-type:size] lg:block lg:[container-type:normal]">
        <div
          className={cn(
            'flex h-full w-[200%] transition-transform duration-500 ease-out',
            mobileScene === 'editor' ? '-translate-x-1/2' : 'translate-x-0',
            'md:h-[576px] md:w-[1024px] md:flex-none',
            'md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)] md:grid-rows-1',
            'md:translate-x-0 md:transition-none',
            'md:[transform-origin:center_center]',
            'md:[transform:scale(min(1,calc(100cqw_/_1024px),calc(100cqh_/_576px)))]',
            'lg:h-full lg:w-full lg:[transform:none]',
          )}
        >
          <div className="flex h-full w-1/2 shrink-0 flex-col md:contents">
            <ChatPanel
              AgentIcon={Icon}
              brandColor={brandColor}
              agentLabel={label}
              phase={state.phase}
              userTypedLen={state.userTypedLen}
              agentTypedLen={state.agentTypedLen}
            />
          </div>
          <div className="flex h-full w-1/2 shrink-0 flex-col md:block md:w-auto md:p-2">
            <EditorPanel
              phase={state.phase}
              contentStep={state.contentStep}
              AgentIcon={Icon}
              brandColor={brandColor}
              agentLabel={label}
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
    <div className="flex h-full min-h-0 flex-col border-b border-border md:border-b-0">
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
                className="ml-px inline-block h-[0.9em] w-[1.5px] translate-y-[1px] animate-pulse bg-slide-text/60 align-middle"
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
                className="ml-px inline-block h-[0.9em] w-[1.5px] translate-y-[1px] animate-pulse bg-slide-text/60 align-middle"
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
  phase,
  contentStep,
  AgentIcon,
  brandColor,
  agentLabel,
}: {
  phase: Phase;
  contentStep: number;
  AgentIcon: typeof ClaudeIcon;
  brandColor: string | undefined;
  agentLabel: string;
}) {
  const agentConnected =
    phase === 'tool-appear' ||
    phase === 'tool-filling' ||
    phase === 'tool-done' ||
    phase === 'hold';

  const highlight: 'peak' | 'active' | 'none' =
    phase === 'tool-done'
      ? 'peak'
      : phase === 'tool-appear' || phase === 'tool-filling'
        ? 'active'
        : 'none';

  const showHeading = contentStep >= 1 && phase !== 'reset';
  const showCheck1 = contentStep >= 2 && phase !== 'reset';
  const showCheck2 = contentStep >= 3 && phase !== 'reset';
  const showCheck3 = contentStep >= 4 && phase !== 'reset';
  const showCallout = contentStep >= 5 && phase !== 'reset';

  const isFilled =
    phase === 'tool-done' || phase === 'hold' || (phase === 'reset' && contentStep === 5);
  const wordCount = isFilled ? 76 : 44;
  const charCount = isFilled ? 385 : 235;
  const tokenCount = Math.ceil(charCount / 4);

  const editorScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phase === 'reset') return;
    const el = editorScrollRef.current;
    if (!el) return;
    const scroll = () => {
      const top = phase === 'rest' || contentStep === 0 ? 0 : el.scrollHeight;
      el.scrollTo({ top, behavior: 'smooth' });
    };
    scroll();
    const t = window.setTimeout(scroll, 450);
    return () => window.clearTimeout(t);
  }, [phase, contentStep]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-slide-bg-elevated md:overflow-hidden md:rounded-lg md:shadow-[0_0px_48px_-16px_rgba(35,31,32,0.18)]">
      {/* Editor sub-header — row 1: URL bar; row 2: mode toggle + presence avatar */}
      <div className="relative flex shrink-0 flex-col gap-3 px-4 py-3 text-left">
        <div className="flex items-center gap-2 rounded-md bg-slide-text/[0.04] px-3 py-1.5 text-[11.5px] text-slide-muted">
          <Globe className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">https://openknowledge.ai/{DOC_PATH}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <span className="flex items-center gap-1.5 truncate text-[11px] text-slide-muted">
            <OkIcon className="size-[18px] shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">OpenKnowledge</span>
          </span>
          <div className="justify-self-center">
            <ModeTogglePreview />
          </div>
          <div
            className="flex justify-self-end transition-opacity duration-300"
            style={{ opacity: agentConnected ? 1 : 0 }}
            aria-hidden={!agentConnected}
          >
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
        ref={editorScrollRef}
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-hidden px-6 pt-1 pb-4 text-left"
      >
        <div className="flex flex-col gap-2.5 text-1sm">
          <PropertyRow label="title" value="Launch week recap" />
          <PropertyRow
            label="tags"
            value={
              <span className="inline-flex flex-wrap gap-1.5">
                {['#launch', '#retro', '#v2'].map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-slide-accent/10 px-2 py-[2px] text-xs font-medium text-slide-accent"
                  >
                    {t}
                  </span>
                ))}
              </span>
            }
          />
        </div>

        <h4 className="text-lg font-semibold text-slide-text">Launch week recap</h4>

        <p className="text-sm leading-relaxed text-slide-muted">
          v2.0 went public on June 3 — the end of a quiet QA window and the start of launch week.
        </p>

        <p className="text-sm leading-relaxed text-slide-muted">
          47 PRs merged across the cycle. Activity stayed close to zero through QA, then spiked on
          launch day as the announcement went live.
        </p>

        {/* The section the agent writes */}
        <div className="flex flex-col gap-2">
          <RevealRow visible={showHeading}>
            <h5
              className={cn(
                'text-sm font-semibold text-slide-text rounded transition-colors duration-500',
                highlight === 'peak' && 'bg-primary/15 px-1 -mx-1',
                highlight === 'active' && 'bg-primary/10 px-1 -mx-1',
              )}
            >
              Highlights
            </h5>
          </RevealRow>

          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-slide-text mb-3">
            <RevealRow visible={showCheck1}>
              <TaskItem highlight={highlight}>Shipped v2.0 to public on Jun 3</TaskItem>
            </RevealRow>
            <RevealRow visible={showCheck2}>
              <TaskItem highlight={highlight}>1.4k new signups in the first 24 hours</TaskItem>
            </RevealRow>
            <RevealRow visible={showCheck3}>
              <TaskItem highlight={highlight}>Hit #1 on Product Hunt and front of HN</TaskItem>
            </RevealRow>
          </ul>

          <RevealRow visible={showCallout} maxHeight="340px">
            <DailyActivityChart visible={showCallout} />
          </RevealRow>
        </div>
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
        {/* Invisible placeholder pins width; visible text swaps on isFilled */}
        <span className="relative inline-grid">
          <span className="invisible col-start-1 row-start-1" aria-hidden="true">
            76 words · 385 chars · ~97 tokens
          </span>
          <span className="col-start-1 row-start-1">
            {wordCount} words · {charCount} chars · ~{tokenCount} tokens
          </span>
        </span>
      </div>
    </div>
  );
}

function RevealRow({
  visible,
  children,
  maxHeight = '160px',
}: {
  visible: boolean;
  children: React.ReactNode;
  maxHeight?: string;
}) {
  return (
    <div
      className="overflow-hidden transition-[opacity,max-height,transform] duration-400 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        maxHeight: visible ? maxHeight : '0px',
        transform: visible ? 'translateY(0)' : 'translateY(4px)',
      }}
      aria-hidden={!visible}
    >
      {children}
    </div>
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

function TaskItem({
  children,
  highlight,
}: {
  children: React.ReactNode;
  highlight: 'peak' | 'active' | 'none';
}) {
  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden="true"
        className="mt-[0.3em] size-4 shrink-0 rounded-[3px] border-[1.5px] border-border bg-transparent"
      />
      <span
        className={cn(
          'flex-1 rounded transition-colors duration-500',
          highlight === 'peak' && 'bg-primary/15 px-1 -mx-1',
          highlight === 'active' && 'bg-primary/10 px-1 -mx-1',
        )}
      >
        {children}
      </span>
    </li>
  );
}

function DailyActivityChart({ visible }: { visible: boolean }) {
  const data = [
    11, 4, 1, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0.5, 0, 0, 0, 0, 1, 1.2, 1, 24, 8, 1, 0.2, 0,
    0.5, 0,
  ];
  const max = 24;
  const yTicks = [0, 6, 12, 18, 24];
  const xLabels: ReadonlyArray<readonly [number, string]> = [
    [0, 'May 10'],
    [15, 'May 25'],
    [30, 'Jun 9'],
  ];

  const W = 480;
  const H = 150;
  const padL = 22;
  const padR = 6;
  const padT = 6;
  const padB = 18;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const xAt = (i: number) => padL + (i / (data.length - 1)) * innerW;
  const yAt = (v: number) => padT + innerH - (v / max) * innerH;
  const baseline = yAt(0);

  const pts = data.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
  let linePath = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c1y = Math.min(baseline, p1.y + (p2.y - p0.y) / 6);
    const c2y = Math.min(baseline, p2.y - (p3.y - p1.y) / 6);
    linePath += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(2)} ${baseline.toFixed(2)} L ${pts[0].x.toFixed(2)} ${baseline.toFixed(2)} Z`;

  const gradientId = useId();

  return (
    <figure className="flex flex-col gap-3.5 rounded-xl bg-slide-bg p-4">
      <figcaption className="text-[12.5px] font-medium text-slide-text/80">
        PRs merged per day · last 30 days
      </figcaption>
      <div
        className="overflow-hidden transition-[clip-path] duration-1200 ease-out"
        style={{ clipPath: visible ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)' }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block h-auto w-full"
          aria-label="Daily PRs merged, May 10 to June 9, peaking at 24 on June 3"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--slide-accent)" stopOpacity={0.24} />
              <stop offset="100%" stopColor="var(--slide-accent)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {yTicks.map((t) => (
            <line
              key={t}
              x1={padL}
              x2={W - padR}
              y1={yAt(t)}
              y2={yAt(t)}
              className="stroke-slide-text/4"
              strokeWidth={1}
            />
          ))}
          {yTicks.map((t) => (
            <text
              key={t}
              x={padL - 4}
              y={yAt(t)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-slide-muted"
              style={{ fontSize: 8 }}
            >
              {t}
            </text>
          ))}
          {xLabels.map(([i, label]) => (
            <text
              key={label}
              x={xAt(i)}
              y={H - 4}
              textAnchor="middle"
              className="fill-slide-muted"
              style={{ fontSize: 8 }}
            >
              {label}
            </text>
          ))}
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path
            d={linePath}
            fill="none"
            stroke="var(--slide-accent)"
            strokeWidth={1.4}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </figure>
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
