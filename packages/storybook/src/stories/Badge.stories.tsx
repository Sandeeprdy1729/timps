import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '../src/components/Badge';

const meta: Meta<typeof Badge> = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'success', 'warning', 'error', 'processing'],
    },
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
    },
    dot: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    children: 'Default',
    variant: 'default',
  },
};

export const Success: Story = {
  args: {
    children: 'Connected',
    variant: 'success',
  },
};

export const Warning: Story = {
  args: {
    children: 'Pending',
    variant: 'warning',
  },
};

export const Error: Story = {
  args: {
    children: 'Failed',
    variant: 'error',
  },
};

export const Processing: Story = {
  args: {
    children: 'Processing',
    variant: 'processing',
  },
};

export const WithDot: Story = {
  args: {
    children: 'New',
    dot: true,
  },
};

export const Small: Story = {
  args: {
    children: 'Small Badge',
    size: 'small',
  },
};

export const Large: Story = {
  args: {
    children: 'Large Badge',
    size: 'large',
  },
};

export const Notification: Story = {
  args: {
    count: 5,
    variant: 'error',
  },
};

export const Max: Story = {
  args: {
    count: 100,
    max: 99,
    variant: 'error',
  },
};