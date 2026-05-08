import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Dropdown } from '../Dropdown';

const meta: Meta<typeof Dropdown> = {
  title: 'Components/Dropdown',
  component: Dropdown,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Dropdown>;

export const Default: Story = {
  render: () => (
    <Dropdown
      trigger={<button>Click me</button>}
      items={[
        { key: 'item1', label: 'Item 1' },
        { key: 'item2', label: 'Item 2' },
        { key: 'item3', label: 'Item 3' },
      ]}
    />
  ),
};

export const WithIcons: Story = {
  render: () => (
    <Dropdown
      trigger={<button>Menu</button>}
      items={[
        { key: 'home', label: 'Home', icon: 'home' },
        { key: 'profile', label: 'Profile', icon: 'user' },
        { key: 'settings', label: 'Settings', icon: 'settings' },
      ]}
    />
  ),
};

export const WithDividers: Story = {
  render: () => (
    <Dropdown
      trigger={<button>Menu</button>}
      items={[
        { key: 'item1', label: 'Item 1' },
        { key: 'divider', type: 'divider' },
        { key: 'item2', label: 'Item 2' },
      ]}
    />
  ),
};

export const WithSubmenu: Story = {
  render: () => (
    <Dropdown
      trigger={<button>Menu</button>}
      items={[
        { key: 'item1', label: 'Item 1' },
        { key: 'submenu', label: 'Submenu', children: [
          { key: 'sub1', label: 'Sub Item 1' },
          { key: 'sub2', label: 'Sub Item 2' },
        ]},
      ]}
    />
  ),
};

export constHover: Story = {
  render: () => (
    <Dropdown
      trigger={<button>Hover me</button>}
      items={[
        { key: 'item1', label: 'Item 1' },
        { key: 'item2', label: 'Item 2' },
      ]}
      triggerType="hover"
    />
  ),
};

export const RightAligned: Story = {
  render: () => (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <Dropdown
        trigger={<button>Right Menu</button>}
        items={[
          { key: 'item1', label: 'Item 1' },
          { key: 'item2', label: 'Item 2' },
        ]}
        align="right"
      />
    </div>
  ),
};

export const WithBadges: Story = {
  render: () => (
    <Dropdown
      trigger={<button>Notifications</button>}
      items={[
        { key: 'inbox', label: 'Inbox', badge: '5' },
        { key: 'sent', label: 'Sent' },
        { key: 'drafts', label: 'Drafts', badge: '3' },
      ]}
    />
  ),
};

export const DisabledItem: Story = {
  render: () => (
    <Dropdown
      trigger={<button>Menu</button>}
      items={[
        { key: 'item1', label: 'Enabled' },
        { key: 'item2', label: 'Disabled', disabled: true },
        { key: 'item3', label: 'Enabled 2' },
      ]}
    />
  ),
};

export const FormInDropdown: Story = {
  render: () => (
    <Dropdown
      trigger={<button>Settings</button>}
      items={[
        { key: 'profile', label: 'Profile Settings' },
        { key: 'account', label: 'Account' },
        { key: 'divider', type: 'divider' },
        { key: 'logout', label: 'Logout' },
      ]}
    />
  ),
};

export const SearchDropdown: Story = {
  render: () => (
    <Dropdown
      trigger={<button>Search</button>}
      items={[
        { key: 'doc1', label: 'Documentation' },
        { key: 'api', label: 'API Reference' },
        { key: 'guide', label: 'Developer Guide' },
      ]}
      searchable
    />
  ),
};