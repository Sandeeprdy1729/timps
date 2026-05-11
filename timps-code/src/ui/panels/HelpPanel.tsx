import React from 'react';
import { Box, Text, Newline } from 'ink';

interface HelpPanelProps {
  onClose: () => void;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Text bold color="#7EC8B8">{title}</Text>
    <Box flexDirection="column" paddingLeft={2}>{children}</Box>
  </Box>
);

const Cmd = ({ cmd, desc }: { cmd: string; desc: string }) => (
  <Box>
    <Text color="#4A8C7A" bold>{cmd.padEnd(24)}</Text>
    <Text dimColor>{desc}</Text>
  </Box>
);

export const HelpPanel: React.FC<HelpPanelProps> = ({ onClose }) => {
  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Box borderStyle="single" borderColor="#4A8C7A" flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold color="#4A8C7A">TIMPS Code — Commands</Text>
        <Newline />

        <Box flexDirection="row" gap={4}>
          {/* Left column */}
          <Box flexDirection="column">
            <Section title="General">
              <Cmd cmd="/help, /h"         desc="show this help" />
              <Cmd cmd="/clear"            desc="clear conversation" />
              <Cmd cmd="/cost"             desc="session cost" />
              <Cmd cmd="/doctor"           desc="system health check" />
              <Cmd cmd="/think <q>"        desc="reasoning mode" />
              <Cmd cmd="/plan <task>"      desc="planning mode" />
              <Cmd cmd="/context"          desc="context usage" />
            </Section>

            <Section title="Model">
              <Cmd cmd="/provider"         desc="select AI provider" />
              <Cmd cmd="/model <p> [m]"    desc="switch model" />
              <Cmd cmd="/models"           desc="list models" />
            </Section>

            <Section title="Memory">
              <Cmd cmd="/memory [q]"       desc="show / search memory" />
              <Cmd cmd="/memory clear"     desc="wipe memory" />
            </Section>

            <Section title="Todos">
              <Cmd cmd="/todo"             desc="list todos" />
              <Cmd cmd="/todo add <text>"  desc="add todo" />
              <Cmd cmd="/todo done <text>" desc="mark done" />
            </Section>
          </Box>

          {/* Right column */}
          <Box flexDirection="column">
            <Section title="Git">
              <Cmd cmd="/git"              desc="status" />
              <Cmd cmd="/git log"          desc="commits" />
              <Cmd cmd="/git diff"         desc="changes" />
            </Section>

            <Section title="Forge (Versioning)">
              <Cmd cmd="/forge"            desc="forge commands" />
              <Cmd cmd="/forge branches"   desc="list branches" />
              <Cmd cmd="/forge log"        desc="version history" />
            </Section>

            <Section title="Vision & Voice">
              <Cmd cmd="/vision store <f>" desc="store image" />
              <Cmd cmd="/voice record"     desc="record audio" />
              <Cmd cmd="/doc parse <f>"    desc="parse PDF/DOC" />
            </Section>

            <Section title="Session">
              <Cmd cmd="/save"             desc="save session" />
              <Cmd cmd="/compact"          desc="compress context" />
              <Cmd cmd="/undo [n]"         desc="undo changes" />
              <Cmd cmd="/snap"             desc="list snapshots" />
            </Section>
          </Box>
        </Box>
      </Box>
      <Newline />
      <Text dimColor>  Press Enter or type any command to close</Text>
    </Box>
  );
};
