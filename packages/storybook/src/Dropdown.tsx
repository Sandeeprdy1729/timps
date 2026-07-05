import React, { useState, useRef, useEffect } from 'react';

export interface DropdownItem {
  key: string;
  label?: string;
  icon?: string;
  type?: 'divider';
  children?: DropdownItem[];
  disabled?: boolean;
  badge?: string;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  triggerType?: 'click' | 'hover';
  align?: 'left' | 'right';
  searchable?: boolean;
}

export const Dropdown: React.FC<DropdownProps> = ({ trigger, items, triggerType = 'click', align = 'left', searchable }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = search ? items.filter(i => i.label?.toLowerCase().includes(search.toLowerCase())) : items;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={triggerType === 'hover' ? () => setOpen(true) : undefined}
      onMouseLeave={triggerType === 'hover' ? () => setOpen(false) : undefined}
    >
      <div onClick={triggerType === 'click' ? () => setOpen(!open) : undefined}>{trigger}</div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', [align]: 0, marginTop: 4, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 180, zIndex: 1000, padding: 4 }}>
          {searchable && (
            <input
              autoFocus
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', border: 'none', borderBottom: '1px solid #e5e7eb', outline: 'none', fontSize: 13, boxSizing: 'border-box', marginBottom: 4 }}
            />
          )}
          {filtered.map((item) =>
            item.type === 'divider' ? (
              <div key={item.key} style={{ height: 1, background: '#e5e7eb', margin: '4px 0' }} />
            ) : (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 6, cursor: item.disabled ? 'not-allowed' : 'pointer', opacity: item.disabled ? 0.4 : 1, fontSize: 14, gap: 8 }}
                onClick={item.disabled ? undefined : () => setOpen(false)}
              >
                <span>{item.icon && `${item.icon} `}{item.label}</span>
                {item.badge && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 11 }}>{item.badge}</span>}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};
