// @-mention file picker for the chat sidebar composer.
//
// Builds a flat, sorted, extension-filtered index of workspace files and
// exposes a fuzzysort-backed `search` that returns `MentionCandidate`s — the
// picker-agnostic shape the dropdown renders and the picker converts to a
// `MentionToken` at pick time. The compositor owns the popover/keyboard/
// selection state; this hook is read-only and stable across re-renders so
// it can live in App or in a per-sidebar hook.

import { useCallback, useMemo } from 'react';
import fuzzysort from 'fuzzysort';
import type { TreeNode } from '../shared/api';
import { buildIndexedList } from './mentionIndex.js';
import { fileTokenId, type MentionCandidate } from './mentions.js';
import { iconKeyForBasename } from './mentionIcons.js';

const MAX_RESULTS = 50;

export interface MentionSearchResult {
  /** Total files in the index (before the cap). Useful for "X files available" hints. */
  indexedCount: number;
  /** Run a fuzzy query. Empty/whitespace → []. Stable across renders (useCallback). */
  search: (query: string) => MentionCandidate[];
}

export function useMentionSearch(
  tree: TreeNode[],
  workspacePath: string | null,
): MentionSearchResult {
  const indexed = useMemo(() => buildIndexedList(tree, workspacePath), [tree, workspacePath]);

  const search = useCallback((query: string): MentionCandidate[] => {
    const q = query.trim();
    if (!q) return [];
    const ranked = fuzzysort.go(q, indexed as any, { key: 'relPath', limit: MAX_RESULTS });
    return ranked.map((r) => {
      const obj = r.obj as any;
      return {
        id: fileTokenId(obj.absPath),
        kind: 'file' as const,
        display: obj.basename,
        subtitle: obj.relPath,
        icon: iconKeyForBasename(obj.basename),
        score: r.score,
        indexes: r.indexes ?? [],
        meta: {
          absPath: obj.absPath,
          relPath: obj.relPath,
          mtime: obj.mtime,
        },
        groupKey: obj.topLevel,
      };
    });
  }, [indexed]);

  return { indexedCount: indexed.length, search };
}
