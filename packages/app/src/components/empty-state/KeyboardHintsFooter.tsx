import { Trans } from '@lingui/react/macro';
import { Kbd } from '@/components/ui/kbd';
import { formatShortcut } from '@/lib/keyboard-shortcuts';

export function KeyboardHintsFooter() {
  const shortcut = formatShortcut('command-palette');
  return (
    <p className="text-1sm text-muted-foreground">
      <Kbd>{shortcut}</Kbd>{' '}
      <span>
        <Trans>Search</Trans>
      </span>
    </p>
  );
}
