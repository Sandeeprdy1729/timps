import type { Meta, StoryObj } from '@storybook/react';
import { CommandPalette } from '../src/components/CommandPalette';

const meta: Meta<typeof CommandPalette> = {
  title: 'Components/CommandPalette',
  component: CommandPalette,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CommandPalette>;

export const Default: Story = {
  args: {
    commands: [
      { id: '1', name: 'Connect GitHub', category: 'Integrations' },
      { id: '2', name: 'Connect Slack', category: 'Integrations' },
      { id: '3', name: 'New Task', category: 'Tasks' },
      { id: '4', name: 'Search', category: 'General' },
      { id: '5', name: 'Settings', category: 'General' },
    ],
    placeholder: 'Type a command...',
  },
};

export const WithShortcuts: Story = {
  args: {
    commands: [
      { 
        id: '1', 
        name: 'Connect GitHub', 
        category: 'Integrations',
        shortcut: '⌘G',
      },
      { 
        id: '2', 
        name: 'Connect Slack', 
        category: 'Integrations',
        shortcut: '⌘S',
      },
      { 
        id: '3', 
        name: 'New Task', 
        category: 'Tasks',
        shortcut: '⌘N',
      },
    ],
    placeholder: 'Type a command or shortcut...',
  },
};

export const Grouped: Story = {
  args: {
    commands: [
      { id: '1', name: 'GitHub', category: 'Connected', status: 'connected' },
      { id: '2', name: 'Slack', category: 'Connected', status: 'connected' },
      { id: '3', name: 'Notion', category: 'Available', status: 'disconnected' },
      { id: '4', name: 'Jira', category: 'Available', status: 'disconnected' },
    ],
    placeholder: 'Search integrations...',
  },
};