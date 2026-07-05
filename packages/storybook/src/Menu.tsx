import React, { useState } from 'react';

export interface MenuItem {
  key: string;
  label: string;
  icon?: string;
  type?: 'divider';
  children?: MenuItem[];
  disabled?: boolean;
  badge?: string;
  shortcut?: string;
}

export interface MenuProps {
  items: MenuItem[];
  onClick?: (key: string) => void;
  selectable?: boolean;
  defaultSelectedKey?: string;
  direction?: 'vertical' | 'horizontal';
  size?: 'compact';
}

export const Menu: React.FC<MenuProps> = ({ items, onClick, selectable, defaultSelectedKey, direction = 'vertical', size }) => {
  const [selected, setSelected] = useState(defaultSelectedKey);
  const [expanded, setExpanded] = useState<string | null>(null);

  const renderItem = (item: MenuItem) => {
    if (item.type === 'divider') return <div key={item.key} style={{ height: 1, background: '#e5e7eb', margin: '4px 0' }} />;

    const isSelected = selected === item.key;
    const isExpanded = expanded === item.key;
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div key={item.key}>
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: size === 'compact' ? '4px 8px' : '8px 12px',
            borderRadius: 6, cursor: item.disabled ? 'not-allowed' : 'pointer', opacity: item.disabled ? 0.4 : 1,
            background: isSelected ? '#eef2ff' : 'transparent', color: isSelected ? '#4f46e5' : '#374151', fontSize: 14, gap: 8,
          }}
          onClick={() => {
            if (item.disabled) return;
            if (hasChildren) { setExpanded(isExpanded ? null : item.key); return; }
            if (selectable) setSelected(item.key);
            onClick?.(item.key);
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {item.icon && <span>{item.icon === 'home' ? '🏠' : item.icon === 'user' ? '👤' : item.icon === 'settings' ? '⚙' : item.icon}</span>}
            {item.label}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {item.badge && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 11 }}>{item.badge}</span>}
            {item.shortcut && <span style={{ fontSize: 11, color: '#9ca3af' }}>{item.shortcut}</span>}
            {hasChildren && <span style={{ fontSize: 10 }}>{isExpanded ? '▲' : '▼'}</span>}
          </span>
        </div>
        {hasChildren && isExpanded && (
          <div style={{ paddingLeft: 16 }}>
            {item.children!.map(renderItem)}
          </div>
        )}
      </div>
    );
  };

  const flexDir = direction === 'horizontal' ? 'row' : 'column';
  return (
    <div style={{ display: 'flex', flexDirection: flexDir, gap: direction === 'horizontal' ? 4 : 0, background: '#fff', borderRadius: 8, padding: 4, minWidth: 200 }}>
      {items.map(renderItem)}
    </div>
  );
};
