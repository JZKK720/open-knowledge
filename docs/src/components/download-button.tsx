import { DownloadIcon } from 'lucide-react';
import Link from 'next/link';
import { STABLE_DMG_URL } from '@/lib/download-links';

type DownloadButtonProps = {
  href?: string;
  label?: string;
};

export function DownloadButton({
  href = STABLE_DMG_URL,
  label = 'Download for macOS',
}: DownloadButtonProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="not-prose my-4 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 dark:bg-neutral-100 dark:text-neutral-900"
    >
      {label}
      <DownloadIcon className="size-4" aria-hidden="true" />
    </Link>
  );
}
