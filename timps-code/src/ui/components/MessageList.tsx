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
          <Box>
            {msg.role === 'user' ? (
              <Text bold color="#7EC8B8">You</Text>
            ) : (
              <Text bold color="#4A8C7A">TIMPS</Text>
            )}
          </Box>
          <Box paddingLeft={1}>
            {msg.content ? (
              <Text color={msg.role === 'user' ? '#F5F0E1' : '#C8BF8C'}>{msg.content}</Text>
            ) : (
              <Text dimColor italic>Thinking…</Text>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
};
