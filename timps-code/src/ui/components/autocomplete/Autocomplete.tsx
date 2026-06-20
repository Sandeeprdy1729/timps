import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import { t, icons } from '../../../config/theme.js';
import { loadTUIConfig } from '../../../config/tui/index.js';

export interface AutocompleteSuggestion {
  label: string;
  description: string;
  detail?: string;
  icon?: string;
  type: 'command' | 'file' | 'symbol' | 'provider' | 'model' | 'history';
}

export interface AutocompleteProps {
  isOpen: boolean;
  query: string;
  cursorPosition: number;
  suggestions: AutocompleteSuggestion[];
  selectedIndex: number;
  onSelect: (suggestion: AutocompleteSuggestion, index: number) => void;
  onHover: (index: number) => void;
  onClose: () => void;
}

const config = loadTUIConfig();
const MAX_VISIBLE = 8;

function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 1;
  if (t.startsWith(q)) return 99;
  if (t.includes(q)) return 70;
  let score = 0;
  let ti = 0;
  for (const c of q) {
    const idx = t.indexOf(c, ti);
    if (idx === -1) return 0;
    score += idx === ti ? 5 : 1;
    ti = idx + 1;
  }
  return score;
}

function filterSuggestions(query: string, suggestions: AutocompleteSuggestion[]): AutocompleteSuggestion[] {
  if (!query) return suggestions.slice(0, MAX_VISIBLE);
  const scored = suggestions
    .map(s => ({ s, score: Math.max(fuzzyScore(query, s.label), fuzzyScore(query, s.description)) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_VISIBLE)
    .map(x => x.s);
  if (scored.length === 0 && suggestions.length > 0) {
    return [suggestions[0]];
  }
  return scored;
}

const TypeIcon: Record<string, string> = {
  command: '⌘',
  file: '◇',
  symbol: '•',
  provider: '⊡',
  model: '○',
  history: '↻',
};

export const Autocomplete = ({ isOpen, query, cursorPosition, suggestions, selectedIndex, onHover }: AutocompleteProps) => {
  if (!isOpen || suggestions.length === 0) return null;

  const filtered = filterSuggestions(query, suggestions);

  const termWidth = process.stdout.columns || 80;
  const width = Math.min(termWidth - 4, 60);
  const borderColor = config.theme.colors.border;

  return (
    <Box flexDirection="column" width={width} borderStyle="round" borderColor={borderColor} marginLeft={2}>
      {filtered.map((suggestion, index) => (
        <Box
          key={`${suggestion.type}-${suggestion.label}`}
          flexDirection="row"
          paddingX={1}
          paddingY={0}
          backgroundColor={index === selectedIndex ? config.theme.colors.selection : undefined}
        >
          <Text color={config.theme.colors.muted}>
            {index === selectedIndex ? '▸' : ' '}
          </Text>
          <Box marginLeft={1}>
            <Text color={config.theme.colors.accent}>
              {TypeIcon[suggestion.type] || '•'}
            </Text>
          </Box>
          <Box marginLeft={1}>
            <Text bold={index === selectedIndex}>{suggestion.label}</Text>
          </Box>
          <Box marginLeft={1}>
            <Text color={config.theme.colors.muted}>{suggestion.description}</Text>
          </Box>
          {suggestion.detail && (
            <Box marginLeft={1}>
              <Text color={config.theme.colors.comment || '#64747A'}>{suggestion.detail}</Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
};