import type { Meta, StoryObj } from '@storybook/react';
import { Alert } from '../src/components/Alert';

const meta: Meta<typeof Alert> = {
  title: 'Components/Alert',
  component: Alert,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['info', 'success', 'warning', 'error'],
    },
    showIcon: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Info: Story = {
  args: {
    type: 'info',
    title: 'Information',
    children: 'This is an informational message.',
    showIcon: true,
  },
};

export const Success: Story = {
  args: {
    type: 'success',
    title: 'Success',
    children: 'Your changes have been saved successfully.',
    showIcon: true,
  },
};

export const Warning: Story = {
  args: {
    type: 'warning',
    title: 'Warning',
    children: 'Please review your settings before proceeding.',
    showIcon: true,
  },
};

export const Error: Story = {
  args: {
    type: 'error',
    title: 'Error',
    children: 'An error occurred while processing your request.',
    showIcon: true,
  },
};

export const WithoutIcon: Story = {
  args: {
    type: 'info',
    title: 'Information',
    children: 'This is an alert without an icon.',
    showIcon: false,
  },
};

export const Dismissible: Story = {
  args: {
    type: 'info',
    title: 'Dismissible Alert',
    children: 'You can dismiss this alert.',
    showIcon: true,
    closable: true,
  },
};

export const WithAction: Story = {
  args: {
    type: 'success',
    title: 'Action Completed',
    children: 'The integration has been connected.',
    showIcon: true,
    action: {
      label: 'View Details',
      onClick: () => console.log('Details clicked'),
    },
  },
};