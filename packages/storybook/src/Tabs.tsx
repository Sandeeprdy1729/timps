import React, { useState } from 'react';

export interface TabItem {
  key: string;
  label: string;
  children?: React.ReactNode;
  icon?: string;
  badge?: string;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  defaultActiveKey?: string;
  onChange?: (key: string) => void;
  type?: 'line' | 'bordered' | 'pill' | 'card';
  direction?: 'horizontal' | 'vertical';
}

export const Tabs: React.FC<TabsProps> = ({ items, defaultActiveKey, onChange, type = 'line', direction = 'horizontal' }) => {
  const [active, setActive] = useState(defaultActiveKey ?? items[0]?.key);

  const activeItem = items.find(i => i.key === active);

  const tabStyle = (key: string): React.CSSProperties => {
    const isActive = active === key;
    const item = items.find(i => i.key === key);
    const base: React.CSSProperties = {
      padding: direction === 'vertical' ? '10px 16px' : '10px 20px',
      cursor: item?.disabled ? 'not-allowed' : 'pointer',
      opacity: item?.disabled ? 0.4 : 1,
      fontWeight: isActive ? 600 : 400,
      color: isActive ? '#4f46e5' : '#6b7280',
      border: 'none',
      background: 'transparent',
      fontSize: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      whiteSpace: 'nowrap',
    };
    if (type === 'bordered' && isActive) {
      return { ...base, border: '1px solid #e5e7eb', borderBottom: '1px solid #fff', borderRadius: '8px 8px 0 0', background: '#fff' };
    }
    if (type === 'pill' && isActive) {
      return { ...base, background: '#eef2ff', borderRadius: 20 };
    }
    if (type === 'card' && isActive) {
      return { ...base, background: '#fff', border: '1px solid #e5e7eb', borderBottom: '1px solid #fff', borderRadius: '8px 8px 0 0' };
    }
    if (isActive && type === 'line') {
      return { ...base, boxShadow: 'inset 0 -2px 0 #4f46e5' };
    }
    return base;
  };

  return (
    <div style={{ display: 'flex', flexDirection: direction === 'vertical' ? 'row' : 'column', gap: 0 }}>
      <div style={{
        display: 'flex', flexDirection: direction === 'vertical' ? 'column' : 'row',
        borderBottom: direction === 'horizontal' && type !== 'pill' ? '1px solid #e5e7eb' : 'none',
        borderRight: direction === 'vertical' ? '1px solid #e5e7eb' : 'none',
        flexShrink: 0,
      }}>
        {items.map(item => (
          <button key={item.key} style={tabStyle(item.key)} disabled={item.disabled}
            onClick={() => { if (!item.disabled) { setActive(item.key); onChange?.(item.key); } }}>
            {item.icon && <span>{item.icon === 'home' ? '🏠' : item.icon === 'user' ? '👤' : item.icon}</span>}
            {item.label}
            {item.badge && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 11, marginLeft: 4 }}>{item.badge}</span>}
          </button>
        ))}
      </div>
      {activeItem?.children && (
        <div style={{ padding: direction === 'vertical' ? '0 16px' : 16, flex: 1, fontSize: 14 }}>
          {activeItem.children}
        </div>
      )}
    </div>
  );
};
