import React from 'react';
import { Box, Text } from 'ink';

interface MessageListProps {
  messages: { role: string; content: string }[];
}

export const MessageList = ({ messages }: MessageListProps) => {
  const visible = messages.filter(m => m.role !== 'system');

  return (
    <Box flexDirection="column" marginY={1}>
      {visible.map((msg, idx) => (
        <Box key={idx} flexDirection="column" marginBottom={1}>
          {msg.role === 'user' ? (
            <Box>
              <Text dimColor>{'> '}</Text>
              <Text>{msg.content}</Text>
            </Box>
          ) : msg.role === 'thinking' ? (
            <Box paddingLeft={2}>
              <Text italic dimColor>{'Thinking: '}</Text>
              <Text italic dimColor>{msg.content}</Text>
            </Box>
          ) : (
            <Box flexDirection="column">
              <Box paddingLeft={0}>
                {msg.content ? (
                  <Text>{msg.content}</Text>
                ) : (
                  <Text italic dimColor>Working…</Text>
                )}
              </Box>
              <Box marginTop={1}>
                <Text dimColor>{'\u2500'.repeat(50)}</Text>
              </Box>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
};
