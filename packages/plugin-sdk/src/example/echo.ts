import type { Plugin } from '../types.js';

/**
 * Minimal reference plugin — echoes slash-command arguments back to the user.
 *
 * Usage: /echo hello world  →  "hello world"
 */
const echoPlugin: Plugin = {
  manifest: {
    name: '@timps/plugin-echo',
    version: '0.1.0',
    description: 'Minimal reference plugin — echoes arguments back to the user.',
    commands: [
      {
        name: 'echo',
        description: 'Echo arguments back to the user',
        usage: '/echo <message…>',
      },
    ],
  },

  commands: {
    async echo(args, _ctx) {
      return args.join(' ');
    },
  },
};

export default echoPlugin;
