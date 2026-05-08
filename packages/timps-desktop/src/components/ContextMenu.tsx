/**
 * TIMPS Desktop - Context menu
 * Right-click context menus.
 */

import { useState, useCallback, createContext, useContext } from 'react';

interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  items: MenuItem[];
  onSelect: (id: string) => void;
}

interface Position {
  x: number;
  y: number;
}

const ContextMenuContext = createContext<{
  show: (items: MenuItem[], position: Position) => void;
  hide: () => void;
} | null>(null);

export function useContextMenu() {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error('useContextMenu must be used within ContextMenuProvider');
  }
  return context;
}

export function ContextMenuProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [position, setPosition] = useState<Position | null>(null);

  const show = useCallback((newItems: MenuItem[], newPosition: Position) => {
    setItems(newItems);
    setPosition(newPosition);
  }, []);

  const hide = useCallback(() => {
    setItems([]);
    setPosition(null);
  }, []);

  return (
    <ContextMenuContext.Provider value={{ show, hide }}>
      {children}
      {position && items.length > 0 && (
        <div 
          className="context-menu"
          style={{ left: position.x, top: position.y }}
        >
          {items.map(item => (
            item.divider ? (
              <div key={item.id} className="context-divider" />
            ) : (
              <button
                key={item.id}
                className={`context-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}`}
                onClick={() => {
                  if (!item.disabled) {
                    hide();
                  }
                }}
              >
                {item.icon && <span className="item-icon">{item.icon}</span>}
                <span className="item-label">{item.label}</span>
                {item.shortcut && <span className="item-shortcut">{item.shortcut}</span>}
              </button>
            )
          ))}
        </div>
      )}
    </ContextMenuContext.Provider>
  );
}

export function ContextMenu({ items, onSelect }: ContextMenuProps) {
  const [position, setPosition] = useState<Position | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleSelect = useCallback((id: string) => {
    setPosition(null);
    onSelect(id);
  }, [onSelect]);

  return (
    <div onContextMenu={handleContextMenu}>
      {position && (
        <div 
          className="context-menu"
          style={{ left: position.x, top: position.y }}
          onClick={() => setPosition(null)}
        >
          {items.map(item => (
            item.divider ? (
              <div key={item.id} className="context-divider" />
            ) : (
              <button
                key={item.id}
                className={`context-item ${item.danger ? 'danger' : ''}`}
                onClick={() => handleSelect(item.id)}
              >
                {item.icon && <span>{item.icon}</span>}
                <span>{item.label}</span>
                {item.shortcut && <kbd>{item.shortcut}</kbd>}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
}