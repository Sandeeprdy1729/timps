import type { Preview } from '@storybook/react';
import { setGlobalConfig } from '@storybook/test';

import '../src/index.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0d1117' },
        { name: 'light', value: '#ffffff' },
      ],
    },
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default preview;