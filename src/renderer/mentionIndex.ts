// @-mention file indexer — pure, side-effect-free path math.
//
// Extracted from `useMentionSearch.ts` so it can be unit-tested without pulling
// in the icon module's `Icons.tsx` chain (which uses TS syntax that Node 24.14's
// `--experimental-strip-types` can't handle, e.g. `as const`). The hook is the
// only consumer in production code; the test imports this directly.

import type { TreeNode } from '../shared/api';

export const ROOT_GROUP_KEY = '__root__';

export interface IndexedFile {
  absPath: string;
  relPath: string;
  basename: string;
  topLevel: string;
  mtime: number;
}

const MENTION_TEXT_EXTS = new Set([
  'txt', 'md', 'markdown',
  'py', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
  'json', 'jsonc', 'yaml', 'yml', 'toml',
  'html', 'htm', 'css', 'scss', 'sass', 'less', 'xml', 'svg',
  'csv', 'tsv', 'log',
  'sh', 'bash', 'zsh', 'fish', 'ps1',
  'rb', 'go', 'rs', 'java', 'kt', 'swift',
  'c', 'cpp', 'cc', 'h', 'hpp', 'm', 'mm',
  'sql', 'ini', 'conf', 'env',
  'gitignore', 'gitattributes', 'dockerfile', 'lock',
  'properties', 'gradle', 'cmake',
]);

const MENTION_EXTENSIONLESS = new Set([
  'Makefile', 'Dockerfile', 'README', 'LICENSE', 'NOTICE', 'CHANGELOG',
  'CODEOWNERS', 'Gemfile', 'Rakefile', 'Procfile',
]);

function lowerExt(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return '';
  return name.slice(dot + 1).toLowerCase();
}

function isMentionableName(name: string): boolean {
  const ext = lowerExt(name);
  if (ext) return MENTION_TEXT_EXTS.has(ext);
  return MENTION_EXTENSIONLESS.has(name);
}

function hasDotfileSegment(posixPath: string): boolean {
  for (let i = 0; i < posixPath.length; i++) {
    if (posixPath.charCodeAt(i) === 47 && i + 1 < posixPath.length && posixPath.charCodeAt(i + 1) === 46) {
      return true;
    }
  }
  return false;
}

// Main sends paths in the OS-native form (backslashes on Windows). The renderer
// is POSIX-only by convention (see `pathUtils.ts`), so we normalize to forward
// slashes before doing any prefix/slice math. The original `n.id` is preserved
// on the resulting `IndexedFile.absPath` because `window.api.readFile` (and the
// rest of the IPC surface) expects the native form.
function toPosix(p: string): string {
  return p.indexOf('\\') >= 0 ? p.replace(/\\/g, '/') : p;
}

export function buildIndexedList(tree: TreeNode[], workspacePath: string | null): IndexedFile[] {
  const out: IndexedFile[] = [];
  const posixWs = workspacePath ? toPosix(workspacePath) : null;
  const walk = (ns: TreeNode[]) => {
    for (const n of ns) {
      if (n.children) {
        walk(n.children);
        continue;
      }
      const posixId = toPosix(n.id);
      if (hasDotfileSegment(posixId)) continue;
      if (!isMentionableName(n.name)) continue;
      const relPath = posixWs && posixId.startsWith(posixWs + '/')
        ? posixId.slice(posixWs.length + 1)
        : posixId;
      const slash = relPath.lastIndexOf('/');
      const basename = slash >= 0 ? relPath.slice(slash + 1) : relPath;
      const firstSlash = relPath.indexOf('/');
      const topLevel = firstSlash >= 0 ? relPath.slice(0, firstSlash) : ROOT_GROUP_KEY;
      out.push({ absPath: n.id, relPath, basename, topLevel, mtime: n.mtime });
    }
  };
  walk(tree);
  out.sort((a, b) => a.basename.localeCompare(b.basename, undefined, { sensitivity: 'base' }));
  return out;
}
