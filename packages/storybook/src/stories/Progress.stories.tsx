import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Progress } from '../Progress';

const meta: Meta<typeof Progress> = {
  title: 'Components/Progress',
  component: Progress,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Progress>;

export const Default: Story = {
  args: {
    value: 50,
  },
};

export const Zero: Story = {
  args: {
    value: 0,
  },
};

export const Hundred: Story = {
  args: {
    value: 100,
  },
};

export const Small: Story = {
  args: {
    value: 75,
    size: 'small',
  },
};

export const Large: Story = {
  args: {
    value: 60,
    size: 'large',
  },
};

export const WithLabel: Story = {
  args: {
    value: 45,
    showLabel: true,
  },
};

export const Striped: Story = {
  args: {
    value: 65,
    striped: true,
  },
};

export const Animated: Story = {
  args: {
    value: 70,
    striped: true,
    animated: true,
  },
};

export const Success: Story = {
  args: {
    value: 100,
    status: 'success',
  },
};

export const Warning: Story = {
  args: {
    value: 50,
    status: 'warning',
  },
};

export const Error: Story = {
  args: {
    value: 80,
    status: 'error',
  },
};

export const Circle: Story = {
  args: {
    value: 75,
    type: 'circle',
  },
};

export const Dashboard: Story = {
  args: {
    value: 45,
    type: 'dashboard',
  },
};

export const Multiple: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Progress value={25} label="Downloading..." />
      <Progress value={50} label="Processing..." />
      <Progress value={75} label="Uploading..." />
    </div>
  ),
};