import React from 'react';
import { Box, Text } from 'ink';
import { loadTUIConfig } from '../../config/tui/index.js';

const config = loadTUIConfig();

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timing?: number;
  mode?: 'build' | 'plan';
}

interface MessageListProps {
  messages: Message[];
}

function formatTiming(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function Divider() {
  return (
    <Box>
      <Text color={config.theme.colors.border}>{'─'.repeat(Math.min(process.stdout.columns || 80, 80))}</Text>
    </Box>
  );
}

function BorderedBox({ children, borderColor }: { children: React.ReactNode; borderColor: string }) {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={borderColor}
      paddingX={1}
      paddingY={0}
    >
      {children}
    </Box>
  );
}

export const MessageList = ({ messages }: MessageListProps) => {
  const visible = messages.filter(m => m.role !== 'system');

  return (
    <Box flexDirection="column" marginY={1}>
      {visible.map((msg, idx) => (
        <Box key={idx} flexDirection="column" marginBottom={1}>
          {idx > 0 && <Divider />}
          <Box marginTop={1}>
            {msg.role === 'user' ? (
              <BorderedBox borderColor={config.theme.colors.accent}>
                <Text>{msg.content}</Text>
              </BorderedBox>
            ) : (
              <BorderedBox borderColor={config.theme.colors.success}>
                {msg.timing !== undefined && (
                  <Box marginBottom={1}>
                    <Text italic dimColor>
                      {'Thought ('}{formatTiming(msg.timing)}{')'}
                    </Text>
                  </Box>
                )}
                {msg.content ? (
                  <Text>{msg.content}</Text>
                ) : (
                  <Text italic dimColor>Working…</Text>
                )}
                {msg.timing !== undefined && (
                  <Box marginTop={1}>
                    <Text color={config.theme.colors.dim}>
                      <Text bold>{msg.mode === 'plan' ? 'Plan' : 'Build'}</Text>{' · '}{formatTiming(msg.timing)}
                    </Text>
                  </Box>
                )}
              </BorderedBox>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
};
