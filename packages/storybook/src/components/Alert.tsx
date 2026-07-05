import React, { useState } from 'react';

export interface AlertProps {
  children?: React.ReactNode;
  title?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  showIcon?: boolean;
  closable?: boolean;
  action?: { label: string; onClick: () => void };
}

const typeColors: Record<string, { bg: string; border: string; icon: string; color: string }> = {
  info: { bg: '#eff6ff', border: '#93c5fd', icon: 'ℹ', color: '#1e40af' },
  success: { bg: '#f0fdf4', border: '#86efac', icon: '✓', color: '#166534' },
  warning: { bg: '#fffbeb', border: '#fcd34d', icon: '⚠', color: '#92400e' },
  error: { bg: '#fef2f2', border: '#fca5a5', icon: '✕', color: '#991b1b' },
};

export const Alert: React.FC<AlertProps> = ({ children, title, type = 'info', showIcon, closable, action }) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const c = typeColors[type];
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      {showIcon && <span style={{ color: c.color, fontSize: 18, flexShrink: 0 }}>{c.icon}</span>}
      <div style={{ flex: 1 }}>
        {title && <div style={{ fontWeight: 600, marginBottom: 4, color: c.color }}>{title}</div>}
        <div style={{ color: c.color, fontSize: 14 }}>{children}</div>
      </div>
      {action && <button onClick={action.onClick} style={{ background: 'none', border: 'none', color: c.color, cursor: 'pointer', fontWeight: 500, flexShrink: 0 }}>{action.label}</button>}
      {closable && <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', color: c.color, cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>✕</button>}
    </div>
  );
};
