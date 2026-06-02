/**
 * @-mention system — shared type definitions.
 *
 * The mention system is provider-driven: each `MentionKind` (file, folder,
 * codebase, chat, docs, symbol, url) has its own provider that produces
 * `MentionCandidate` objects for the picker dropdown. The MVP only registers
 * the `file` provider; the rest are extensibility hooks for future kinds.
 *
 * Lifecycle:
 *   1. The detector finds an active `@` in the composer and asks the relevant
 *      provider(s) for `MentionCandidate[]` ranked by the typed query.
 *   2. The dropdown renders those candidates; the user picks one.
 *   3. The pick produces a `MentionToken` — the canonical, send-time form.
 *      Tokens carry provider metadata but strip the search-only fields
 *      (`score`, `indexes`, `groupKey`) that don't survive past pick time.
 *   4. Tokens are what ride along with the message at send time. Re-deriving
 *      a token from a candidate (via `candidateToToken`) is the only sanctioned
 *      way to convert a search result into something the message can carry.
 *
 * The `id` on both candidate and token is a stable string for React keys and
 * dedupe; the `meta` payload is provider-specific (`FileMeta` for files,
 * `FolderMeta` for folders, etc.) and is preserved across the candidate →
 * token boundary.
 */

export type MentionKind = 'file' | 'folder' | 'codebase' | 'chat' | 'docs' | 'symbol' | 'url'

export type MentionIconKey =
  | 'file' | 'folder' | 'markdown' | 'ts' | 'tsx' | 'js' | 'jsx'
  | 'json' | 'yaml' | 'css' | 'html' | 'python' | 'rust' | 'go'
  | 'shell' | 'image' | 'lock' | 'code' | 'globe' | 'chat' | 'docs'

export interface FileMeta {
  absPath: string
  relPath: string
  size?: number
  mtime?: number
}

export interface FolderMeta {
  absPath: string
  relPath: string
  childCount?: number
}

export interface MentionCandidate {
  id: string
  kind: MentionKind
  display: string
  subtitle?: string
  icon: MentionIconKey
  score: number
  indexes: readonly number[]
  meta?: FileMeta | FolderMeta | any
  groupKey: string
}

export interface MentionToken {
  id: string
  kind: MentionKind
  display: string
  subtitle?: string
  icon: MentionIconKey
  meta?: any
}

export function fileTokenId(absPath: string): string {
  return `file:${absPath}`
}

export function candidateToToken(c: MentionCandidate): MentionToken {
  return {
    id: c.id,
    kind: c.kind,
    display: c.display,
    subtitle: c.subtitle,
    icon: c.icon,
    meta: c.meta,
  }
}
