import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { t, icons } from '../../../config/theme.js';
import { loadTUIConfig } from '../../../config/tui/index.js';

export interface Command {
  id: string;
  label: string;
  description: string;
  category: string;
  shortcut?: string;
  action: () => void | Promise<void>;
  keywords: string[];
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
  onCommandSelect: (command: Command) => void;
}

const config = loadTUIConfig();
const MAX_RESULTS = 10;

function fuzzyMatch(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (q === t) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 80;

  let score = 0;
  let ti = 0;
  for (const c of q) {
    const idx = t.indexOf(c, ti);
    if (idx === -1) return 0;
    score += idx === ti ? 10 : 5;
    ti = idx + 1;
  }
  return Math.min(70, score);
}

export const CommandPalette = ({ isOpen, onClose, commands, onCommandSelect }: CommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);


  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const scored = commands
      .map(cmd => ({
        cmd,
        score: Math.max(
          fuzzyMatch(query, cmd.label),
          fuzzyMatch(query, cmd.description),
          ...cmd.keywords.map(k => fuzzyMatch(query, k))
        ),
      }))
      .filter(x => x.score > 0 || !query)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map(x => x.cmd);
    setFilteredCommands(scored);
    setSelectedIndex(0);
  }, [query, commands, isOpen]);

  const handleSubmit = useCallback(() => {
    if (filteredCommands[selectedIndex]) {
      onCommandSelect(filteredCommands[selectedIndex]);
      onClose();
    }
  }, [filteredCommands, selectedIndex, onCommandSelect, onClose]);

  useInput((_input, key) => {
    if (!isOpen) return;
    if (key.upArrow) {
      setSelectedIndex(i => (i > 0 ? i - 1 : filteredCommands.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex(i => (i < filteredCommands.length - 1 ? i + 1 : 0));
    }
  });

  if (!isOpen) return null;

  const borderColor = config.theme.colors.borderFocus;

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box flexDirection="column" borderStyle="round" borderColor={borderColor} minWidth={50}>
        <Box flexDirection="row" paddingX={1} paddingY={0}>
          <Text color={config.theme.colors.accent}>{icons.search} </Text>
          <TextInput
            value={query}
            onChange={setQuery}
            placeholder="Type a command..."
            onSubmit={handleSubmit}
          />
          <Box marginLeft={1}>
            <Text color={config.theme.colors.muted}>{`${filteredCommands.length}/${commands.length}`}</Text>
          </Box>
        </Box>

        {filteredCommands.length === 0 ? (
          <Box paddingX={1} paddingY={1}>
            <Text color={config.theme.colors.muted}>No commands found</Text>
          </Box>
        ) : (
          <Box flexDirection="column">
            {filteredCommands.map((cmd, index) => (
              <Box
                key={cmd.id}
                flexDirection="row"
                paddingX={1}
                paddingY={0}
                backgroundColor={index === selectedIndex ? config.theme.colors.selection : undefined}
              >
                <Text color={index === selectedIndex ? config.theme.colors.accentBold : config.theme.colors.muted}>
                  {index === selectedIndex ? '▸ ' : '  '}
                </Text>
                <Text bold={index === selectedIndex}>
                  {cmd.label}
                </Text>
                <Box marginLeft={1}>
                  <Text color={config.theme.colors.muted}>{cmd.description}</Text>
                </Box>
                {cmd.shortcut && (
                  <Box marginLeft={1}>
                    <Text color={config.theme.colors.muted}>{cmd.shortcut}</Text>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}

        <Box paddingX={1} paddingY={0}>
          <Text color={config.theme.colors.muted}>↑↓ navigate • ↵ select • esc close</Text>
        </Box>
      </Box>
    </Box>
  );
};