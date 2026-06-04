import { describe, expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('ProjectSwitcher module', () => {
  test('Component module imports cleanly', async () => {
    const mod = await import('./ProjectSwitcher');
    expect(typeof mod.ProjectSwitcher).toBe('function');
    expect(typeof mod.runWithToast).toBe('function');
  });
});

describe('runWithToast (IPC rejection → toast feedback)', () => {
  test('success: no toast.error fires', async () => {
    const { runWithToast } = await import('./ProjectSwitcher');
    const toastApi = { error: mock(() => {}) };
    await runWithToast(() => Promise.resolve(), 'Failed to open.', toastApi);
    expect(toastApi.error).not.toHaveBeenCalled();
  });

  test('Error rejection: toast.error fires with Error.message', async () => {
    const { runWithToast } = await import('./ProjectSwitcher');
    const toastApi = { error: mock(() => {}) };
    await runWithToast(
      () => Promise.reject(new Error('utility failed to boot')),
      'Failed to open.',
      toastApi,
    );
    expect(toastApi.error).toHaveBeenCalledWith('utility failed to boot');
  });

  test('non-Error rejection: toast.error fires with fallback', async () => {
    const { runWithToast } = await import('./ProjectSwitcher');
    const toastApi = { error: mock(() => {}) };
    await runWithToast(() => Promise.reject('network dropped'), 'Failed to open.', toastApi);
    expect(toastApi.error).toHaveBeenCalledWith('Failed to open.');
  });

  test('empty-message Error: toast.error fires with fallback', async () => {
    const { runWithToast } = await import('./ProjectSwitcher');
    const toastApi = { error: mock(() => {}) };
    await runWithToast(() => Promise.reject(new Error('')), 'Failed to open.', toastApi);
    expect(toastApi.error).toHaveBeenCalledWith('Failed to open.');
  });

  test('does not re-throw on rejection (caller awaits without try/catch)', async () => {
    const { runWithToast } = await import('./ProjectSwitcher');
    const toastApi = { error: mock(() => {}) };
    let afterAwait = false;
    await runWithToast(() => Promise.reject(new Error('x')), 'Failed to open.', toastApi);
    afterAwait = true;
    expect(afterAwait).toBe(true);
  });

  test('success path fires NO toast even on the internal setError(null) clear', async () => {
    const { runWithToast } = await import('./ProjectSwitcher');
    const toastApi = { error: mock(() => {}) };
    await runWithToast(() => Promise.resolve(), 'Failed to open.', toastApi);
    expect(toastApi.error).not.toHaveBeenCalled();
  });

  test('falls back to module sonner toast when toastApi is omitted', async () => {
    const { runWithToast } = await import('./ProjectSwitcher');
    await expect(runWithToast(() => Promise.resolve(), 'fallback')).resolves.toBeUndefined();
  });
});

describe('Switch Project affordance (source-level guards)', () => {
  const SRC_PATH = join(__dirname, 'ProjectSwitcher.tsx');
  const src = readFileSync(SRC_PATH, 'utf-8');

  test('renders the Switch Project dropdown item with the correct testid and label', () => {
    expect(src).toContain('data-testid="project-switcher-switch-project"');
    expect(src).toMatch(
      /<DropdownMenuItem[^>]*data-testid="project-switcher-switch-project"[^>]*>[\s\S]*?<Trans>Switch Project<\/Trans>\s*<\/DropdownMenuItem>/,
    );
  });

  test('Switch Project item: onSelect routes through onSwitchProject which calls bridge.navigator.open()', () => {
    const tagRe = /<DropdownMenuItem\b[^>]*data-testid="project-switcher-switch-project"[^>]*>/;
    const tag = src.match(tagRe)?.[0];
    expect(
      tag,
      'DropdownMenuItem with project-switcher-switch-project testid not found',
    ).toBeTruthy();
    expect(tag).toContain('onSelect={onSwitchProject}');

    const handlerRe = /const onSwitchProject = \(\) => \{[\s\S]*?\};/;
    const handler = src.match(handlerRe)?.[0];
    expect(handler, 'onSwitchProject handler definition not found').toBeTruthy();
    expect(handler).toMatch(/bridge\.navigator\.open\(\)/);
  });

  test('the new item sits BELOW "Open folder" (Obsidian-pattern position)', () => {
    const openFolderIdx = src.indexOf('data-testid="project-switcher-open-folder"');
    const switchProjectIdx = src.indexOf('data-testid="project-switcher-switch-project"');
    expect(openFolderIdx).toBeGreaterThan(0);
    expect(switchProjectIdx).toBeGreaterThan(0);
    expect(switchProjectIdx).toBeGreaterThan(openFolderIdx);
  });

  test('Recents row click tags the open call with entryPoint: "recents"', () => {
    expect(src).toMatch(
      /openProject\s*=[\s\S]*?bridge\.project\.open\(\{[^}]*entryPoint:\s*'recents'/,
    );
  });

  test('Open Folder click tags the open call with entryPoint: "pick-existing"', () => {
    expect(src).toMatch(
      /onOpenFolder\s*=[\s\S]*?bridge\.project\.open\(\{[^}]*entryPoint:\s*'pick-existing'/,
    );
  });
});

describe('New project action + footer icons (source-level guards)', () => {
  const SRC_PATH = join(__dirname, 'ProjectSwitcher.tsx');
  const src = readFileSync(SRC_PATH, 'utf-8');

  test('New project item sits at the bottom, below Switch Project', () => {
    const openFolderIdx = src.indexOf('data-testid="project-switcher-open-folder"');
    const switchProjectIdx = src.indexOf('data-testid="project-switcher-switch-project"');
    const newProjectIdx = src.indexOf('data-testid="project-switcher-new-project"');
    expect(newProjectIdx).toBeGreaterThan(switchProjectIdx);
    expect(switchProjectIdx).toBeGreaterThan(openFolderIdx);
  });

  test('New project item routes through onCreateProject', () => {
    const tag = src.match(
      /<DropdownMenuItem\b[^>]*data-testid="project-switcher-new-project"[^>]*>/,
    )?.[0];
    expect(tag, 'New project DropdownMenuItem not found').toBeTruthy();
    expect(tag).toContain('onSelect={onCreateProject}');
  });

  test('onCreateProject closes the menu and opens the create dialog', () => {
    const handler = src.match(/const onCreateProject = \(\) => \{[\s\S]*?\};/)?.[0];
    expect(handler, 'onCreateProject handler not found').toBeTruthy();
    expect(handler).toMatch(/setOpen\(false\)/);
    expect(handler).toMatch(/setCreateProjectOpen\(true\)/);
  });

  test('mounts CreateProjectDialog wired to the create-open state and bridge', () => {
    expect(src).toMatch(
      /<CreateProjectDialog\b[\s\S]*?open=\{createProjectOpen\}[\s\S]*?onOpenChange=\{setCreateProjectOpen\}[\s\S]*?bridge=\{bridge\}/,
    );
  });

  test('each footer item carries a leading icon', () => {
    const itemWithIcon = (testid: string, icon: string) =>
      new RegExp(`<DropdownMenuItem\\b[^>]*data-testid="${testid}"[^>]*>\\s*<${icon}\\b[^>]*/>`);
    expect(src).toMatch(itemWithIcon('project-switcher-open-folder', 'FolderOpen'));
    expect(src).toMatch(itemWithIcon('project-switcher-switch-project', 'LayoutGrid'));
    expect(src).toMatch(itemWithIcon('project-switcher-new-project', 'Plus'));
  });
});

describe('Recent-projects search affordance (source-level guards)', () => {
  const SRC_PATH = join(__dirname, 'ProjectSwitcher.tsx');
  const src = readFileSync(SRC_PATH, 'utf-8');

  test('renders a shadcn InputGroup search field (no raw <input>)', () => {
    expect(src).toContain('data-testid="project-switcher-search"');
    expect(src).toMatch(/<InputGroupInput\b[\s\S]*?data-testid="project-switcher-search"/);
    expect(src).toMatch(/from '@\/components\/ui\/input-group'/);
    expect(src).not.toMatch(/<input\b/);
  });

  test('search field stops keydown propagation so Radix typeahead does not eat it', () => {
    const tag = src.match(/<InputGroupInput\b[\s\S]*?\/>/)?.[0];
    expect(tag, 'InputGroupInput not found').toBeTruthy();
    expect(tag).toMatch(/onKeyDown=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);
  });

  test('filters BEFORE slicing to 10 so matches past the first ten are reachable', () => {
    expect(src).toMatch(/filtered\.slice\(0,\s*10\)/);
    expect(src).not.toMatch(/switchable\.slice\(0,\s*10\)/);
  });

  test('filter matches on both name and path', () => {
    expect(src).toMatch(/r\.name\.toLowerCase\(\)\.includes\(query\)/);
    expect(src).toMatch(/r\.path\.toLowerCase\(\)\.includes\(query\)/);
  });

  test('clears the query when the menu closes', () => {
    expect(src).toMatch(/if\s*\(!next\)\s*setSearch\(''\)/);
  });

  test('renders an announced "No matching projects." empty state for the filtered list', () => {
    const label = src.match(
      /<DropdownMenuLabel\b[^>]*>[\s\S]*?<Trans>No matching projects\.<\/Trans>[\s\S]*?<\/DropdownMenuLabel>/,
    )?.[0];
    expect(label, 'No matching projects label not found').toBeTruthy();
    expect(label).toMatch(/role="status"/);
    expect(label).toMatch(/aria-live="polite"/);
  });

  test('search field renders inside the has-recents branch, after the empty-recents label', () => {
    const emptyRecentsIdx = src.indexOf('No other recent projects.');
    const searchFieldIdx = src.indexOf('data-testid="project-switcher-search"');
    expect(emptyRecentsIdx).toBeGreaterThan(0);
    expect(searchFieldIdx).toBeGreaterThan(emptyRecentsIdx);
  });

  test('scrollable results container contains scroll chaining (overscroll-contain)', () => {
    const div = src.match(/<div className="max-h-64[^"]*overflow-y-auto[^"]*">/)?.[0];
    expect(div, 'scrollable results container not found').toBeTruthy();
    expect(div).toMatch(/overscroll-contain/);
  });
});

describe('macOS dropdown-open regression guard (click-to-open fallback)', () => {
  const SRC_PATH = join(__dirname, 'ProjectSwitcher.tsx');
  const src = readFileSync(SRC_PATH, 'utf-8');

  test('trigger opens from onClick on the Electron host, with a pointerdown guard', () => {
    expect(src).toMatch(/onClick=\{\s*isElectronHost/);
    expect(src).toMatch(/onPointerDown=\{\s*isElectronHost/);
    expect(src).toContain('sawPointerDownRef');
    expect(src).toMatch(/<DropdownMenu\b[^>]*\bmodal=\{false\}/);
  });
});
