import React from 'react';
import { Box, Text, Newline } from 'ink';

interface HelpPanelProps {
  onClose: () => void;
}

export const HelpPanel: React.FC<HelpPanelProps> = ({ onClose }) => {
  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="cyan" flexDirection="column" padding={1}>
        <Text bold color="cyan">TIMPS Code — Commands</Text>
        <Newline />
        
        <Text dimColor>━━━ General ━━━</Text>
        <Text>/help, /h          show this help</Text>
        <Text>/clear            clear conversation</Text>
        <Text>/cost             show session cost</Text>
        <Text>/doctor           system health check</Text>
        <Text>/think &lt;q&gt;        reasoning mode</Text>
        <Text>/plan &lt;task&gt;      planning mode</Text>
        <Text>/context          context usage</Text>
        <Newline />
        
        <Text dimColor>━━━ Model ━━━</Text>
        <Text>/provider         select AI provider</Text>
        <Text>/model &lt;prov&gt; [m]  switch model</Text>
        <Text>/models           list models</Text>
        <Newline />
        
        <Text dimColor>━━━ Memory ━━━</Text>
        <Text>/memory [query]    show memory</Text>
        <Text>/memory query &lt;q&gt;  semantic search</Text>
        <Text>/memory clear     wipe memory</Text>
        <Newline />
        
        <Text dimColor>━━━ Todos ━━━</Text>
        <Text>/todo             list todos</Text>
        <Text>/todo add &lt;text&gt;   add todo</Text>
        <Text>/todo done &lt;text&gt;  mark done</Text>
        <Text>/todo clear       clear completed</Text>
        <Newline />
        
        <Text dimColor>━━━ Git ━━━</Text>
        <Text>/git              status</Text>
        <Text>/git log          commits</Text>
        <Text>/git diff          changes</Text>
        <Newline />
        
        <Text dimColor>━━━ Forge (Versioning) ━━━</Text>
        <Text>/forge            forge commands</Text>
        <Text>/forge branches   list branches</Text>
        <Text>/forge log        version history</Text>
        <Text>/forge stats      statistics</Text>
        <Newline />
        
        <Text dimColor>━━━ Vision &amp; Images ━━━</Text>
        <Text>/vision store &lt;f&gt;  store image</Text>
        <Text>/vision search &lt;q&gt; find similar</Text>
        <Text>/visionstats       image stats</Text>
        <Newline />
        
        <Text dimColor>━━━ Audio &amp; Voice ━━━</Text>
        <Text>/voice record      record audio</Text>
        <Text>/voice transcribe &lt;f&gt; transcribe file</Text>
        <Text>/voice status      check availability</Text>
        <Newline />
        
        <Text dimColor>━━━ Documents ━━━</Text>
        <Text>/doc parse &lt;file&gt;  parse PDF/DOC</Text>
        <Text>/doc analyze &lt;f&gt;   analyze with AI</Text>
        <Text>/doc search &lt;q&gt;    search documents</Text>
        <Newline />
        
        <Text dimColor>━━━ Upload ━━━</Text>
        <Text>/upload image &lt;f&gt;  upload image</Text>
        <Text>/upload pdf &lt;file&gt; upload PDF</Text>
        <Newline />
        
        <Text dimColor>━━━ Governance (GovernTier) ━━━</Text>
        <Text>/govern            governance stats</Text>
        <Text>/govern stats      detailed stats</Text>
        <Text>/govern policies   list policies</Text>
        <Text>/govern evolve     evolve policies</Text>
        <Newline />
        
        <Text dimColor>━━━ Team ━━━</Text>
        <Text>/team join &lt;proj&gt; &lt;name&gt;  join team</Text>
        <Text>/team status       team info</Text>
        <Text>/team share &lt;fact&gt; share knowledge</Text>
        <Text>/team progress     project progress</Text>
        <Newline />
        
        <Text dimColor>━━━ Session ━━━</Text>
        <Text>/save              save session</Text>
        <Text>/compact           compress context</Text>
        <Text>/undo [n]          undo changes</Text>
        <Text>/snap              list snapshots</Text>
      </Box>
      <Newline />
      <Text dimColor>Press Enter or type any command to close</Text>
    </Box>
  );
};
