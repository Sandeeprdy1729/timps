import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Tabs } from '../Tabs';

const meta: Meta<typeof Tabs> = {
  title: 'Components/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'changed' },
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  args: {
    items: [
      { key: 'tab1', label: 'Tab 1', children: 'Content 1' },
      { key: 'tab2', label: 'Tab 2', children: 'Content 2' },
      { key: 'tab3', label: 'Tab 3', children: 'Content 3' },
    ],
  },
};

export const WithDefaultKey: Story = {
  args: {
    defaultActiveKey: 'tab2',
    items: [
      { key: 'tab1', label: 'Tab 1', children: 'Content 1' },
      { key: 'tab2', label: 'Tab 2', children: 'Content 2' },
      { key: 'tab3', label: 'Tab 3', children: 'Content 3' },
    ],
  },
};

export const Bordered: Story = {
  args: {
    items: [
      { key: 'tab1', label: 'Tab 1', children: 'Content 1' },
      { key: 'tab2', label: 'Tab 2', children: 'Content 2' },
    ],
    type: 'bordered',
  },
};

export const Pill: Story = {
  args: {
    items: [
      { key: 'tab1', label: 'Tab 1', children: 'Content 1' },
      { key: 'tab2', label: 'Tab 2', children: 'Content 2' },
    ],
    type: 'pill',
  },
};

export const WithIcons: Story = {
  args: {
    items: [
      { key: 'home', label: 'Home', icon: 'home', children: 'Home Content' },
      { key: 'profile', label: 'Profile', icon: 'user', children: 'Profile Content' },
      { key: 'settings', label: 'Settings', icon: 'settings', children: 'Settings Content' },
    ],
  },
};

export const WithBadges: Story = {
  args: {
    items: [
      { key: 'inbox', label: 'Inbox', badge: '5', children: 'Inbox Content' },
      { key: 'sent', label: 'Sent', children: 'Sent Content' },
      { key: 'drafts', label: 'Drafts', badge: '3', children: 'Drafts Content' },
    ],
  },
};

export const WithDisabledTab: Story = {
  args: {
    items: [
      { key: 'tab1', label: 'Tab 1', children: 'Content 1' },
      { key: 'tab2', label: 'Tab 2', disabled: true, children: 'Disabled' },
      { key: 'tab3', label: 'Tab 3', children: 'Content 3' },
    ],
  },
};

export const Vertical: Story = {
  args: {
    items: [
      { key: 'tab1', label: 'Tab 1', children: 'Content 1' },
      { key: 'tab2', label: 'Tab 2', children: 'Content 2' },
    ],
    direction: 'vertical',
  },
};

export const CardTabs: Story = {
  args: {
    items: [
      { key: 'overview', label: 'Overview', children: 'Overview Content' },
      { key: 'details', label: 'Details', children: 'Details Content' },
      { key: 'settings', label: 'Settings', children: 'Settings Content' },
    ],
    type: 'card',
  },
};