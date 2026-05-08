import type { Meta, StoryObj } from '@storybook/react';
import { Card } from '../src/components/Card';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    hoverable: { control: 'boolean' },
    bordered: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    children: 'Default Card Content',
  },
};

export const Hoverable: Story = {
  args: {
    children: 'Hoverable Card',
    hoverable: true,
  },
};

export const Bordered: Story = {
  args: {
    children: 'Bordered Card',
    bordered: true,
  },
};

export const WithTitle: Story = {
  args: {
    title: 'Card Title',
    children: 'This is the card body content.',
  },
};

export const Integration: Story = {
  args: {
    title: 'GitHub Integration',
    children: 'Connected - Last sync: 5 minutes ago',
    icon: 'github',
    status: 'connected',
  },
};

export const ErrorCard: Story = {
  args: {
    title: 'Connection Error',
    children: 'Failed to connect to service. Please check your credentials.',
    status: 'error',
  },
};