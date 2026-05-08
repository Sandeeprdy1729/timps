import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Select } from '../Select';

const meta: Meta<typeof Select> = {
  title: 'Components/Select',
  component: Select,
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'changed' },
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

const options = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'option3', label: 'Option 3' },
  { value: 'option4', label: 'Option 4' },
];

export const Default: Story = {
  args: {
    options,
    placeholder: 'Select an option',
  },
};

export const WithLabel: Story = {
  args: {
    options,
    label: 'Choose Item',
    placeholder: 'Select an item',
  },
};

export const WithValue: Story = {
  args: {
    options,
    value: 'option2',
    label: 'Pre-selected',
  },
};

export const Disabled: Story = {
  args: {
    options,
    disabled: true,
    label: 'Disabled Select',
  },
};

export const MultiSelect: Story = {
  args: {
    options,
    multiple: true,
    label: 'Multi-select',
    placeholder: 'Select multiple',
  },
};

export const WithSearch: Story = {
  args: {
    options,
    searchable: true,
    label: 'Searchable',
    placeholder: 'Search...',
  },
};

export const WithGroups: Story = {
  args: {
    options: [
      { label: 'Group 1', options: [
        { value: 'a1', label: 'A Option 1' },
        { value: 'a2', label: 'A Option 2' },
      ]},
      { label: 'Group 2', options: [
        { value: 'b1', label: 'B Option 1' },
        { value: 'b2', label: 'B Option 2' },
      ]},
    ],
    label: 'With Groups',
  },
};

export const Large: Story = {
  args: {
    options,
    size: 'large',
    label: 'Large Select',
  },
};

export const Small: Story = {
  args: {
    options,
    size: 'small',
    label: 'Small Select',
  },
};

export const WithError: Story = {
  args: {
    options,
    label: 'Error Select',
    error: 'Please select an option',
  },
};

export const Loading: Story = {
  args: {
    options,
    label: 'Loading Select',
    loading: true,
  },
};