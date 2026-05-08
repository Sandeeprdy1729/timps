import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import './CommandBar.css';

interface CommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
}

export function CommandBar({ isOpen, onClose, projectPath }: CommandBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [executing, setExecuting] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleExecute = async () => {
    if (!query.trim()) return;
    
    setExecuting(true);
    try {
      const result = await api.chat(query, projectPath);
      setOutput(result);
    } catch (err) {
      setOutput(`Error: ${err}`);
    } finally {
      setExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleExecute();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="command-bar-overlay" onClick={onClose}>
      <div className="command-bar-container" onClick={e => e.stopPropagation()}>
        <div className="command-bar-input-wrap">
          <span className="command-icon">▶</span>
          <input
            ref={inputRef}
            type="text"
            className="command-bar-input"
            placeholder="What do you want to do?"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {executing && <span className="executing-indicator">...</span>}
        </div>
        
        {output && (
          <div className="command-bar-output">
            <pre>{output}</pre>
            <button className="copy-btn" onClick={() => navigator.clipboard.writeText(output)}>
              Copy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}