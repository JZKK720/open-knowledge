import { source } from '@/lib/source';

export const revalidate = false;

export async function GET() {
  const pages = source.getPages();

  const scan = pages.map(async (page) => {
    const processed = await page.data.getText('processed');

    return `# ${page.data.title} (${page.url})

${page.data.description || ''}

${processed}`;
  });
  const scanned = await Promise.all(scan);

  return new Response(scanned.join('\n\n'));
}
