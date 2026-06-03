import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { slugifyTemplateName, TemplateFormFields, useTemplateForm } from './TemplateForm';

describe('slugifyTemplateName', () => {
  test('lowercases and hyphenates a human name', () => {
    expect(slugifyTemplateName('Blog post')).toBe('blog-post');
  });

  test('collapses runs of punctuation and whitespace to one hyphen', () => {
    expect(slugifyTemplateName('Weekly  1:1   notes')).toBe('weekly-1-1-notes');
  });

  test('trims leading and trailing hyphens', () => {
    expect(slugifyTemplateName('  Draft!  ')).toBe('draft');
  });

  test('leaves an already-valid slug unchanged', () => {
    expect(slugifyTemplateName('blog-post')).toBe('blog-post');
  });

  test('returns empty when the name has no alphanumeric content', () => {
    expect(slugifyTemplateName('!!!')).toBe('');
  });
});

function CreateFormHarness() {
  const form = useTemplateForm({
    mode: 'create',
    folderPath: '',
    initial: { name: '', title: '', description: '', body: '' },
    existingNames: new Set(),
    onCommitted: () => {},
  });
  return <TemplateFormFields form={form} />;
}

describe('TemplateFormFields — create mode', () => {
  afterEach(() => {
    cleanup();
  });

  test('derives the filename from the name as the user types', async () => {
    const user = userEvent.setup();
    render(<CreateFormHarness />);
    await user.type(screen.getByTestId('template-name-input'), 'My Release Notes');
    expect(screen.getByText('my-release-notes.md')).toBeDefined();
  });

  test('shows the required-name error only after the field is blurred empty', async () => {
    const user = userEvent.setup();
    render(<CreateFormHarness />);
    expect(screen.queryByText('Enter a name for this template.')).toBeNull();
    await user.click(screen.getByTestId('template-name-input'));
    await user.tab();
    expect(screen.getByText('Enter a name for this template.')).toBeDefined();
  });
});
