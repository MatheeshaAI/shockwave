// Chat-sidebar attachment helpers. Pure browser-side: no Node, no IPC.
//
// Pi accepts images natively (ImageContent[]) but has no file primitive, so
// text files are inlined into the prompt at send time. We classify, read, and
// label files here; ChatSidebar owns the state + UI.

import type { MentionToken } from './mentions.js';

const ALLOWED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

const ALLOWED_TEXT_EXTS = new Set([
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

const ALLOWED_EXTENSIONLESS = new Set([
  'Makefile', 'Dockerfile', 'README', 'LICENSE', 'NOTICE', 'CHANGELOG',
  'CODEOWNERS', 'Gemfile', 'Rakefile', 'Procfile',
]);

function lowerExt(name) {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return '';
  return name.slice(dot + 1).toLowerCase();
}

export function classify(file) {
  if (ALLOWED_IMAGE_MIMES.has(file.type)) return 'image';
  const ext = lowerExt(file.name);
  if (ext && ALLOWED_TEXT_EXTS.has(ext)) return 'text';
  if (!ext && ALLOWED_EXTENSIONLESS.has(file.name)) return 'text';
  return null;
}

export async function readAsBase64(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  // btoa wants a binary string. Chunk to avoid stack overflow on large images.
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export async function readAsText(file) {
  return await file.text();
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

let idCounter = 0;
export const nextAttachmentId = () => `att${++idCounter}`;

// Build the prompt text sent to pi: prepend any text-file blocks before the
// user's typed message so the model sees them as context.
export function composePromptText(userText, textAttachments) {
  if (!textAttachments || textAttachments.length === 0) return userText;
  const blocks = textAttachments
    .map((a) => `<file name="${a.name}">\n${a.content}\n</file>`)
    .join('\n\n');
  return userText ? `${blocks}\n\n${userText}` : blocks;
}

// Map image attachments to pi's ImageContent shape.
export function toImageContents(imageAttachments) {
  return imageAttachments.map((a) => ({
    type: 'image',
    data: a.base64,
    mimeType: a.mimeType,
  }));
}

// Read a workspace file and wrap it as a text attachment. Used by the @-mention
// picker: the user types `@`, picks a file from the fuzzy list, and we
// resolve the picked path (absolute, on disk) to an attachment the composer
// can render as a chip and inline into the prompt at send time.
//
// `absPath` must be an absolute file path inside `workspacePath` — the
// caller (mention picker) only ever passes paths it found in the tree, so
// the relPath reduction is just a slice off the workspace prefix. When the
// path doesn't sit under `workspacePath` (defensive — should not happen in
// practice) we fall back to the absolute path as the chip label.
export async function attachFromWorkspacePath(absPath: string, workspacePath: string): Promise<any> {
  if (!absPath) throw new Error('attachFromWorkspacePath: absPath is required');
  if (!workspacePath) throw new Error('attachFromWorkspacePath: workspacePath is required');

  let content: string;
  try {
    content = await window.api.readFile(absPath);
  } catch (err: any) {
    const slash = absPath.lastIndexOf('/');
    const base = slash >= 0 ? absPath.slice(slash + 1) : absPath;
    throw new Error(`Failed to read ${base}: ${err?.message ?? err}`);
  }

  const prefix = workspacePath.endsWith('/') ? workspacePath : workspacePath + '/';
  const relPath = absPath.startsWith(prefix) ? absPath.slice(prefix.length) : absPath;
  // Chip label is the relPath so the user can see where in the workspace
  // the file lives; basenameOf is used in the error path above.

  return {
    id: nextAttachmentId(),
    kind: 'text',
    name: relPath,
    bytes: content.length,
    content,
  };
}

export async function composeMentionsPrompt(
  mentions: MentionToken[],
  userText: string,
): Promise<string> {
  if (!mentions || mentions.length === 0) return userText;

  const fileBlocks: string[] = [];
  const folderBlocks: string[] = [];

  for (const token of mentions) {
    if (token.kind === 'file') {
      const meta = token.meta;
      const rel = meta?.relPath || token.display;
      let content: string;
      try {
        content = await window.api.readFile(meta.absPath);
      } catch (err: any) {
        throw new Error(`Failed to read ${rel}: ${err?.message ?? err}`);
      }
      fileBlocks.push(`<file name="${token.display}" rel="${rel}">\n${content}\n</file>`);
    } else if (token.kind === 'folder') {
      const meta = token.meta;
      const rel = meta?.relPath || token.display;
      const childCount = meta?.childCount ?? 0;
      folderBlocks.push(`<folder name="${token.display}" rel="${rel}">\n${childCount} files\n</folder>`);
    }
  }

  const blocks = [...fileBlocks, ...folderBlocks];
  if (blocks.length === 0) return userText;
  return userText ? `${blocks.join('\n\n')}\n\n${userText}` : blocks.join('\n\n');
}
