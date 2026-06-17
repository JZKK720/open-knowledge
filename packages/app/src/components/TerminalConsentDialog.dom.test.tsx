import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

mock.module('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((out, part, index) => `${out}${part}${values[index] ?? ''}`, ''),
  }),
}));

const { TerminalConsentDialog } = await import('./TerminalConsentDialog');

const EXPECTED = {
  title: 'Enable a terminal for this project?',
  para1:
    "This runs a real terminal inside Open Knowledge — the same as opening Terminal on your Mac — starting in this project's folder.",
  para2:
    "Commands you run have the full access of your macOS user account: they can read, change, or delete your files, install software, and use the network. Open Knowledge doesn't limit or sandbox what the terminal can do.",
  para3:
    "This stays on only for this project on this Mac. It's never included when you sync, clone, or share the project, and you can turn it off anytime in Settings.",
  enable: 'Enable terminal',
  notNow: 'Not now',
};

describe('TerminalConsentDialog', () => {
  afterEach(() => cleanup());

  test('renders the HUMAN-APPROVED copy verbatim inside an accessible dialog', () => {
    render(<TerminalConsentDialog open={true} onAccept={() => {}} onDecline={() => {}} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain(EXPECTED.title);
    expect(screen.getByText(EXPECTED.title)).toBeTruthy();
    expect(screen.getByText(EXPECTED.para1)).toBeTruthy();
    expect(screen.getByText(EXPECTED.para2)).toBeTruthy();
    expect(screen.getByText(EXPECTED.para3)).toBeTruthy();
    expect(screen.getByRole('button', { name: EXPECTED.enable })).toBeTruthy();
    expect(screen.getByRole('button', { name: EXPECTED.notNow })).toBeTruthy();
  });

  test('does not render any content when closed', () => {
    render(<TerminalConsentDialog open={false} onAccept={() => {}} onDecline={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(EXPECTED.title)).toBeNull();
  });

  test('"Enable terminal" fires onAccept; never onDecline', async () => {
    const accepts: string[] = [];
    const declines: string[] = [];
    render(
      <TerminalConsentDialog
        open={true}
        onAccept={() => accepts.push('accept')}
        onDecline={() => declines.push('decline')}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: EXPECTED.enable }));
    expect(accepts).toEqual(['accept']);
    expect(declines).toEqual([]);
  });

  test('"Not now" fires onDecline', async () => {
    const accepts: string[] = [];
    const declines: string[] = [];
    render(
      <TerminalConsentDialog
        open={true}
        onAccept={() => accepts.push('accept')}
        onDecline={() => declines.push('decline')}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: EXPECTED.notNow }));
    expect(declines).toEqual(['decline']);
    expect(accepts).toEqual([]);
  });

  test('Escape resolves to the safe choice (decline), never an implicit grant', async () => {
    const accepts: string[] = [];
    const declines: string[] = [];
    render(
      <TerminalConsentDialog
        open={true}
        onAccept={() => accepts.push('accept')}
        onDecline={() => declines.push('decline')}
      />,
    );

    await userEvent.keyboard('{Escape}');
    expect(declines).toEqual(['decline']);
    expect(accepts).toEqual([]);
  });
});
