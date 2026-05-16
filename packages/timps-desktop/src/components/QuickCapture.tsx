import { useState, useEffect, useRef } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { api } from '../api';
import './QuickCapture.css';

interface QuickCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
}

export function QuickCapture({ isOpen, onClose, projectPath }: QuickCaptureProps) {
  const [content, setContent] = useState('');
  const [type, setType] = useState<'fact' | 'pattern' | 'error' | 'architecture'>('fact');
  const [tags, setTags] = useState('');
  const [importance, setImportance] = useState(0.5);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const unlisten = listen('show-quick-capture', () => {
      // This is handled by the parent component
    });
    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  const handleSave = async () => {
    if (!content.trim()) return;
    
    setSaving(true);
    try {
      const key = `quick-${Date.now()}`;
      const tagList = tags.split(',').map(t => t.trim()).filter(t => t);
      
      await api.storeMemory(
        projectPath,
        key,
        content,
        importance,
        tagList
      );

      // Notify PassiveListener so it also stores to passive memory
      void emit('timps:quick-capture-saved', { content, tags: [type, ...tagList] });
      
      setSaved(true);
      setTimeout(() => {
        setContent('');
        setTags('');
        setImportance(0.5);
        setSaved(false);
        onClose();
      }, 800);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="quick-capture-overlay" onClick={onClose}>
      <div className="quick-capture-modal" onClick={e => e.stopPropagation()}>
        <div className="quick-capture-header">
          <h3>Quick Capture</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="quick-capture-body">
          <textarea
            ref={inputRef}
            className="quick-capture-input"
            placeholder="What do you want to remember?"
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          
          <div className="quick-capture-options">
            <div className="option-row">
              <label>Type:</label>
              <div className="type-buttons">
                {(['fact', 'pattern', 'error', 'architecture'] as const).map(t => (
                  <button
                    key={t}
                    className={`type-btn ${type === t ? 'active' : ''}`}
                    onClick={() => setType(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="option-row">
              <label>Tags:</label>
              <input
                type="text"
                placeholder="comma, separated, tags"
                value={tags}
                onChange={e => setTags(e.target.value)}
              />
            </div>
            
            <div className="option-row">
              <label>Importance:</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={importance}
                onChange={e => setImportance(parseFloat(e.target.value))}
              />
              <span className="importance-value">{Math.round(importance * 100)}%</span>
            </div>
          </div>
        </div>
        
        <div className="quick-capture-footer">
          <span className="hint">⌘+Enter to save · Esc to close</span>
          <button
            className={`save-btn ${saved ? 'saved' : ''}`}
            onClick={handleSave}
            disabled={saving || !content.trim()}
          >
            {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}