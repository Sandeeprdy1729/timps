import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface ToolActivityProps {
  toolName: string;
}

export const ToolActivity = ({ toolName }: ToolActivityProps) => {
  return (
    <Box>
      <Text color="yellow">
        <Spinner type="dots" />
      </Text>
      <Box marginLeft={1}>
        <Text dimColor>
          Running tool: <Text color="yellow">{toolName}</Text>...
        </Text>
      </Box>
    </Box>
  );
};
