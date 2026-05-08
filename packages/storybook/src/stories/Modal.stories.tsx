import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Modal } from '../Modal';

const meta: Meta<typeof Modal> = {
  title: 'Components/Modal',
  component: Modal,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Modal>;

export const Default: Story = {
  render: (args) => (
    <Modal {...args} open onClose={() => {}}>
      <Modal.Header>Modal Title</Modal.Header>
      <Modal.Body>
        <p>This is the modal content. You can add any elements here.</p>
      </Modal.Body>
      <Modal.Footer>
        <button>Cancel</button>
        <button>Confirm</button>
      </Modal.Footer>
    </Modal>
  ),
  args: {
    open: true,
  },
};

export const WithLongContent: Story = {
  render: (args) => (
    <Modal {...args} open onClose={() => {}}>
      <Modal.Header>Long Content Modal</Modal.Header>
      <Modal.Body>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit...</p>
        <p>Sed do eiusmod tempor incididunt ut labore...</p>
        <p>Ut enim ad minim veniam, quis nostrud...</p>
        <p>Duis aute irure dolor in reprehenderit...</p>
        <p>Excepteur sint occaecat cupidatat...</p>
      </Modal.Body>
    </Modal>
  ),
  args: {
    open: true,
  },
};

export const Small: Story = {
  render: (args) => (
    <Modal {...args} open onClose={() => {}} size="small">
      <Modal.Header>Small Modal</Modal.Header>
      <Modal.Body>
        <p>This is a small modal.</p>
      </Modal.Body>
    </Modal>
  ),
  args: {
    open: true,
    size: 'small',
  },
};

export const Large: Story = {
  render: (args) => (
    <Modal {...args} open onClose={() => {}} size="large">
      <Modal.Header>Large Modal</Modal.Header>
      <Modal.Body>
        <p>This is a large modal with more content space.</p>
      </Modal.Body>
    </Modal>
  ),
  args: {
    open: true,
    size: 'large',
  },
};

export const Fullscreen: Story = {
  render: (args) => (
    <Modal {...args} open onClose={() => {}} fullscreen>
      <Modal.Header>Fullscreen Modal</Modal.Header>
      <Modal.Body>
        <p>This modal takes the full screen.</p>
      </Modal.Body>
    </Modal>
  ),
  args: {
    open: true,
    fullscreen: true,
  },
};

export const NoHeader: Story = {
  render: (args) => (
    <Modal {...args} open onClose={() => {}}>
      <Modal.Body>
        <p>Modal without header.</p>
      </Modal.Body>
    </Modal>
  ),
  args: {
    open: true,
  },
};

export const Centered: Story = {
  render: (args) => (
    <Modal {...args} open onClose={() => {}} centered>
      <Modal.Header>Centered Modal</Modal.Header>
      <Modal.Body>
        <p>This is a centered modal.</p>
      </Modal.Body>
    </Modal>
  ),
  args: {
    open: true,
    centered: true,
  },
};

export const WithCloseButton: Story = {
  render: (args) => (
    <Modal {...args} open onClose={() => {}} closable>
      <Modal.Header>Closable Modal</Modal.Header>
      <Modal.Body>
        <p>This modal has a close button.</p>
      </Modal.Body>
    </Modal>
  ),
  args: {
    open: true,
    closable: true,
  },
};

export const NoBackdropClose: Story = {
  render: (args) => (
    <Modal {...args} open onClose={() => {}} maskClosable={false}>
      <Modal.Header>Not Closable</Modal.Header>
      <Modal.Body>
        <p>Clicking outside won't close this.</p>
      </Modal.Body>
    </Modal>
  ),
  args: {
    open: true,
    maskClosable: false,
  },
};