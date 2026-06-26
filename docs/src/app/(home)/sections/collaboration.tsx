import { GitBranch, type LucideIcon, MousePointerClick, Share2, Sparkle } from 'lucide-react';
import type { ReactNode, SVGProps } from 'react';
import { ClaudeIcon } from '@/components/icons/claude';
import { CodexBrandMonoIcon } from '@/components/icons/codex';
import { Section } from '../section';
import SectionHeading from '../section-heading';

const CLAUDE_BRAND = '#D97757';

type EditorTint = {
  highlightBg: string;
  badgeBg: string;
  badgeText: string;
};

const CLAUDE_TINT: EditorTint = {
  highlightBg: 'color-mix(in srgb, var(--color-orange-light) 80%, transparent)',
  badgeBg: CLAUDE_BRAND,
  badgeText: '#ffffff',
};

const ALAN_TINT: EditorTint = {
  highlightBg: 'color-mix(in srgb, var(--color-crystal-blue) 70%, transparent)',
  badgeBg: 'var(--color-azure-blue)',
  badgeText: '#ffffff',
};

const CODEX_TINT: EditorTint = {
  highlightBg: 'color-mix(in srgb, var(--color-purple-light) 70%, transparent)',
  badgeBg: '#7c6df0',
  badgeText: '#ffffff',
};

function ShareButton() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-slide-muted"
      aria-hidden="true"
    >
      <Share2 className="size-3" strokeWidth={2} aria-hidden="true" />
      Share
    </span>
  );
}

function PresenceAvatars() {
  return (
    <div className="flex items-center -space-x-2">
      {/* Icon-based "agent" avatars use a white plate + thin colored ring so the
          brand mark stays legible. Text-initial "human" avatars (Alan) keep the
          solid-color treatment so the initial reads at high contrast. */}
      <PresenceAvatar tint={ALAN_TINT} ringClass="ring-slide-bg-elevated">
        <span
          className="text-[11px] font-semibold leading-none"
          style={{ color: ALAN_TINT.badgeText }}
        >
          A
        </span>
      </PresenceAvatar>
      <PresenceAvatar tint={CLAUDE_TINT} ringClass="ring-slide-bg-elevated">
        <ClaudeIcon
          className="size-3.5"
          aria-hidden="true"
          style={{ color: CLAUDE_TINT.badgeText }}
        />
      </PresenceAvatar>
      <PresenceAvatar tint={CODEX_TINT} ringClass="ring-slide-bg-elevated">
        <CodexBrandMonoIcon
          className="size-3"
          aria-hidden="true"
          style={{ color: CODEX_TINT.badgeText }}
        />
      </PresenceAvatar>
    </div>
  );
}

function PresenceAvatar({
  tint,
  ringClass,
  children,
}: {
  tint: EditorTint;
  ringClass: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`flex size-6 items-center justify-center rounded-full ring-2 ${ringClass}`}
      style={{ backgroundColor: tint.badgeBg }}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

function Highlight({
  tint,
  name,
  icon: Icon,
  children,
}: {
  tint: EditorTint;
  name: string;
  icon?: (props: SVGProps<SVGSVGElement>) => ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className="inline rounded-[3px] px-[3px] py-px box-decoration-clone"
      style={{ backgroundColor: tint.highlightBg, color: 'inherit' }}
    >
      {children}
      {/* Inline-block anchor at the trailing edge of the last line. Holds both
          the caret and the floating name badge so they stay glued together when
          the highlight wraps across lines (absolute positioning on the outer
          span otherwise stretches the caret across both line boxes and floats
          the badge over the first line). */}
      <span
        className="relative ml-[1px] inline-block w-[1.5px] align-middle"
        style={{ height: '1.05em' }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0"
          style={{ backgroundColor: tint.badgeBg }}
        />
        <span
          className="absolute bottom-full left-0 z-10 mb-[3px] inline-flex -translate-x-px select-none items-center gap-1 whitespace-nowrap rounded-[6px] px-1.5 py-[3px] text-[11px] font-medium leading-none shadow-sm"
          style={{ backgroundColor: tint.badgeBg, color: tint.badgeText }}
          aria-hidden="true"
        >
          {Icon ? <Icon className="size-3 shrink-0" aria-hidden="true" /> : null}
          {name}
        </span>
      </span>
    </span>
  );
}

function CollaborationPreview() {
  return (
    <div className="w-full rounded-2xl border border-slide-text/8 bg-slide-bg-elevated shadow-[0_18px_48px_-24px_rgba(35,31,32,0.18)]">
      {/* Document chrome — filename + presence */}
      <div className="flex items-center justify-between gap-4 rounded-t-2xl border-b border-slide-text/8 bg-slide-bg/40 px-5 py-3">
        <span className="font-mono text-[12px] text-slide-muted">roadmap.md</span>
        <div className="flex items-center gap-3">
          <ShareButton />
          <PresenceAvatars />
        </div>
      </div>

      {/* Document body */}
      <div className="flex flex-col gap-7 px-7 py-8 sm:px-9 sm:py-10">
        <h3 className="text-2xl font-semibold tracking-tight text-slide-text sm:text-[28px]">
          Q3 Roadmap
        </h3>

        <p className="text-[15px] leading-relaxed text-slide-text/85">
          We&rsquo;re bringing the whole team into{' '}
          <Highlight tint={CLAUDE_TINT} name="Claude">
            one shared workspace
          </Highlight>
          , where people and agents edit the same files instead of losing context in a thread.
        </p>

        <div className="flex flex-col gap-4">
          <span className="text-[15px] font-semibold text-slide-text">This quarter</span>
          <ul className="flex flex-col gap-4 text-[15px] leading-relaxed text-slide-text/85">
            <li className="flex items-start gap-3">
              <Bullet />
              <span>
                Ship the{' '}
                <Highlight tint={ALAN_TINT} name="Alan">
                  collaborative editor
                </Highlight>{' '}
                for docs and spaces
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Bullet />
              <span>One click to share a doc, or a whole workspace</span>
            </li>
            <li className="flex items-start gap-3">
              <Bullet />
              <span>
                <Highlight tint={CODEX_TINT} name="Codex">
                  <span style={{ color: '#5c4dc0' }}>
                    Git-backed sync so history and ownership stay yours
                  </span>
                </Highlight>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Bullet() {
  return (
    <span
      aria-hidden="true"
      className="mt-[10px] inline-block size-[5px] shrink-0 rounded-full bg-slide-muted/50"
    />
  );
}

function FeatureItem({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="size-4 text-slide-muted" aria-hidden="true" />
      <span className="text-sm text-slide-text">{label}</span>
    </div>
  );
}

export function Collaboration() {
  return (
    <Section className="container">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <CollaborationPreview />
        <div className="flex flex-col gap-8">
          <SectionHeading
            tag="Sharing"
            description="One click to share a doc or project with your team. Everything syncs through git, so history and ownership stay yours."
          >
            Collaborate with your team.
          </SectionHeading>
          <div className="flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-6">
            <FeatureItem icon={MousePointerClick} label="1-click share" />
            <FeatureItem icon={GitBranch} label="git-backed sync" />
            <FeatureItem icon={Sparkle} label="Collaborate with AI" />
          </div>
        </div>
      </div>
    </Section>
  );
}
