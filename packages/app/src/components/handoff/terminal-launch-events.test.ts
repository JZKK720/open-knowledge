import { describe, expect, test } from 'bun:test';
import { requestTerminalLaunch, subscribeToTerminalLaunchRequests } from './terminal-launch-events';

describe('terminal-launch-events', () => {
  test('delivers the composed prompt from request to subscriber', () => {
    const target = new EventTarget();
    const received: string[] = [];
    const unsub = subscribeToTerminalLaunchRequests((p) => received.push(p), target);

    requestTerminalLaunch("Let's work on `foo.md` using Open Knowledge.", target);
    expect(received).toEqual(["Let's work on `foo.md` using Open Knowledge."]);

    unsub();
    requestTerminalLaunch('after unsubscribe', target);
    expect(received).toHaveLength(1);
  });
});
