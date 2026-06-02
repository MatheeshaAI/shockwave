// Detects an active @mention at the textarea's cursor. The detector only
// reports the @-character's screen-space rect (caretRect) and the in-progress
// query; the dropdown's positioning math lives in a separate hook
// (useMentionPosition) so this stays a pure detector. The detection regex
// requires the @ to be at start of input or after whitespace, so an @ mid-word
// (e.g. inside an email address) doesn't trigger. The query can contain word
// chars, dots, slashes, and hyphens — enough for path-like substring matching
// against workspace-relative file paths.

import React, { useEffect, useMemo, useState } from 'react';

export interface MentionDetectorState {
  active: boolean;
  query: string;
  startIndex: number;
  caretRect: { top: number; left: number; bottom: number; right: number; height: number } | null;
}

const MENTION_RE = /(\s|^)@([\w./-]*)$/;

// Mirror the textarea's text-layout styles in a hidden absolutely-positioned
// div, then drop a <span> at the @ character's index. The span's
// getBoundingClientRect() (relative to the viewport) is the @'s screen
// position — the dropdown anchors there with `position: fixed`. Returns the
// full rect (top/left/bottom/right/height) so the caller can position however
// it wants without re-measuring.
function measureCaretRect(
  textarea: HTMLTextAreaElement,
  charIndex: number
): MentionDetectorState['caretRect'] {
  const taRect = textarea.getBoundingClientRect();
  const computed = window.getComputedStyle(textarea);
  const measure = document.createElement('div');
  const style = measure.style;

  style.position = 'absolute';
  style.top = `${taRect.top + window.scrollY}px`;
  style.left = `${taRect.left + window.scrollX}px`;
  style.width = `${textarea.clientWidth}px`;
  style.visibility = 'hidden';
  style.pointerEvents = 'none';
  style.whiteSpace = 'pre-wrap';
  style.wordWrap = 'break-word';
  style.margin = '0';
  style.border = '0';
  style.padding = computed.padding;
  style.boxSizing = computed.boxSizing;
  style.font = computed.font;
  style.fontSize = computed.fontSize;
  style.fontFamily = computed.fontFamily;
  style.fontWeight = computed.fontWeight;
  style.fontStyle = computed.fontStyle;
  style.lineHeight = computed.lineHeight;
  style.letterSpacing = computed.letterSpacing;
  style.textTransform = computed.textTransform;
  style.tabSize = computed.tabSize;

  document.body.appendChild(measure);
  measure.appendChild(document.createTextNode(textarea.value.substring(0, charIndex)));
  const span = document.createElement('span');
  // One real char (or ZWSP for the empty case) at the @ so the span's
  // left edge is the @ column. Putting any character after the @ keeps the
  // span's width > 0 and the reported rect stable.
  span.textContent = textarea.value.substring(charIndex, charIndex + 1) || '\u200b';
  measure.appendChild(span);
  measure.appendChild(document.createTextNode(textarea.value.substring(charIndex + 1)));

  const spanRect = span.getBoundingClientRect();
  document.body.removeChild(measure);

  return {
    top: spanRect.top,
    left: spanRect.left,
    bottom: spanRect.bottom,
    right: spanRect.right,
    height: spanRect.height,
  };
}

export function useMentionDetector(
  textareaRef: React.RefObject<HTMLTextAreaElement>,
  input: string
): MentionDetectorState {
  // Bump on scroll/resize so the memo recomputes caretRect against the new
  // viewport coordinates. The scroll listener uses capture so a scrolled
  // container inside the page (not just the window) remeasures. rAF
  // coalesces bursts.
  const [remeasureTick, setRemeasureTick] = useState(0);
  useEffect(() => {
    let rafId: number | null = null;
    const onRemeasure = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setRemeasureTick(t => t + 1);
      });
    };
    window.addEventListener('scroll', onRemeasure, { capture: true, passive: true });
    window.addEventListener('resize', onRemeasure, { passive: true });
    return () => {
      window.removeEventListener('scroll', onRemeasure, { capture: true });
      window.removeEventListener('resize', onRemeasure);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  return useMemo<MentionDetectorState>(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return { active: false, query: '', startIndex: -1, caretRect: null };
    }
    const cursor = textarea.selectionStart;
    if (cursor == null) {
      return { active: false, query: '', startIndex: -1, caretRect: null };
    }

    const before = input.slice(0, cursor);
    const match = before.match(MENTION_RE);
    if (!match) {
      return { active: false, query: '', startIndex: -1, caretRect: null };
    }

    // match[1] is the leading whitespace (or '' at start-of-input). The @
    // sits at match.index + that length. RegExpMatchArray.index is typed
    // optional in the lib but is always set when match is non-null.
    const atIndex = (match.index ?? 0) + (match[1]?.length ?? 0);
    const query = match[2] ?? '';

    return {
      active: true,
      query,
      startIndex: atIndex,
      caretRect: measureCaretRect(textarea, atIndex),
    };
    // remeasureTick is the scroll/resize trigger; the memo recomputes
    // caretRect on each bump. exhaustive-deps can't see this coupling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, textareaRef, remeasureTick]);
}
