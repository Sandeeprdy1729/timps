import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Avatar } from '../Avatar';

const meta: Meta<typeof Avatar> = {
  title: 'Components/Avatar',
  component: Avatar,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  args: {
    name: 'John Doe',
  },
};

export const WithImage: Story = {
  args: {
    name: 'Jane Smith',
    src: 'https://i.pravatar.cc/150?img=1',
  },
};

export const Small: Story = {
  args: {
    name: 'Small Avatar',
    size: 'small',
  },
};

export const Large: Story = {
  args: {
    name: 'Large Avatar',
    size: 'large',
  },
};

export const XL: Story = {
  args: {
    name: 'Extra Large Avatar',
    size: 'xlarge',
  },
};

export const Online: Story = {
  args: {
    name: 'Online User',
    status: 'online',
  },
};

export const Offline: Story = {
  args: {
    name: 'Offline User',
    status: 'offline',
  },
};

export const Busy: Story = {
  args: {
    name: 'Busy User',
    status: 'busy',
  },
};

export const Away: Story = {
  args: {
    name: 'Away User',
    status: 'away',
  },
};

export const Group: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Avatar name="User 1" />
      <Avatar name="User 2" />
      <Avatar name="User 3" />
      <Avatar name="User 4" />
    </div>
  ),
};

export const GroupWithCount: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Avatar name="User 1" />
      <Avatar name="User 2" />
      <Avatar name="User 3" />
      <Avatar name="User 4" />
      <Avatar name="+5" count={5} />
    </div>
  ),
};

export const Square: Story = {
  args: {
    name: 'Square Avatar',
    shape: 'square',
  },
};

export const Rounded: Story = {
  args: {
    name: 'Rounded Avatar',
    shape: 'rounded',
  },
};