'use client';

import { Check, Loader2, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ClaudeIcon } from '@/components/icons/claude';
import { useIsInView } from '@/lib/use-is-in-view';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

const CLAUDE_MESSAGE = "I'll capture this as a decision doc.";
const DONE_INTRO = 'Done — edit landed:';
const DONE_PATH = 'decisions/api-strategy.md';
const DONE_SUMMARY = 'Capture API choice decision.';

const TOOL_PARAMS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'docName', value: 'decisions/api-strategy' },
  { label: 'position', value: 'replace' },
  { label: 'summary', value: 'Capture API choice decision' },
];

type TimelineEntry = {
  writer: string;
  timeAgo: string;
  summary: string;
  path: string;
};

const NEW_ENTRY: TimelineEntry = {
  writer: 'claude-code',
  timeAgo: 'just now',
  summary: 'Capture API choice decision',
  path: 'decisions/api-strategy',
};

const PRIOR_ENTRIES: ReadonlyArray<TimelineEntry> = [
  {
    writer: 'claude-code',
    timeAgo: '18 min ago',
    summary: 'Add migration runbook section',
    path: 'runbooks/db-migrations',
  },
  {
    writer: 'claude-code',
    timeAgo: '1 hr ago',
    summary: 'Sync standup notes',
    path: 'team/standup-notes',
  },
];

const STEPS = {
  claudeMessage: 300,
  toolCard: 900,
  param0: 1200,
  param1: 1400,
  param2: 1600,
  calling: 2250,
  done: 2750,
  doneIntro: 3050,
  doneEntry: 3300,
  chatHoldEnd: 4500,

  timelineIn: 4700,

  newEntryIn: 5500,
  newEntryHighlightEnd: 6500,

  fadeOut: 8200,
  cycleEnd: 8800,
} as const;

const REVEAL_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const REVEAL_MS = 480;
const SCENE_MS = 520;

function revealStyle(visible: boolean) {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(6px)',
    transition: `opacity ${REVEAL_MS}ms ${REVEAL_EASE}, transform ${REVEAL_MS}ms ${REVEAL_EASE}`,
  } as const;
}

function dropInStyle(visible: boolean) {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(-10px)',
    transition: `opacity ${REVEAL_MS}ms ${REVEAL_EASE}, transform ${REVEAL_MS}ms ${REVEAL_EASE}`,
  } as const;
}

function DropInNewEntry({ highlighted }: { highlighted: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div style={dropInStyle(mounted)}>
      <TimelineEntryRow entry={NEW_ENTRY} highlighted={highlighted} />
    </div>
  );
}

function TimelineEntryRow({
  entry,
  highlighted = false,
}: {
  entry: TimelineEntry;
  highlighted?: boolean;
}) {
  return (
    <div
      className="rounded-lg border p-2 @[320px]:p-3"
      style={{
        borderColor: highlighted
          ? 'color-mix(in srgb, var(--slide-accent) 55%, transparent)'
          : 'color-mix(in srgb, var(--slide-text) 10%, transparent)',
        backgroundColor: highlighted
          ? 'color-mix(in srgb, var(--slide-accent) 5%, transparent)'
          : 'transparent',
        boxShadow: highlighted
          ? '0 8px 22px -10px color-mix(in srgb, var(--slide-accent) 35%, transparent)'
          : 'none',
        transition: `border-color 700ms ${REVEAL_EASE}, background-color 700ms ${REVEAL_EASE}, box-shadow 700ms ${REVEAL_EASE}`,
      }}
    >
      <div className="flex items-center gap-2">
        <ClaudeIcon className="size-3.5 shrink-0" aria-hidden="true" style={{ color: '#D97757' }} />
        <span className="text-[12px] font-medium text-slide-text">{entry.writer}</span>
        <span className="ml-auto inline-flex items-center gap-2 text-[10px] text-slide-muted">
          {entry.timeAgo}
          <span className="h-3 w-px bg-slide-muted/30" aria-hidden="true" />
          <Undo2 className="size-3" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-1 flex flex-col gap-0.5 pl-[22px] @[320px]:mt-1.5">
        <div className="text-[12px] text-slide-text/90">• {entry.summary}</div>
        <div className="font-mono text-[10px] text-slide-muted/80">{entry.path}</div>
      </div>
    </div>
  );
}

