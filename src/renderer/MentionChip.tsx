import React from 'react';
import { XIcon } from './Icons.jsx';
import { iconForKey } from './mentionIcons.js';
import type { MentionToken } from './mentions.js';

export interface MentionChipProps {
  token: MentionToken;
  onRemove?: (id: string) => void;
  /** Removes hover affordance; used inside the chat bubble for sent messages. */
  readOnly?: boolean;
}

export default function MentionChip({ token, onRemove, readOnly }: MentionChipProps) {
  const Icon = iconForKey(token.icon);
  return (
    <span
      className={`mention-chip${readOnly ? ' is-readonly' : ''}`}
      title={token.subtitle ?? token.display}
      data-mention-id={token.id}
    >
      <span className="mention-chip-icon" aria-hidden="true">
        <Icon size={12} />
      </span>
      <span className="mention-chip-display">{token.display}</span>
      {!readOnly && onRemove && (
        <button
          type="button"
          className="mention-chip-remove"
          aria-label={`Remove mention ${token.display}`}
          onClick={() => onRemove(token.id)}
        >
          <XIcon size={10} />
        </button>
      )}
    </span>
  );
}
