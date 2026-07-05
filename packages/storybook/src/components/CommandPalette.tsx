import React, { useState } from 'react';

export interface Command {
  id: string;
  name: string;
  category: string;
  shortcut?: string;
  status?: string;
}

export interface CommandPaletteProps {
  commands: Command[];
  placeholder?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ commands, placeholder }) => {
  const [query, setQuery] = useState('');

  const filtered = commands.filter(c =>
    !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.category.toLowerCase().includes(query.toLowerCase())
  );

  const grouped: Record<string, Command[]> = {};
  for (const c of filtered) {
    if (!grouped[c.category]) grouped[c.category] = [];
    grouped[c.category].push(c);
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.1)', width: 360, overflow: 'hidden' }}>
      <input
        autoFocus
        placeholder={placeholder ?? 'Type a command...'}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: '100%', padding: '12px 16px', border: 'none', borderBottom: '1px solid #e5e7eb', outline: 'none', fontSize: 14, boxSizing: 'border-box' }}
      />
      <div style={{ maxHeight: 300, overflow: 'auto', padding: 8 }}>
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <div style={{ padding: '6px 8px', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>{cat}</div>
            {items.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 14, gap: 8 }}>
                <span>{c.name}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {c.status && <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.status === 'connected' ? '#22c55e' : '#9ca3af', display: 'inline-block' }} />}
                  {c.shortcut && <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{c.shortcut}</span>}
                </span>
              </div>
            ))}
          </div>
        ))}
        {filtered.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>No results</div>}
      </div>
    </div>
  );
};
