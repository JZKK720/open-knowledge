'use client';

export type EditorMode = 'visual' | 'source';

export function ModeToggle({
  mode,
  onChange,
}: {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
}) {
  return (
    <div className="ok-mode-toggle">
      <button
        type="button"
        aria-pressed={mode === 'visual'}
        aria-label="Visual editor"
        data-active={mode === 'visual'}
        className="ok-mode-toggle-btn"
        onClick={() => onChange('visual')}
      >
        <TextboxIcon className="ok-mode-toggle-icon" />
        Visual
      </button>
      <button
        type="button"
        aria-pressed={mode === 'source'}
        aria-label="Markdown source editor"
        data-active={mode === 'source'}
        className="ok-mode-toggle-btn"
        onClick={() => onChange('source')}
      >
        <MarkdownIcon className="ok-mode-toggle-icon" />
        Markdown
      </button>
    </div>
  );
}

function TextboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M112,40a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80v96a16,16,0,0,0,16,16h80v16a8,8,0,0,0,16,0V48A8,8,0,0,0,112,40ZM24,176V80h80v96ZM248,80v96a16,16,0,0,1-16,16H144a8,8,0,0,1,0-16h88V80H144a8,8,0,0,1,0-16h88A16,16,0,0,1,248,80ZM88,112a8,8,0,0,1-8,8H72v24a8,8,0,0,1-16,0V120H48a8,8,0,0,1,0-16H80A8,8,0,0,1,88,112Z" />
    </svg>
  );
}

function MarkdownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M232,48H24A16,16,0,0,0,8,64V192a16,16,0,0,0,16,16H232a16,16,0,0,0,16-16V64A16,16,0,0,0,232,48Zm0,144H24V64H232V192ZM128,104v48a8,8,0,0,1-16,0V123.31L93.66,141.66a8,8,0,0,1-11.32,0L64,123.31V152a8,8,0,0,1-16,0V104a8,8,0,0,1,13.66-5.66L88,124.69l26.34-26.35A8,8,0,0,1,128,104Zm77.66,18.34a8,8,0,0,1,0,11.32l-24,24a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L168,132.69V104a8,8,0,0,1,16,0v28.69l10.34-10.35A8,8,0,0,1,205.66,122.34Z" />
    </svg>
  );
}
