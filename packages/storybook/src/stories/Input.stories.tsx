import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '../Input';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'changed' },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Email',
    placeholder: 'Enter your email',
    type: 'email',
  },
};

export const WithError: Story = {
  args: {
    label: 'Password',
    type: 'password',
    value: 'short',
    error: 'Password must be at least 8 characters',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled Input',
    disabled: true,
    value: 'Cannot edit this',
  },
};

export const WithPrefix: Story = {
  args: {
    label: 'Website',
    prefix: 'https://',
    placeholder: 'example.com',
  },
};

export const WithSuffix: Story = {
  args: {
    label: 'Amount',
    suffix: '.00',
    placeholder: '100',
    type: 'number',
  },
};

export const Large: Story = {
  args: {
    label: 'Large Input',
    size: 'large',
    placeholder: 'Large input field',
  },
};

export const Small: Story = {
  args: {
    label: 'Small Input',
    size: 'small',
    placeholder: 'Small input field',
  },
};

export const TextArea: Story = {
  args: {
    label: 'Description',
    multiline: true,
    rows: 4,
    placeholder: 'Enter description...',
  },
};

export const WithIcon: Story = {
  args: {
    label: 'Search',
    placeholder: 'Search...',
    icon: 'search',
  },
};

export const FileInput: Story = {
  args: {
    label: 'File',
    type: 'file',
    accept: 'image/*',
  },
};

export const ColorInput: Story = {
  args: {
    label: 'Color',
    type: 'color',
    value: '#3b82f6',
  },
};