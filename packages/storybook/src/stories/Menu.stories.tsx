import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Menu } from '../Menu';

const meta: Meta<typeof Menu> = {
  title: 'Components/Menu',
  component: Menu,
  tags: ['autodocs'],
  argTypes: {
    onClick: { action: 'clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof Menu>;

export const Default: Story = {
  args: {
    items: [
      { key: 'item1', label: 'Menu Item 1' },
      { key: 'item2', label: 'Menu Item 2' },
      { key: 'item3', label: 'Menu Item 3' },
    ],
  },
};

export const WithIcons: Story = {
  args: {
    items: [
      { key: 'home', label: 'Home', icon: 'home' },
      { key: 'profile', label: 'Profile', icon: 'user' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
  },
};

export const WithDividers: Story = {
  args: {
    items: [
      { key: 'item1', label: 'Item 1' },
      { key: 'divider1', type: 'divider' },
      { key: 'item2', label: 'Item 2' },
      { key: 'divider2', type: 'divider' },
      { key: 'item3', label: 'Item 3' },
    ],
  },
};

export const WithSubmenu: Story = {
  args: {
    items: [
      { key: 'item1', label: 'Item 1' },
      { key: 'submenu1', label: 'Submenu', children: [
        { key: 'sub1', label: 'Sub Item 1' },
        { key: 'sub2', label: 'Sub Item 2' },
      ]},
    ],
  },
};

export const Disabled: Story = {
  args: {
    items: [
      { key: 'item1', label: 'Enabled Item' },
      { key: 'item2', label: 'Disabled Item', disabled: true },
      { key: 'item3', label: 'Enabled Item 2' },
    ],
  },
};

export const WithBadges: Story = {
  args: {
    items: [
      { key: 'inbox', label: 'Inbox', badge: '5' },
      { key: 'sent', label: 'Sent' },
      { key: 'drafts', label: 'Drafts', badge: '3' },
    ],
  },
};

export const Selectable: Story = {
  args: {
    items: [
      { key: 'item1', label: 'Item 1' },
      { key: 'item2', label: 'Item 2' },
      { key: 'item3', label: 'Item 3' },
    ],
    selectable: true,
    defaultSelectedKey: 'item2',
  },
};

export const Vertical: Story = {
  args: {
    items: [
      { key: 'item1', label: 'Item 1' },
      { key: 'item2', label: 'Item 2' },
    ],
    direction: 'vertical',
  },
};

export const Compact: Story = {
  args: {
    items: [
      { key: 'item1', label: 'Item 1' },
      { key: 'item2', label: 'Item 2' },
    ],
    size: 'compact',
  },
};

export const WithKeyboard: Story = {
  args: {
    items: [
      { key: 'item1', label: 'Item 1', shortcut: '⌘A' },
      { key: 'item2', label: 'Item 2', shortcut: '⌘B' },
      { key: 'item3', label: 'Item 3', shortcut: '⌘C' },
    ],
  },
};