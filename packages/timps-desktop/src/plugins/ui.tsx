import React, { useState, useEffect, useCallback, CSSProperties, ReactNode, createContext, useContext } from 'react';
import { Plugin, PluginManifest, PluginCapabilities } from '../core/types';

export interface PluginUIConfig {
  position?: 'left' | 'right' | 'bottom';
  width?: number;
  height?: number;
  title?: string;
  icon?: ReactNode;
  closable?: boolean;
  render: () => ReactNode;
}

interface PluginUIContextValue {
  panels: Map<string, PluginUIConfig>;
  modals: Map<string, { component: ReactNode; options: ModalProps }>;
  toasts: Array<{ id: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }>;
  commands: Map<string, { name: string; action: () => void; shortcut?: string }>;
}

const PluginUIContext = createContext<PluginUIContextValue | null>(null);

export function usePluginUI() {
  const context = useContext(PluginUIContext);
  if (!context) throw new Error('usePluginUI must be used within PluginUIProvider');
  return context;
}

export interface PluginUIProviderProps {
  children: ReactNode;
}

export function PluginUIProvider({ children }: PluginUIProviderProps) {
  const [panels, setPanels] = useState<Map<string, PluginUIConfig>>(new Map());
  const [modals, setModals] = useState<Map<string, { component: ReactNode; options: ModalProps }>>(new Map());
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: string }>>([]);
  const [commands, setCommands] = useState<Map<string, { name: string; action: () => void; shortcut?: string }>>(new Map());

  const createPanel = useCallback((id: string, config: PluginUIConfig) => {
    setPanels(prev => {
      const next = new Map(prev);
      next.set(id, config);
      return next;
    });
  }, []);

  const removePanel = useCallback((id: string) => {
    setPanels(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const showModal = useCallback((id: string, component: ReactNode, options: ModalProps = {}) => {
    setModals(prev => {
      const next = new Map(prev);
      next.set(id, { component, options });
      return next;
    });
  }, []);

  const hideModal = useCallback((id: string) => {
    setModals(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const registerCommand = useCallback((id: string, name: string, action: () => void, shortcut?: string) => {
    setCommands(prev => {
      const next = new Map(prev);
      next.set(id, { name, action, shortcut });
      return next;
    });
  }, []);

  const unregisterCommand = useCallback((id: string) => {
    setCommands(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const value: PluginUIContextValue = {
    panels,
    modals,
    toasts: toasts as any,
    commands,
  };

  return (
    <PluginUIContext.Provider value={value}>
      {children}
      <PluginPanels panels={panels} />
      <PluginModals modals={modals} />
      <PluginToasts toasts={toasts} />
    </PluginUIContext.Provider>
  );
}

interface PluginPanelsProps {
  panels: Map<string, PluginUIConfig>;
}

function PluginPanels({ panels }: PluginPanelsProps) {
  return (
    <>
      {Array.from(panels.entries()).map(([id, config]) => (
        <PluginPanel key={id} id={id} config={config} />
      ))}
    </>
  );
}

function PluginPanel({ id, config }: { id: string; config: PluginUIConfig }) {
  return (
    <div className={`plugin-panel plugin-panel-${config.position || 'right'}`} style={{ width: config.width }}>
      {config.title && <div className="plugin-panel-header">{config.title}</div>}
      <div className="plugin-panel-content">{config.render()}</div>
    </div>
  );
}

interface ModalProps {
  title?: string;
  width?: number;
  closable?: boolean;
}

interface PluginModalsProps {
  modals: Map<string, { component: ReactNode; options: ModalProps }>;
}

function PluginModals({ modals }: PluginModalsProps) {
  return (
    <>
      {Array.from(modals.entries()).map(([id, { component, options }]) => (
        <PluginModal key={id} id={id} component={component} options={options} />
      ))}
    </>
  );
}

function PluginModal({ id, component, options }: { id: string; component: ReactNode; options: ModalProps }) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="plugin-modal-overlay" onClick={() => setVisible(false)}>
      <div className="plugin-modal" style={{ width: options.width }} onClick={e => e.stopPropagation()}>
        {options.title && <div className="plugin-modal-header">{options.title}</div>}
        <div className="plugin-modal-content">{component}</div>
      </div>
    </div>
  );
}

interface PluginToastsProps {
  toasts: Array<{ id: string; message: string; type: string }>;
}

function PluginToasts({ toasts }: PluginToastsProps) {
  return (
    <div className="plugin-toasts">
      {toasts.map(toast => (
        <div key={toast.id} className={`plugin-toast plugin-toast-${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

export interface PluginToolbarProps {
  plugins: Array<{ id: string; icon: ReactNode; onClick: () => void }>;
  className?: string;
}

export function PluginToolbar({ plugins, className = '' }: PluginToolbarProps) {
  return (
    <div className={`plugin-toolbar ${className}`}>
      {plugins.map(plugin => (
        <button
          key={plugin.id}
          type="button"
          className="plugin-toolbar-button"
          onClick={plugin.onClick}
        >
          {plugin.icon}
        </button>
      ))}
    </div>
  );
}

export interface PluginContextMenuProps {
  items: Array<{
    id: string;
    label: string;
    icon?: ReactNode;
    action?: () => void;
    divider?: boolean;
  }>;
  position: { x: number; y: number };
  onClose: () => void;
}

export function PluginContextMenu({ items, position, onClose }: PluginContextMenuProps) {
  useEffect(() => {
    const handleClickOutside = () => onClose();
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  return (
    <div
      className="plugin-context-menu"
      style={{ left: position.x, top: position.y }}
    >
      {items.map(item => (
        item.divider ? (
          <div key={item.id} className="plugin-context-menu-divider" />
        ) : (
          <button
            key={item.id}
            type="button"
            className="plugin-context-menu-item"
            onClick={() => {
              item.action?.();
              onClose();
            }}
          >
            {item.icon && <span className="plugin-context-menu-icon">{item.icon}</span>}
            {item.label}
          </button>
        )
      ))}
    </div>
  );
}

export interface PluginStatusBarProps {
  items: Array<{ pluginId: string; content: ReactNode }>;
  className?: string;
}

export function PluginStatusBar({ items, className = '' }: PluginStatusBarProps) {
  return (
    <div className={`plugin-status-bar ${className}`}>
      {items.map(item => (
        <div key={item.pluginId} className="plugin-status-bar-item">
          {item.content}
        </div>
      ))}
    </div>
  );
}

export default PluginUIProvider;