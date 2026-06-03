import { t } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { TemplateBodyTextarea } from '@/components/TemplateBody';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { saveTemplate } from '@/lib/folder-config-api';

const NAME_RE = /^[A-Za-z0-9_-]+$/;

export function slugifyTemplateName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildTemplateFrontmatter(args: { title: string; description: string }): {
  title?: string;
  description?: string;
} {
  const out: { title?: string; description?: string } = {};
  const title = args.title.trim();
  if (title) out.title = title;
  const description = args.description.trim();
  if (description) out.description = description;
  return out;
}

interface TemplateFormInitial {
  name: string;
  title: string;
  description: string;
  body: string;
}

interface UseTemplateFormArgs {
  mode: 'create' | 'edit';
  folderPath: string;
  initial: TemplateFormInitial;
  existingNames?: ReadonlySet<string>;
  onCommitted: () => void;
}

export interface TemplateFormState {
  mode: 'create' | 'edit';
  title: string;
  slug: string;
  description: string;
  body: string;
  setTitle: (next: string) => void;
  setSlug: (next: string) => void;
  setDescription: (next: string) => void;
  setBody: (next: string) => void;
  markTitleTouched: () => void;
  titleTouched: boolean;
  isSaving: boolean;
  canSubmit: boolean;
  titleInvalid: boolean;
  slugInvalid: boolean;
  slugShadows: boolean;
  trimmedSlug: string;
  fixedName: string;
  submit: () => Promise<void>;
}

export function useTemplateForm({
  mode,
  folderPath,
  initial,
  existingNames,
  onCommitted,
}: UseTemplateFormArgs): TemplateFormState {
  const [title, setTitleState] = useState(initial.title);
  const [slug, setSlugState] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [body, setBody] = useState(initial.body);
  const [saving, setSaving] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);

  function setTitle(next: string) {
    setTitleState(next);
    if (mode === 'create' && !slugManuallyEdited) {
      setSlugState(slugifyTemplateName(next));
    }
  }

  function setSlug(next: string) {
    setSlugState(next);
    setSlugManuallyEdited(true);
  }

  const trimmedTitle = title.trim();
  const trimmedSlug = slug.trim();
  const titleInvalid = trimmedTitle === '';
  const slugInvalid = mode === 'create' && (trimmedSlug === '' || !NAME_RE.test(trimmedSlug));
  const slugShadows =
    mode === 'create' && !slugInvalid && (existingNames?.has(trimmedSlug) ?? false);
  const canSubmit = !saving && !titleInvalid && !slugInvalid;

  async function submit() {
    if (!canSubmit) {
      setTitleTouched(true);
      return;
    }
    setSaving(true);
    const result = await saveTemplate({
      folder: folderPath,
      name: mode === 'create' ? trimmedSlug : initial.name,
      frontmatter: buildTemplateFrontmatter({ title, description }),
      body,
    });
    setSaving(false);
    if (!result.ok) {
      const { error } = result;
      toast.error(
        mode === 'create'
          ? t`Couldn't create template: ${error}`
          : t`Couldn't save template: ${error}`,
      );
      return;
    }
    if (result.warnings.length > 0) {
      toast.warning(result.warnings.join(' '));
    } else if (mode === 'create') {
      toast.success(t`Template "${trimmedTitle}" created`);
    } else {
      toast.success(t`Template saved`);
    }
    onCommitted();
  }

  return {
    mode,
    title,
    slug,
    description,
    body,
    setTitle,
    setSlug,
    setDescription,
    setBody,
    markTitleTouched: () => setTitleTouched(true),
    titleTouched,
    isSaving: saving,
    canSubmit,
    titleInvalid,
    slugInvalid,
    slugShadows,
    trimmedSlug,
    fixedName: initial.name,
    submit,
  };
}

export function TemplateFormFields({
  form,
  bodyPlaceholder,
}: {
  form: TemplateFormState;
  bodyPlaceholder?: string;
}) {
  const { t } = useLingui();
  const nameId = useId();
  const descriptionId = useId();
  const showNameError = form.titleTouched && form.titleInvalid;
  const { fixedName } = form;

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor={nameId}>
          <Trans>Name</Trans>
          <span className="text-destructive">*</span>
        </FieldLabel>
        <Input
          id={nameId}
          data-testid="template-name-input"
          value={form.title}
          onChange={(e) => form.setTitle(e.target.value)}
          onBlur={form.markTitleTouched}
          placeholder={t`Blog post`}
          disabled={form.isSaving}
          aria-invalid={showNameError}
        />
        {showNameError ? (
          <FieldError>
            <Trans>Enter a name for this template.</Trans>
          </FieldError>
        ) : null}
      </Field>
      {form.mode === 'create' ? (
        <DerivedFilename form={form} />
      ) : (
        <p className="text-xs text-muted-foreground">
          <Trans>
            File: <code className="font-mono">{fixedName}.md</code>
          </Trans>
        </p>
      )}
      <Field>
        <FieldLabel htmlFor={descriptionId}>
          <Trans>Description</Trans>
        </FieldLabel>
        <Textarea
          id={descriptionId}
          value={form.description}
          onChange={(e) => form.setDescription(e.target.value)}
          placeholder={t`A short line shown under the name in the template list.`}
          disabled={form.isSaving}
          rows={2}
        />
      </Field>
      <TemplateBodyTextarea
        value={form.body}
        onChange={form.setBody}
        disabled={form.isSaving}
        placeholder={bodyPlaceholder}
      />
    </FieldGroup>
  );
}

function DerivedFilename({ form }: { form: TemplateFormState }) {
  const { t } = useLingui();
  const slugId = useId();
  const [editing, setEditing] = useState(false);
  const showEditor = editing || (form.titleTouched && (form.slugInvalid || form.slugShadows));
  const { slug, trimmedSlug } = form;

  if (!showEditor) {
    if (trimmedSlug === '') return null;
    return (
      <p className="text-xs text-muted-foreground">
        <Trans>
          Saved as <code className="font-mono">{slug}.md</code>
        </Trans>{' '}
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 align-baseline text-xs font-mono uppercase"
          onClick={() => setEditing(true)}
          disabled={form.isSaving}
        >
          <Trans>Edit</Trans>
        </Button>
      </p>
    );
  }

  return (
    <Field>
      <FieldLabel htmlFor={slugId}>
        <Trans>Filename</Trans>
      </FieldLabel>
      <Input
        id={slugId}
        value={slug}
        onChange={(e) => form.setSlug(e.target.value)}
        placeholder={t`blog-post`}
        disabled={form.isSaving}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-invalid={form.slugInvalid}
        className="font-mono"
      />
      {form.slugInvalid ? (
        <FieldError>
          <Trans>
            Use letters, digits, <code className="font-mono">-</code> or{' '}
            <code className="font-mono">_</code> only.
          </Trans>
        </FieldError>
      ) : form.slugShadows ? (
        <FieldDescription className="text-yellow-600 dark:text-yellow-500">
          <Trans>
            A template named <code className="font-mono">{trimmedSlug}</code> already exists here.
            Saving creates a local copy that overrides it for this folder.
          </Trans>
        </FieldDescription>
      ) : (
        <FieldDescription>
          <Trans>The file on disk, and the id agents use. It can't be changed later.</Trans>
        </FieldDescription>
      )}
    </Field>
  );
}
