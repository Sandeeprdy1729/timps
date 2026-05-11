// ── TIMPS Code — Key Bindings
// Keyboard shortcuts and input handling

export interface KeyBinding {
  key: string;
  modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[];
  description: string;
  action: string;
}

export const KEY_BINDINGS: KeyBinding[] = [
  // Navigation
  { key: 'left', description: 'Move cursor left', action: 'cursor-left' },
  { key: 'right', description: 'Move cursor right', action: 'cursor-right' },
  { key: 'left', modifiers: ['ctrl'], description: 'Move word left', action: 'word-left' },
  { key: 'right', modifiers: ['ctrl'], description: 'Move word right', action: 'word-right' },
  { key: 'home', description: 'Move to line start', action: 'line-start' },
  { key: 'end', description: 'Move to line end', action: 'line-end' },

  // Editing
  { key: 'backspace', description: 'Delete character', action: 'backspace' },
  { key: 'backspace', modifiers: ['ctrl'], description: 'Delete word', action: 'delete-word' },
  { key: 'delete', description: 'Delete forward', action: 'delete' },
  { key: 'delete', modifiers: ['ctrl'], description: 'Delete to line end', action: 'delete-to-end' },
  { key: 'return', description: 'Submit', action: 'submit' },
  { key: 'return', modifiers: ['shift'], description: 'Insert newline', action: 'newline' },
  { key: 'tab', description: 'Auto-complete', action: 'complete' },
  { key: 'tab', modifiers: ['shift'], description: 'Reverse complete', action: 'complete-reverse' },

  // History
  { key: 'up', description: 'History up', action: 'history-up' },
  { key: 'down', description: 'History down', action: 'history-down' },
  { key: 'up', modifiers: ['ctrl'], description: 'Previous command', action: 'history-prev' },
  { key: 'down', modifiers: ['ctrl'], description: 'Next command', action: 'history-next' },

  // Kill/Yank
  { key: 'k', modifiers: ['ctrl'], description: 'Kill to end', action: 'kill-line' },
  { key: 'u', modifiers: ['ctrl'], description: 'Kill from start', action: 'kill-start' },
  { key: 'w', modifiers: ['ctrl'], description: 'Kill word', action: 'kill-word' },
  { key: 'y', modifiers: ['ctrl'], description: 'Yank', action: 'yank' },
  { key: 'y', modifiers: ['ctrl', 'alt'], description: 'Yank pop', action: 'yank-pop' },

  // Control
  { key: 'c', modifiers: ['ctrl'], description: 'Cancel', action: 'cancel' },
  { key: 'c', modifiers: ['ctrl', 'ctrl'], description: 'Force exit', action: 'force-exit' },
  { key: 'd', modifiers: ['ctrl'], description: 'EOF/exit if empty', action: 'eof' },
  { key: 'z', modifiers: ['ctrl'], description: 'Suspend', action: 'suspend' },
  { key: 'l', modifiers: ['ctrl'], description: 'Clear screen', action: 'clear' },

  // Vim-style
  { key: 'escape', description: 'Normal mode', action: 'normal-mode' },
  { key: 'i', description: 'Insert mode', action: 'insert-mode' },
  { key: 'a', description: 'Append', action: 'append' },
  { key: 'A', description: 'Append at end', action: 'append-end' },
  { key: 'I', description: 'Insert at start', action: 'insert-start' },
  { key: 'o', description: 'Open line below', action: 'open-below' },
  { key: 'O', description: 'Open line above', action: 'open-above' },
  { key: 'x', description: 'Delete char', action: 'delete-char' },
  { key: 'dd', description: 'Delete line', action: 'delete-line' },
  { key: 'yy', description: 'Yank line', action: 'yank-line' },
  { key: 'p', description: 'Paste', action: 'paste' },
  { key: 'u', description: 'Undo', action: 'undo' },
  { key: '.', description: 'Redo', action: 'redo' },
  { key: '/', description: 'Search', action: 'search' },
  { key: 'n', description: 'Next search', action: 'search-next' },
  { key: 'N', modifiers: ['shift'], description: 'Prev search', action: 'search-prev' },
  { key: ':', description: 'Command mode', action: 'command-mode' },
  { key: 'w', description: 'Word forward', action: 'word-forward' },
  { key: 'b', description: 'Word back', action: 'word-back' },
  { key: '0', description: 'Line start', action: 'line-start' },
  { key: '$', description: 'Line end', action: 'line-end' },
  { key: 'G', description: 'Go to end', action: 'go-end' },
  { key: 'gg', description: 'Go to start', action: 'go-start' },

  // Custom TIMPS
  { key: 'p', modifiers: ['ctrl', 'shift'], description: 'Switch provider', action: 'provider-select' },
  { key: 'm', modifiers: ['ctrl', 'shift'], description: 'Show models', action: 'models' },
  { key: 't', modifiers: ['ctrl', 'shift'], description: 'Todo list', action: 'todos' },
  { key: 'r', modifiers: ['ctrl', 'shift'], description: 'Resume session', action: 'resume' },
];

export function getBinding(key: string, modifiers?: string[]): KeyBinding | undefined {
  return KEY_BINDINGS.find(b =>
    b.key === key &&
    JSON.stringify(b.modifiers?.sort()) === JSON.stringify(modifiers?.sort())
  );
}

export const SHORTCUT_HINTS = [
  { keys: 'Ctrl+C', description: 'Cancel / Exit' },
  { keys: 'Tab', description: 'Auto-complete' },
  { keys: '↑↓', description: 'History' },
  { keys: 'Ctrl+K', description: 'Kill line' },
  { keys: 'Ctrl+Y', description: 'Yank' },
  { keys: 'Esc', description: 'Vim normal mode' },
  { keys: ':w', description: 'Save (vim)' },
  { keys: ':q', description: 'Quit' },
];
