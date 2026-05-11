import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface ToolActivityProps {
  toolName: string;
}

export const ToolActivity = ({ toolName }: ToolActivityProps) => {
  return (
    <Box>
      <Text color="#58A6FF">
        <Spinner type="dots" />
      </Text>
      <Box marginLeft={1}>
        <Text dimColor>
          <Text color="#39D353">{toolName}</Text>
        </Text>
      </Box>
    </Box>
  );
};
