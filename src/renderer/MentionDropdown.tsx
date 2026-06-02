import React, { forwardRef, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { SearchIcon } from './Icons.jsx';
import { iconForKey } from './mentionIcons.js';
import type { PositionResult } from './useMentionPosition.js';
import type { MentionCandidate } from './mentions.js';

const MAX_RENDER = 50;

function segmentsFromIndexes(text: string, indexes: readonly number[] | null) {
  if (!indexes || indexes.length === 0) return [{ match: false, value: text }];
  const segs: { match: boolean; value: string }[] = [];
  let cursor = 0;
  for (let i = 0; i < indexes.length;) {
    const start = indexes[i];
    if (start > cursor) segs.push({ match: false, value: text.slice(cursor, start) });
    let end = start;
    while (i < indexes.length && indexes[i] === end) { end++; i++; }
    segs.push({ match: true, value: text.slice(start, end) });
    cursor = end;
  }
  if (cursor < text.length) segs.push({ match: false, value: text.slice(cursor) });
  return segs;
}

export interface MentionDropdownProps {
  open: boolean;
  query: string;
  results: MentionCandidate[];
  activeIndex: number;
  position: PositionResult | null;
  panelMaxHeight?: number;
  panelWidth?: number;
  onSelect: (candidate: MentionCandidate) => void;
  onClose: () => void;
}

export default forwardRef<HTMLDivElement, MentionDropdownProps>(function MentionDropdown({
  open,
  query,
  results,
  activeIndex,
  position,
  panelMaxHeight = 320,
  panelWidth = 360,
  onSelect,
  onClose,
}: MentionDropdownProps, ref) {
  const itemRefs = useRef<Map<number, HTMLElement | null>>(new Map());

  const visible = useMemo(() => results.slice(0, MAX_RENDER), [results]);

  const groups = useMemo(() => {
    const map = new Map<string, MentionCandidate[]>();
    for (const r of visible) {
      if (!map.has(r.groupKey)) map.set(r.groupKey, []);
      map.get(r.groupKey)!.push(r);
    }
    const keys = [...map.keys()].sort((a, b) => {
      if (a === '__root__') return 1;
      if (b === '__root__') return -1;
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    return keys.map((k) => ({ key: k, items: map.get(k)! }));
  }, [visible]);

  useEffect(() => {
    itemRefs.current.get(activeIndex)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open || !position || !query) return null;
  if (typeof document === 'undefined') return null;

  const isEmpty = visible.length === 0;
  const rows: any[] = [];
  let idx = 0;

  if (!isEmpty) {
    for (const g of groups) {
      const headerLabel = g.key === '__root__' ? 'Root' : g.key;
      rows.push(
        <div
          key={`h-${g.key}`}
          className="mention-dropdown-group-header"
          style={{
            padding: '4px 10px 2px',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--fg-muted)',
            userSelect: 'none',
          }}
        >
          {headerLabel}
        </div>
      );
      for (const c of g.items) {
        const i = idx;
        idx++;
        const IconComp = iconForKey(c.icon);
        const segs = segmentsFromIndexes(c.display, c.indexes);
        const isActive = i === activeIndex;
        rows.push(
          <div
            key={c.id}
            ref={(el) => { itemRefs.current.set(i, el); }}
            className={`mention-dropdown-item${isActive ? ' is-active' : ''}`}
            role="option"
            aria-selected={isActive}
            onMouseDown={(e) => { e.preventDefault(); onSelect(c); }}
            style={isActive ? { boxShadow: 'inset 2px 0 0 var(--accent)' } : undefined}
          >
            <span className="mention-dropdown-icon"><IconComp size={14} /></span>
            <span className="mention-dropdown-path">
              <span className="mention-dropdown-display">
                {segs.map((s, j) => s.match ? (
                  <strong key={j} className="mention-dropdown-highlight">{s.value}</strong>
                ) : (
                  <span key={j}>{s.value}</span>
                ))}
              </span>
              {c.subtitle ? (
                <span
                  className="mention-dropdown-subtitle"
                  style={{ color: 'var(--fg-muted)', fontSize: 11, marginLeft: 6 }}
                >
                  {c.subtitle}
                </span>
              ) : null}
            </span>
          </div>
        );
      }
    }
  }

  return createPortal(
    <>
      <style>{`
        @keyframes mention-dropdown-fade-in {
          from { opacity: 0; transform: translateY(-2px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="mention-dropdown-backdrop"
        onMouseDown={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        className="mention-dropdown"
        style={{
          top: position.top,
          left: position.left,
          width: panelWidth,
          maxHeight: panelMaxHeight,
          background: 'var(--bg-popover)',
          border: '1px solid var(--border)',
          borderTop: '1px solid var(--accent)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.08)',
          animation: 'mention-dropdown-fade-in 80ms ease-out',
        }}
        role="listbox"
        aria-label="File mentions"
      >
        {isEmpty ? (
          <div
            className="mention-dropdown-empty"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 12px',
              color: 'var(--fg-muted)',
              fontSize: 12,
            }}
          >
            <SearchIcon size={12} />
            <span>{`No files match '${query}'`}</span>
          </div>
        ) : (
          <div className="mention-dropdown-list">{rows}</div>
        )}
        <div
          className="mention-dropdown-footer"
          style={{
            fontSize: 11,
            color: 'var(--fg-muted)',
            padding: '6px 10px',
            borderTop: '1px solid var(--border)',
            userSelect: 'none',
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          ↵ select · ↑↓ navigate · esc close
        </div>
      </div>
    </>,
    document.body
  );
});
