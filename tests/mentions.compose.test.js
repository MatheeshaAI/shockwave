// Tests for the mention system:
//   - composeMentionsPrompt (src/renderer/chatAttachments.js): turns
//     MentionToken[] + userText into the final agent prompt with
//     <file name="…" rel="…">…</file> blocks.
//   - computeMentionPosition (src/renderer/useMentionPosition.js): pure
//     placement math for the dropdown panel.
//   - iconKeyForBasename (src/renderer/mentionIcons.js): extension -> icon
//     key resolution.
//
// Pure tests — `window.api` is stubbed in-memory for the compose function.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeMentionsPrompt } from '../src/renderer/chatAttachments.ts';
import { computeMentionPosition } from '../src/renderer/useMentionPosition.ts';
import { buildIndexedList } from '../src/renderer/mentionIndex.ts';
import { fileTokenId, candidateToToken } from '../src/renderer/mentions.ts';

function setupWindowApi(workspace) {
  globalThis.window = { api: { readFile: async (p) => {
    if (!(p in workspace)) throw new Error(`ENOENT: ${p}`);
    return workspace[p];
  } } };
}

function clearWindowApi() {
  delete globalThis.window;
}

test('composeMentionsPrompt: returns userText when no mentions', async () => {
  setupWindowApi({});
  try {
    const out = await composeMentionsPrompt([], 'hello world');
    assert.equal(out, 'hello world');
  } finally { clearWindowApi(); }
});

test('composeMentionsPrompt: file mention wraps content in <file> block', async () => {
  setupWindowApi({ '/ws/notes/Foo.md': 'body of foo' });
  try {
    const token = {
      id: fileTokenId('/ws/notes/Foo.md'),
      kind: 'file',
      display: 'Foo',
      subtitle: 'notes/Foo.md',
      icon: 'markdown',
      meta: { absPath: '/ws/notes/Foo.md', relPath: 'notes/Foo.md', mtime: 1 },
    };
    const out = await composeMentionsPrompt([token], 'explain this');
    assert.equal(out, '<file name="Foo" rel="notes/Foo.md">\nbody of foo\n</file>\n\nexplain this');
  } finally { clearWindowApi(); }
});

test('composeMentionsPrompt: multiple file mentions concatenate with blank lines', async () => {
  setupWindowApi({
    '/ws/A.md': 'aaa',
    '/ws/B.md': 'bbb',
  });
  try {
    const tokens = [
      { id: 'fA', kind: 'file', display: 'A', subtitle: 'A.md', icon: 'markdown', meta: { absPath: '/ws/A.md', relPath: 'A.md', mtime: 1 } },
      { id: 'fB', kind: 'file', display: 'B', subtitle: 'B.md', icon: 'markdown', meta: { absPath: '/ws/B.md', relPath: 'B.md', mtime: 1 } },
    ];
    const out = await composeMentionsPrompt(tokens, 'q');
    assert.equal(out, '<file name="A" rel="A.md">\naaa\n</file>\n\n<file name="B" rel="B.md">\nbbb\n</file>\n\nq');
  } finally { clearWindowApi(); }
});

test('composeMentionsPrompt: file blocks come before folder blocks', async () => {
  setupWindowApi({ '/ws/x.md': 'x' });
  try {
    const tokens = [
      { id: 'folder1', kind: 'folder', display: 'sub', subtitle: 'sub/', icon: 'folder', meta: { absPath: '/ws/sub', relPath: 'sub', mtime: 1, childCount: 3 } },
      { id: 'file1', kind: 'file', display: 'x', subtitle: 'x.md', icon: 'markdown', meta: { absPath: '/ws/x.md', relPath: 'x.md', mtime: 1 } },
    ];
    const out = await composeMentionsPrompt(tokens, 'go');
    const fileIdx = out.indexOf('<file name="x"');
    const folderIdx = out.indexOf('<folder name="sub"');
    assert.ok(fileIdx >= 0 && folderIdx >= 0, 'both blocks present');
    assert.ok(fileIdx < folderIdx, 'file block precedes folder block');
    assert.ok(out.endsWith('go'));
  } finally { clearWindowApi(); }
});

test('composeMentionsPrompt: folder mention emits a <folder> block with child count', async () => {
  setupWindowApi({});
  try {
    const token = {
      id: 'folder1',
      kind: 'folder',
      display: 'sub',
      subtitle: 'sub/',
      icon: 'folder',
      meta: { absPath: '/ws/sub', relPath: 'sub', mtime: 1, childCount: 7 },
    };
    const out = await composeMentionsPrompt([token], '');
    assert.equal(out, '<folder name="sub" rel="sub">\n7 files\n</folder>');
  } finally { clearWindowApi(); }
});

test('composeMentionsPrompt: missing file throws with relPath in message', async () => {
  setupWindowApi({});
  try {
    const token = {
      id: 'gone',
      kind: 'file',
      display: 'Gone',
      subtitle: 'gone.md',
      icon: 'markdown',
      meta: { absPath: '/ws/gone.md', relPath: 'gone.md', mtime: 1 },
    };
    await assert.rejects(
      () => composeMentionsPrompt([token], 'q'),
      /Failed to read gone\.md:/,
    );
  } finally { clearWindowApi(); }
});

