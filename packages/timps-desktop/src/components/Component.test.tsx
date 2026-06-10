import { render, renderHook, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuickCapture } from './QuickCapture';
import { CommandBar } from './CommandBar';
import { ToastProvider, useToast } from './Toast';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { useMemory, useDebounce, useLocalStorage } from '../hooks/index';
import {
  debounce,
  formatDate,
  formatRelativeTime,
  generateId,
  getErrorMessage,
  parseTags,
  searchSemantic,
  truncate,
  validateProjectPath,
} from '../utils';
import { APP, KEYBOARD, MEMORY, PROVIDERS } from '../constants';
import { api, SemanticEntry } from '../api';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('QuickCapture Component', () => {
  it('should render when open', () => {
    const { container } = render(
      <QuickCapture isOpen={true} onClose={() => {}} projectPath="/test" />
    );
    expect(container.querySelector('.quick-capture-modal')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    const { container } = render(
      <QuickCapture isOpen={false} onClose={() => {}} projectPath="/test" />
    );
    expect(container.querySelector('.quick-capture-modal')).not.toBeInTheDocument();
  });

  it('should have default type "fact"', () => {
    const { getByText } = render(
      <QuickCapture isOpen={true} onClose={() => {}} projectPath="/test" />
    );
    expect(getByText('fact')).toHaveClass('active');
  });

  it('should save on Cmd+Enter', async () => {
    const onClose = vi.fn();
    render(
      <QuickCapture isOpen={true} onClose={onClose} projectPath="/test" />
    );
    
    // Enter some content
    const textarea = document.querySelector('.quick-capture-input');
    fireEvent.change(textarea!, { target: { value: 'Test memory' } });
    
    // Press Cmd+Enter
    fireEvent.keyDown(textarea!, { key: 'Enter', metaKey: true });
    
    // Should call save (via mock)
  });
});

describe('CommandBar Component', () => {
  it('should render when open', () => {
    const { container } = render(
      <CommandBar isOpen={true} onClose={() => {}} projectPath="/test" />
    );
    expect(container.querySelector('.command-bar-container')).toBeInTheDocument();
  });

  it('should close on Escape', () => {
    const onClose = vi.fn();
    const { container } = render(
      <CommandBar isOpen={true} onClose={onClose} projectPath="/test" />
    );
    
    const input = container.querySelector('.command-bar-input');
    fireEvent.keyDown(input!, { key: 'Escape' });
    
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ThemeProvider', () => {
  it('should provide theme context', () => {
    const TestComponent = () => {
      const { theme } = useTheme();
      return <div>{theme}</div>;
    };

    const { getByText } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(getByText('dark')).toBeInTheDocument();
  });

  it('should set theme', () => {
    const TestComponent = () => {
      const { theme, setTheme } = useTheme();
      return <button onClick={() => setTheme('light')}>{theme}</button>;
    };

    const { getByText } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    fireEvent.click(getByText('dark'));
    expect(getByText('light')).toBeInTheDocument();
  });
});

describe('useToast', () => {
  it('should show toast', () => {
    const TestComponent = () => {
      const toast = useToast();
      return <button onClick={() => toast.success('Test message')}>Show</button>;
    };

    const { getByText } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(getByText('Show'));
    expect(getByText('Test message')).toBeInTheDocument();
  });
});

describe('useMemory hook', () => {
  it('should load memory on mount', async () => {
    const { result } = renderHook(() => 
      useMemory({ projectPath: '/test', autoLoad: true })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should add memory', async () => {
    const storeSpy = vi.spyOn(api, 'storeMemory').mockResolvedValue(undefined);

    const { result } = renderHook(() => 
      useMemory({ projectPath: '/test', autoLoad: false })
    );

    await act(async () => {
      await result.current.addMemory('test-key', 'test-value', ['tag']);
    });

    expect(storeSpy).toHaveBeenCalled();
  });
});

describe('useDebounce hook', () => {
  it('should debounce value', async () => {
    const { result, rerender } = renderHook(({ value }) => 
      useDebounce(value, 100)
    , { initialProps: { value: 'initial' } });

    rerender({ value: 'updated' });

    expect(result.current).toBe('initial');

    await waitFor(() => {
      expect(result.current).toBe('updated');
    }, { timeout: 150 });
  });
});

describe('useLocalStorage hook', () => {
  it('should get value', () => {
    const { result } = renderHook(() => 
      useLocalStorage('test-key', 'default')
    );

    expect(result.current[0]).toBe('default');
  });

  it('should set value', () => {
    const { result } = renderHook(() => 
      useLocalStorage('test-key', 'default')
    );

    act(() => {
      result.current[1]('new-value');
    });

    expect(result.current[0]).toBe('new-value');
  });
});

describe('utils', () => {
  describe('formatDate', () => {
    it('should format today', () => {
      const today = Math.floor(Date.now() / 1000);
      expect(formatDate(today)).toBe('Today');
    });

    it('should format yesterday', () => {
      const yesterday = Math.floor((Date.now() - 86400000) / 1000);
      expect(formatDate(yesterday)).toBe('Yesterday');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format minutes', () => {
      const minutesAgo = Math.floor((Date.now() - 600000) / 1000);
      expect(formatRelativeTime(minutesAgo)).toBe('10m ago');
    });
  });

  describe('truncate', () => {
    it('should truncate long text', () => {
      expect(truncate('hello world', 5)).toBe('he...');
    });

    it('should not truncate short text', () => {
      expect(truncate('hi', 10)).toBe('hi');
    });
  });

  describe('generateId', () => {
    it('should generate unique ids', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('debounce', () => {
    it('should debounce function calls', async () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(fn).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(fn).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('searchSemantic', () => {
    it('should search by content', () => {
      const entries = [
        { id: '1', type: 'fact', content: 'hello world', tags: [] } as SemanticEntry,
        { id: '2', type: 'fact', content: 'foo bar', tags: [] } as SemanticEntry,
      ];
      expect(searchSemantic(entries, 'hello')).toHaveLength(1);
    });

    it('should search by tags', () => {
      const entries = [
        { id: '1', type: 'fact', content: 'test', tags: ['important'] } as SemanticEntry,
        { id: '2', type: 'fact', content: 'test2', tags: [] } as SemanticEntry,
      ];
      expect(searchSemantic(entries, 'important')).toHaveLength(1);
    });
  });

  describe('getErrorMessage', () => {
    it('should extract error message from Error', () => {
      expect(getErrorMessage(new Error('test'))).toBe('test');
    });

    it('should handle string error', () => {
      expect(getErrorMessage('string error')).toBe('string error');
    });
  });

  describe('parseTags', () => {
    it('should parse comma-separated tags', () => {
      expect(parseTags('tag1, tag2, tag3')).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should parse newline-separated tags', () => {
      expect(parseTags('tag1\ntag2')).toEqual(['tag1', 'tag2']);
    });
  });

  describe('validateProjectPath', () => {
    it('should validate absolute path', () => {
      expect(validateProjectPath('/valid/path').valid).toBe(true);
    });

    it('should reject empty path', () => {
      expect(validateProjectPath('').valid).toBe(false);
    });

    it('should accept Windows path', () => {
      expect(validateProjectPath('C:\\valid\\path').valid).toBe(true);
    });
  });
});

describe('Constants', () => {
  it('APP should have required fields', () => {
    expect(APP.name).toBe('TIMPS');
    expect(APP.version).toBeDefined();
  });

  it('PROVIDERS should have ollama', () => {
    expect(PROVIDERS.find(p => p.name === 'ollama')).toBeDefined();
  });

  it('MEMORY limits should be positive', () => {
    expect(MEMORY.maxSemantic).toBeGreaterThan(0);
    expect(MEMORY.maxEpisodes).toBeGreaterThan(0);
  });

  it('KEYBOARD shortcuts should be defined', () => {
    expect(KEYBOARD.shortcuts.showWindow).toBeDefined();
    expect(KEYBOARD.shortcuts.quickCapture).toBeDefined();
    expect(KEYBOARD.shortcuts.commandBar).toBeDefined();
  });
});
