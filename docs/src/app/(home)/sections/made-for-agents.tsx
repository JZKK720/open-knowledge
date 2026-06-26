import { Hexagon, type LucideIcon, Plug, Search } from 'lucide-react';
import Image from 'next/image';
import { EXAMPLE_KB_SHARE_URL } from '@/lib/site';
import { MarketingButton } from '../marketing-button';
import { Section } from '../section';
import SectionHeading from '../section-heading';
import { MadeForAgentsPreview } from './made-for-agents-preview';

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    icon: Hexagon,
    title: 'Agent skills',
    description: 'Agents know how to navigate, edit and grow your knowledge base out of the box.',
  },
  {
    icon: Plug,
    title: 'Native MCP',
    description: 'Plug your knowledge base into Claude, Cursor, Codex, and other agents.',
  },
  {
    icon: Search,
    title: 'Agentic Search',
    description: 'Help agents find the right content with embeddings and hierarchical RAG.',
  },
];

function FeatureRow({ icon: Icon, title, description }: Feature) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-3.5 gap-y-1 py-5">
      <Icon className="size-5 text-primary" aria-hidden="true" />
      <h3 className="text-lg font-semibold text-slide-text leading-snug">{title}</h3>
      <p className="col-start-2 text-base leading-snug text-slide-muted">{description}</p>
    </div>
  );
}

export function MadeForAgents() {
  return (
    <Section className="container">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className="relative w-full aspect-square overflow-hidden rounded-[28px]">
          <Image
            src="/images/home/pillar-2-gradient.webp"
            alt=""
            aria-hidden
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
          <div
            className="relative z-10 h-full w-full overflow-hidden rounded-[28px] border border-white/20 p-4 backdrop-blur-[20px] md:p-6 lg:p-8 xl:p-12"
            style={{
              backgroundColor: 'rgba(255, 254, 254, 0.18)',
              boxShadow: '6px 6px 24px rgba(153, 173, 205, 0.2)',
            }}
          >
            <div className="h-full w-full overflow-hidden rounded-xl">
              <MadeForAgentsPreview />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-8">
          <SectionHeading
            tag="AI native"
            description="Built-in tools for agents to co-author and understand your knowledge base."
          >
            Made for agents.
          </SectionHeading>
          <div className="flex flex-col divide-y border-y">
            {features.map((feature) => (
              <FeatureRow key={feature.title} {...feature} />
            ))}
          </div>
          <div className="flex justify-start">
            <MarketingButton href={EXAMPLE_KB_SHARE_URL} target="_blank" size="sm">
              Try a template
            </MarketingButton>
          </div>
        </div>
      </div>
    </Section>
  );
}