export function MadeForAgentsPreview() {
  const [elapsed, setElapsed] = useState(0);
  const [containerRef, inView] = useIsInView<HTMLDivElement>();
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      setElapsed(STEPS.newEntryIn + 600);
      return;
    }
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      setElapsed((now - start) % STEPS.cycleEnd);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, prefersReducedMotion]);

  const beforeFadeOut = elapsed < STEPS.fadeOut;
  const inChatPhase = elapsed < STEPS.timelineIn;
  const inTimelinePhase = elapsed >= STEPS.timelineIn && beforeFadeOut;

  const showChat = inChatPhase && beforeFadeOut;
  const showTimeline = inTimelinePhase;

  const showClaude = elapsed >= STEPS.claudeMessage && inChatPhase;
  const showTool = elapsed >= STEPS.toolCard && inChatPhase;
  const paramVisible = [
    elapsed >= STEPS.param0 && inChatPhase,
    elapsed >= STEPS.param1 && inChatPhase,
    elapsed >= STEPS.param2 && inChatPhase,
  ] as const;
  const showCalling = elapsed >= STEPS.calling && elapsed < STEPS.done;
  const showDone = elapsed >= STEPS.done && inChatPhase;
  const showDoneIntro = elapsed >= STEPS.doneIntro && inChatPhase;
  const showDoneEntry = elapsed >= STEPS.doneEntry && inChatPhase;

  const showNewEntry = elapsed >= STEPS.newEntryIn && inTimelinePhase;
  const newEntryHighlighted = elapsed >= STEPS.newEntryIn && elapsed < STEPS.newEntryHighlightEnd;

  return (
    <div
      ref={containerRef}
      className="@container relative grid h-full w-full overflow-hidden rounded-xl bg-slide-bg-elevated"
      style={{ gridTemplateAreas: '"scene"' }}
    >
      <div
        aria-hidden={!showChat}
        className="flex flex-col gap-2 p-3 @[320px]:gap-4 @[320px]:p-4 @sm:gap-5 @sm:p-5 @md:gap-6 @md:p-6"
        style={{
          gridArea: 'scene',
          opacity: showChat ? 1 : 0,
          transform: showChat ? 'translateX(0)' : 'translateX(-14px)',
          transition: `opacity ${SCENE_MS}ms ${REVEAL_EASE}, transform ${SCENE_MS}ms ${REVEAL_EASE}`,
          pointerEvents: showChat ? 'auto' : 'none',
        }}
      >
        <div className="flex items-center gap-2">
          <ClaudeIcon className="size-4" aria-hidden="true" style={{ color: '#D97757' }} />
          <span className="text-sm font-medium text-slide-text">Claude</span>
        </div>

        <div style={revealStyle(showClaude)}>
          <p className="text-[13px] leading-relaxed text-slide-muted">{CLAUDE_MESSAGE}</p>
        </div>

        <div
          style={revealStyle(showTool)}
          className="overflow-hidden rounded-lg border border-slide-text/10"
        >
          <div className="flex items-center justify-between border-b border-slide-text/10 px-3 py-2">
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="text-slide-muted">Used</span>
              <span className="text-slide-text">open-knowledge:</span>
              <span className="text-primary">write</span>
            </div>
            <span className="relative inline-flex h-4 min-w-[64px] items-center justify-end font-mono text-[10px] uppercase tracking-wide">
              <span
                className="absolute right-0 inline-flex items-center gap-1.5 text-slide-muted"
                style={{
                  opacity: showCalling ? 1 : 0,
                  transition: `opacity 240ms ${REVEAL_EASE}`,
                }}
              >
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                Calling
              </span>
              <span
                className="absolute right-0 inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
                style={{
                  opacity: showDone ? 1 : 0,
                  transition: `opacity 240ms ${REVEAL_EASE}`,
                }}
              >
                <Check className="size-3" aria-hidden="true" />
                200 ok
              </span>
            </span>
          </div>
          <div className="flex flex-col gap-1 px-3 py-2.5 font-mono text-[11px]">
            {TOOL_PARAMS.map((p, i) => (
              <div
                key={p.label}
                className="flex items-center gap-1.5"
                style={revealStyle(paramVisible[i] ?? false)}
              >
                <span className="text-slide-muted/70">{p.label}</span>
                <span className="text-slide-muted/40">:</span>
                <span className="text-slide-text">{p.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p
            className="text-[13px] leading-relaxed text-slide-muted"
            style={revealStyle(showDoneIntro)}
          >
            {DONE_INTRO}
          </p>
          <div
            className="flex flex-wrap items-baseline gap-x-1.5 text-[13px] leading-relaxed"
            style={revealStyle(showDoneEntry)}
          >
            <span className="text-slide-muted">1.</span>
            <span className="font-medium text-primary">{DONE_PATH}</span>
            <span className="text-slide-muted/60">—</span>
            <span className="text-slide-muted">{DONE_SUMMARY}</span>
          </div>
        </div>
      </div>

      <div
        aria-hidden={!showTimeline}
        className="flex flex-col gap-2 p-3 @[320px]:gap-3 @[320px]:p-4 @sm:p-5 @md:p-6"
        style={{
          gridArea: 'scene',
          opacity: showTimeline ? 1 : 0,
          transform: showTimeline ? 'translateX(0)' : 'translateX(14px)',
          transition: `opacity ${SCENE_MS}ms ${REVEAL_EASE}, transform ${SCENE_MS}ms ${REVEAL_EASE}`,
          pointerEvents: showTimeline ? 'auto' : 'none',
        }}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slide-muted">
          Timeline
        </span>

        <div className="flex flex-col gap-1.5 @[320px]:gap-2">
          {showNewEntry && <DropInNewEntry highlighted={newEntryHighlighted} />}
          {PRIOR_ENTRIES.map((entry) => (
            <TimelineEntryRow key={entry.path} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  );
}
