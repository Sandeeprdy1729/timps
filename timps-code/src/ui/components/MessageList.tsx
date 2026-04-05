import React from 'react';
import { Box, Text } from 'ink';

// Simple markdown rendering utilizing standard ink primitives for now
// Eventually this can be expanded with ink-markdown
const MarkdownText = ({ children }: { children: string }) => {
  return <Text>{children}</Text>;
};

interface MessageListProps {
  messages: { role: string; content: string }[];
}

export const MessageList = ({ messages }: MessageListProps) => {
  // Only display non-system messages to avoid cluttering the CLI
  const visibleMessages = messages.filter(m => m.role !== 'system');

  return (
    <Box flexDirection="column" marginY={1}>
      {visibleMessages.map((msg, idx) => (
        <Box key={idx} flexDirection="column" marginBottom={1}>
          <Text bold color={msg.role === 'user' ? 'green' : 'blue'}>
            {msg.role === 'user' ? 'You' : 'TIMPS'}
          </Text>
          <Box paddingLeft={1} paddingTop={0}>
            {msg.content ? (
              <MarkdownText>{msg.content}</MarkdownText>
            ) : (
              <Text dimColor italic>Working...</Text>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
};
