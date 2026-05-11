import React from 'react';
import { Box, Text, Newline } from 'ink';

interface HelpPanelProps {
  onClose: () => void;
}

export const HelpPanel: React.FC<HelpPanelProps> = ({ onClose }) => {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold color="#58A6FF">timps — commands</Text>
      <Newline />

      <Text dimColor>general</Text>
      <Text>  /help         show this help</Text>
      <Text>  /clear        clear conversation</Text>
      <Text>  /cost         session cost</Text>
      <Text>  /doctor       system health</Text>
      <Text>  /think &lt;q&gt;    reasoning mode</Text>
      <Text>  /plan &lt;task&gt;  planning mode</Text>
      <Text>  /context      context usage</Text>
      <Newline />

      <Text dimColor>model</Text>
      <Text>  /provider     select provider</Text>
      <Text>  /model &lt;p&gt; &lt;m&gt; switch model</Text>
      <Newline />

      <Text dimColor>memory</Text>
      <Text>  /memory       show memory</Text>
      <Text>  /memory &lt;q&gt;   search memory</Text>
      <Text>  /memory clear wipe memory</Text>
      <Newline />

      <Text dimColor>todos</Text>
      <Text>  /todo         list todos</Text>
      <Text>  /todo add &lt;t&gt; add todo</Text>
      <Newline />

      <Text dimColor>git</Text>
      <Text>  /git          status</Text>
      <Text>  /git log      commits</Text>
      <Newline />

      <Text dimColor color="#58A6FF">press enter to close</Text>
    </Box>
  );
};

