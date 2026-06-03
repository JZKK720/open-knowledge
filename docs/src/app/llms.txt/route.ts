import { source } from '@/lib/source';

export const revalidate = false;

export async function GET() {
  const pages = source.getPages();
  return new Response(
    [
      '# Open Knowledge',
      '## Docs',
      ...pages.map((page) => `- [${page.data.title}](https://openknowledge.ai${page.url})`),
    ].join('\n\n'),
  );
}
