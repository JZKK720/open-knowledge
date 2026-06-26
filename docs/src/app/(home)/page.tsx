import type { SoftwareApplication, WithContext } from 'schema-dts';
import { JsonLd } from '@/components/seo/json-ld';
import { DOWNLOAD_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import { SiteFooter } from './footer';
import { CallToAction } from './sections/call-to-action';
import { Collaboration } from './sections/collaboration';
import { Hero } from './sections/hero';
import { MadeForAgents } from './sections/made-for-agents';
import { OwnYourKnowledge } from './sections/own-your-knowledge';
import { PutItToWork } from './sections/put-it-to-work';
import { RichEditing } from './sections/rich-editing';

const softwareAppLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'macOS',
  url: SITE_URL,
  downloadUrl: DOWNLOAD_URL,
  description: SITE_DESCRIPTION,
  isAccessibleForFree: true,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  author: {
    '@type': 'Organization',
    name: 'Inkeep',
    url: 'https://inkeep.com',
  },
  sameAs: 'https://github.com/inkeep/open-knowledge',
} satisfies WithContext<SoftwareApplication>;

export default function HomePage() {
  return (
    <div className="font-[family-name:var(--font-dm-sans)] selection:bg-[var(--slide-accent)]/20">
      <JsonLd json={softwareAppLd} />
      <Hero />
      <RichEditing />
      <MadeForAgents />
      <PutItToWork />
      <Collaboration />
      <OwnYourKnowledge />
      <CallToAction />
      <SiteFooter />
    </div>
  );
}
