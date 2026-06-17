import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const TERMINAL_CONSENT_COPY = {
  title: 'Enable a terminal for this project?',
  body: [
    "This runs a real terminal inside Open Knowledge — the same as opening Terminal on your Mac — starting in this project's folder.",
    "Commands you run have the full access of your macOS user account: they can read, change, or delete your files, install software, and use the network. Open Knowledge doesn't limit or sandbox what the terminal can do.",
    "This stays on only for this project on this Mac. It's never included when you sync, clone, or share the project, and you can turn it off anytime in Settings.",
  ],
  enable: 'Enable terminal',
  notNow: 'Not now',
} as const;

interface TerminalConsentDialogProps {
  readonly open: boolean;
  readonly onAccept: () => void;
  readonly onDecline: () => void;
}

export function TerminalConsentDialog({ open, onAccept, onDecline }: TerminalConsentDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDecline();
      }}
    >
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{TERMINAL_CONSENT_COPY.title}</DialogTitle>
          {/* All three paragraphs live in the description (Radix wires it to
              `aria-describedby`) so a screen reader announces the actual risk —
              "full access… no sandbox" — on open, not just the first line.
              `asChild` makes the description a <div> so multiple <p> children
              are valid markup. */}
          <DialogDescription asChild>
            <div className="space-y-3">
              <p>{TERMINAL_CONSENT_COPY.body[0]}</p>
              <p className="text-1sm">{TERMINAL_CONSENT_COPY.body[1]}</p>
              <p className="text-1sm">{TERMINAL_CONSENT_COPY.body[2]}</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onDecline}>
            {TERMINAL_CONSENT_COPY.notNow}
          </Button>
          <Button onClick={onAccept}>{TERMINAL_CONSENT_COPY.enable}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
