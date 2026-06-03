import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TagPillInput } from './tag-pill-input';

interface RenderOpts {
  value?: string[];
  onChange?: (next: string[]) => void;
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
}

function renderInput(opts: RenderOpts = {}) {
  const onChange = opts.onChange ?? mock(() => {});
  const result = render(
    <TooltipProvider>
      <TagPillInput
        value={opts.value ?? []}
        onChange={onChange}
        id={opts.id}
        aria-describedby={opts['aria-describedby']}
        aria-invalid={opts['aria-invalid']}
      />
    </TooltipProvider>,
  );
  return { ...result, onChange };
}

describe('TagPillInput — render-side invalid pill flagging', () => {
  afterEach(() => {
    cleanup();
  });

  test('seed of mixed valid + invalid pills flags only the invalid ones', () => {
    const { container } = renderInput({
      value: ['showcase', '2026', 'has spaces', 'proj/team'],
    });
    const invalid = container.querySelectorAll('[data-tag-invalid="true"]');
    expect(invalid).toHaveLength(2);
    const texts = Array.from(invalid).map((el) => el.textContent ?? '');
    expect(texts.some((t) => t.includes('2026'))).toBe(true);
    expect(texts.some((t) => t.includes('has spaces'))).toBe(true);
  });

  test('invalid pill is wrapped in a Radix Tooltip trigger (content lazy-renders)', () => {
    const { container } = renderInput({ value: ['2026'] });
    const invalidBadge = container.querySelector('[data-tag-invalid="true"]');
    expect(invalidBadge?.getAttribute('data-slot')).toBe('tooltip-trigger');
  });

  test('valid pill is NOT tooltip-wrapped (no extra DOM ceremony for legit tags)', () => {
    const { container } = renderInput({ value: ['showcase'] });
    const badge = container.querySelector('.font-mono')?.closest('[data-slot]');
    expect(badge?.getAttribute('data-slot')).not.toBe('tooltip-trigger');
  });
});

describe('TagPillInput — input-side grammar gate', () => {
  afterEach(() => {
    cleanup();
  });

  test('Enter on invalid input does not commit; draft + role="alert" helper appear', () => {
    const onChange = mock(() => {});
    const { container } = renderInput({ onChange });
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(0);
    expect(input.value).toBe('2026');
    expect(input.getAttribute('data-tag-invalid')).toBe('true');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const alert = container.querySelector('[data-testid="tag-pill-input-error"]');
    expect(alert).not.toBeNull();
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toContain('Tags must start with a letter');
  });

  test('Enter on valid input commits + clears draft + clears any prior rejection state', () => {
    const onChange = mock(() => {});
    const { container } = renderInput({ onChange });
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'showcase' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toEqual(['showcase']);
    expect(input.value).toBe('');
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  test('typing clears rejection state for the next commit attempt', () => {
    const { container } = renderInput();
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(input, { target: { value: '2026r' } });
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  test('Escape clears rejection without committing', () => {
    const onChange = mock(() => {});
    const { container } = renderInput({ onChange });
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(0);
  });

  test('input strips leading `#` before commit (Obsidian-shape paste tolerance)', () => {
    const onChange = mock(() => {});
    const { container } = renderInput({ onChange });
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '#showcase' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toEqual(['showcase']);
    expect(input.value).toBe('');
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  test('post-normalize dedup catches `#`x vs x (no double commit)', () => {
    const onChange = mock(() => {});
    const { container } = renderInput({ value: ['showcase'], onChange });
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '#showcase' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(0);
    expect(input.value).toBe('');
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  test('duplicate tag silently dedupes (no commit, no rejection state)', () => {
    const onChange = mock(() => {});
    const { container } = renderInput({ value: ['showcase'], onChange });
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'showcase' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(0);
    expect(input.value).toBe('');
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });
});

describe('TagPillInput — a11y id wiring (regression: PR #1288 review findings)', () => {
  afterEach(() => {
    cleanup();
  });

  test('grammar-hint id is derived from the caller-supplied `id` prop (per-instance unique)', () => {
    const { container } = renderInput({ id: 'my-tags-field' });
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const alert = container.querySelector('[data-testid="tag-pill-input-error"]');
    expect(alert?.id).toBe('my-tags-field-grammar-hint');
  });

  test('two TagPillInputs on the same page get distinct grammar-hint ids (no static collision)', () => {
    const { container } = render(
      <TooltipProvider>
        <TagPillInput id="left" value={[]} onChange={() => {}} />
        <TagPillInput id="right" value={[]} onChange={() => {}} />
      </TooltipProvider>,
    );
    const [leftInput, rightInput] = container.querySelectorAll('input');
    fireEvent.change(leftInput as HTMLInputElement, { target: { value: '2026' } });
    fireEvent.keyDown(leftInput as HTMLInputElement, { key: 'Enter' });
    fireEvent.change(rightInput as HTMLInputElement, { target: { value: 'has spaces' } });
    fireEvent.keyDown(rightInput as HTMLInputElement, { key: 'Enter' });
    const alerts = container.querySelectorAll('[data-testid="tag-pill-input-error"]');
    expect(alerts).toHaveLength(2);
    expect(alerts[0]?.id).toBe('left-grammar-hint');
    expect(alerts[1]?.id).toBe('right-grammar-hint');
  });

  test('aria-describedby MERGES the caller id with the grammar-hint id (does not clobber)', () => {
    const { container } = renderInput({
      id: 'my-field',
      'aria-describedby': 'my-field-rhf-error',
    });
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const describedby = input.getAttribute('aria-describedby') ?? '';
    const ids = describedby.split(/\s+/).filter(Boolean);
    expect(ids).toContain('my-field-grammar-hint');
    expect(ids).toContain('my-field-rhf-error');
  });

  test('aria-describedby with no rejection just forwards the caller-supplied id', () => {
    const { container } = renderInput({
      id: 'my-field',
      'aria-describedby': 'my-field-rhf-error',
    });
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-describedby')).toBe('my-field-rhf-error');
  });

  test('aria-describedby with neither rejection nor caller id is undefined (no empty string)', () => {
    const { container } = renderInput();
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });
});
