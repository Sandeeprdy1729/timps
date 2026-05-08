import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Table } from '../Table';

const meta: Meta<typeof Table> = {
  title: 'Components/Table',
  component: Table,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Table>;

const columns = [
  { key: 'name', title: 'Name' },
  { key: 'email', title: 'Email' },
  { key: 'role', title: 'Role' },
];

const data = [
  { key: '1', name: 'John Doe', email: 'john@example.com', role: 'Admin' },
  { key: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'User' },
  { key: '3', name: 'Bob Wilson', email: 'bob@example.com', role: 'Editor' },
];

export const Default: Story = {
  args: {
    columns,
    data,
  },
};

export const Empty: Story = {
  args: {
    columns,
    data: [],
  },
};

export const WithSelection: Story = {
  args: {
    columns,
    data,
    rowSelection: true,
  },
};

export const WithPagination: Story = {
  args: {
    columns,
    data,
    pagination: { pageSize: 2, total: 100 },
  },
};

export const Sortable: Story = {
  args: {
    columns: [
      { key: 'name', title: 'Name', sortable: true },
      { key: 'email', title: 'Email', sortable: true },
      { key: 'role', title: 'Role', sortable: true },
    ],
    data,
    sorter: true,
  },
};

export const Filterable: Story = {
  args: {
    columns: [
      { key: 'name', title: 'Name', filterable: true },
      { key: 'email', title: 'Email' },
      { key: 'role', title: 'Role', filterable: true },
    ],
    data,
    filter: true,
  },
};

export const Resizable: Story = {
  args: {
    columns,
    data,
    resizable: true,
  },
};

export const Loading: Story = {
  args: {
    columns,
    data: [],
    loading: true,
  },
};

export const Bordered: Story = {
  args: {
    columns,
    data,
    bordered: true,
  },
};

export const Stripped: Story = {
  args: {
    columns,
    data,
    striped: true,
  },
};

export const Hover: Story = {
  args: {
    columns,
    data,
    hover: true,
  },
};

export const Compact: Story = {
  args: {
    columns,
    data,
    size: 'compact',
  },
};

export const Expandable: Story = {
  args: {
    columns: [
      { key: 'name', title: 'Name' },
      { key: 'email', title: 'Email' },
    ],
    data: [
      { key: '1', name: 'John', email: 'john@example.com', details: 'More details...' },
      { key: '2', name: 'Jane', email: 'jane@example.com', details: 'More details...' },
    ],
    expandable: { expand: (record: any) => record.details },
  },
};

export const WithActions: Story = {
  render: () => (
    <Table
      columns={[
        ...columns,
        { key: 'actions', title: 'Actions', render: () => (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button>Edit</button>
            <button>Delete</button>
          </div>
        )},
      ]}
      data={data}
    />
  ),
};