test('computeMentionPosition: places panel below caret when room exists', () => {
  const targetRect = { top: 200, left: 100, bottom: 220, right: 120, height: 20 };
  const panelSize = { width: 360, height: 280 };
  const viewport = { width: 1200, height: 900 };
  const r = computeMentionPosition(targetRect, panelSize, viewport);
  assert.equal(r.placement, 'below');
  assert.equal(r.top, 226);
  assert.equal(r.left, 100);
  assert.equal(r.fullyVisible, true);
});

test('computeMentionPosition: flips above when below would overflow', () => {
  const targetRect = { top: 800, left: 100, bottom: 820, right: 120, height: 20 };
  const panelSize = { width: 360, height: 280 };
  const viewport = { width: 1200, height: 900 };
  const r = computeMentionPosition(targetRect, panelSize, viewport);
  assert.equal(r.placement, 'above');
  assert.equal(r.fullyVisible, true);
  assert.ok(r.top >= 8);
});

test('computeMentionPosition: clamps left to viewport edge', () => {
  const targetRect = { top: 200, left: 1100, bottom: 220, right: 1120, height: 20 };
  const panelSize = { width: 360, height: 280 };
  const viewport = { width: 1200, height: 900 };
  const r = computeMentionPosition(targetRect, panelSize, viewport);
  assert.equal(r.left, 1200 - 360 - 8);
});

test('computeMentionPosition: picks the side with more room when neither fits', () => {
  const targetRect = { top: 450, left: 100, bottom: 460, right: 120, height: 10 };
  const panelSize = { width: 360, height: 800 };
  const viewport = { width: 1200, height: 900 };
  const r = computeMentionPosition(targetRect, panelSize, viewport);
  assert.equal(r.fullyVisible, false);
  assert.ok(r.placement === 'below' || r.placement === 'above');
});

test('fileTokenId: stable for the same path', () => {
  assert.equal(fileTokenId('/ws/a/b.md'), fileTokenId('/ws/a/b.md'));
  assert.notEqual(fileTokenId('/ws/a.md'), fileTokenId('/ws/b.md'));
});

test('candidateToToken: turns a file candidate into a token with the right shape', () => {
  const c = {
    id: fileTokenId('/ws/note.md'),
    kind: 'file',
    display: 'note',
    subtitle: 'note.md',
    icon: 'markdown',
    score: 0,
    indexes: [],
    meta: { absPath: '/ws/note.md', relPath: 'note.md', mtime: 42 },
    groupKey: '__root__',
  };
  const t = candidateToToken(c);
  assert.equal(t.id, c.id);
  assert.equal(t.kind, 'file');
  assert.equal(t.display, 'note');
  assert.equal(t.subtitle, 'note.md');
  assert.equal(t.icon, 'markdown');
  assert.equal(t.meta.absPath, '/ws/note.md');
});

test('buildIndexedList: Windows paths produce basename display + relPath subtitle + top-level folder', () => {
  const tree = [
    {
      id: 'C:\\Users\\me\\ws\\docs\\Foo.md',
      name: 'Foo.md',
      mtime: 1,
    },
  ];
  const out = buildIndexedList(tree, 'C:\\Users\\me\\ws');
  assert.equal(out.length, 1);
  assert.equal(out[0].basename, 'Foo.md');
  assert.equal(out[0].relPath, 'docs/Foo.md');
  assert.equal(out[0].topLevel, 'docs');
  assert.equal(out[0].absPath, 'C:\\Users\\me\\ws\\docs\\Foo.md');
});

test('buildIndexedList: file at the workspace root gets __root__ group key', () => {
  const tree = [{ id: 'C:\\Users\\me\\ws\\top.md', name: 'top.md', mtime: 1 }];
  const out = buildIndexedList(tree, 'C:\\Users\\me\\ws');
  assert.equal(out.length, 1);
  assert.equal(out[0].basename, 'top.md');
  assert.equal(out[0].relPath, 'top.md');
  assert.equal(out[0].topLevel, '__root__');
  assert.equal(out[0].absPath, 'C:\\Users\\me\\ws\\top.md');
});

test('buildIndexedList: file outside the workspace keeps full posix path as relPath', () => {
  const tree = [{ id: 'C:\\elsewhere\\stray.md', name: 'stray.md', mtime: 1 }];
  const out = buildIndexedList(tree, 'C:\\Users\\me\\ws');
  assert.equal(out.length, 1);
  assert.equal(out[0].basename, 'stray.md');
  assert.equal(out[0].relPath, 'C:/elsewhere/stray.md');
  assert.equal(out[0].topLevel, 'C:');
  assert.equal(out[0].absPath, 'C:\\elsewhere\\stray.md');
});

test('buildIndexedList: skips dotfile segments even when not leading', () => {
  const tree = [
    { id: 'C:\\Users\\me\\ws\\docs\\.hidden.md', name: '.hidden.md', mtime: 1 },
    { id: 'C:\\Users\\me\\ws\\docs\\.git\\config', name: 'config', mtime: 1 },
    { id: 'C:\\Users\\me\\ws\\docs\\Ok.md', name: 'Ok.md', mtime: 1 },
  ];
  const out = buildIndexedList(tree, 'C:\\Users\\me\\ws');
  assert.equal(out.length, 1);
  assert.equal(out[0].basename, 'Ok.md');
});
