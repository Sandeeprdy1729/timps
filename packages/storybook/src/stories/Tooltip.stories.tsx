import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Tooltip } from '../Tooltip';

const meta: Meta<typeof Tooltip> = {
  title: 'Components/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  render: () => (
    <Tooltip content="This is a tooltip">
      <button>Hover me</button>
    </Tooltip>
  ),
};

export const Top: Story = {
  render: () => (
    <Tooltip content="Top tooltip" placement="top">
      <button>Top</button>
    </Tooltip>
  ),
};

export const Bottom: Story = {
  render: () => (
    <Tooltip content="Bottom tooltip" placement="bottom">
      <button>Bottom</button>
    </Tooltip>
  ),
};

export const Left: Story = {
  render: () => (
    <Tooltip content="Left tooltip" placement="left">
      <button>Left</button>
    </Tooltip>
  ),
};

export const Right: Story = {
  render: () => (
    <Tooltip content="Right tooltip" placement="right">
      <button>Right</button>
    </Tooltip>
  ),
};

export const WithLongText: Story = {
  render: () => (
    <Tooltip content="This is a very long tooltip text that provides more information.">
      <button>Long text</button>
    </Tooltip>
  ),
};

export const WithHtml: Story = {
  render: () => (
    <Tooltip content={<strong>Bold tooltip</strong>}>
      <button>With HTML</button>
    </Tooltip>
  ),
};

export const WithDelay: Story = {
  render: () => (
    <Tooltip content="Delayed tooltip" mouseEnterDelay={1}>
      <button>Delayed</button>
    </Tooltip>
  ),
};

export const AlwaysVisible: Story = {
  render: () => (
    <Tooltip content="Always visible" visible={true}>
      <button>Always on</button>
    </Tooltip>
  ),
};

export const Dark: Story = {
  render: () => (
    <Tooltip content="Dark tooltip" theme="dark">
      <button>Dark theme</button>
    </Tooltip>
  ),
};

export const Light: Story = {
  render: () => (
    <Tooltip content="Light tooltip" theme="light">
      <button>Light theme</button>
    </Tooltip>
  ),
};

export const MultipleTooltips: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px' }}>
      <Tooltip content="Tooltip 1"><button>Button 1</button></Tooltip>
      <Tooltip content="Tooltip 2"><button>Button 2</button></Tooltip>
      <Tooltip content="Tooltip 3"><button>Button 3</button></Tooltip>
    </div>
  ),
};