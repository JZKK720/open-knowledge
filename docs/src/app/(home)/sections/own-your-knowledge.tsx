import { GitFork, Laptop, Puzzle } from 'lucide-react';
import FeatureItem from '../feature-item';
import { Section } from '../section';
import SectionHeading from '../section-heading';

const features = [
  {
    icon: Laptop,
    title: 'Local-first',
    description: 'Runs on your machine; private by design.',
  },
  {
    icon: GitFork,
    title: 'Open source',
    description: 'Auditable, self-hostable, & community-built.',
  },
  {
    icon: Puzzle,
    title: 'Platform-agnostic',
    description: 'Use with any agent and any tool.',
  },
];

export function OwnYourKnowledge() {
  return (
    <Section className="container flex flex-col gap-12">
      <SectionHeading
        tag="Privacy first"
        description="Local-first, open source, plain files you own."
      >
        Own your knowledge.
      </SectionHeading>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-12">
        {features.map((feature) => (
          <FeatureItem
            key={feature.title}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
          />
        ))}
      </div>
    </Section>
  );
}
