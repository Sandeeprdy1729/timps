import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Pagination } from '../Pagination';

const meta: Meta<typeof Pagination> = {
  title: 'Components/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'changed' },
  },
};

export default meta;
type Story = StoryObj<typeof Pagination>;

export const Default: Story = {
  args: {
    total: 100,
  },
};

export const PageOne: Story = {
  args: {
    total: 10,
  },
};

export const Simple: Story = {
  args: {
    total: 50,
    mode: 'simple',
  },
};

export const Buttons: Story = {
  args: {
    total: 100,
    mode: 'button',
  },
};

export const WithPageSize: Story = {
  args: {
    total: 100,
    pageSize: 10,
  },
};

export const ShowTotal: Story = {
  args: {
    total: 100,
    showTotal: true,
  },
};

export const Small: Story = {
  args: {
    total: 100,
    size: 'small',
  },
};

export const Large: Story = {
  args: {
    total: 100,
    size: 'large',
  },
};

export const Disabled: Story = {
  args: {
    total: 100,
    disabled: true,
  },
};

export const Jump: Story = {
  args: {
    total: 100,
    showJump: true,
  },
};

export const PrevNext: Story = {
  args: {
    total: 20,
    mode: 'prevNext',
  },
};

export const Pager: Story = {
  args: {
    total: 50,
    mode: 'pager',
  },
};

export const Custom: Story = {
  args: {
    total: 200,
    pageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
  },
};