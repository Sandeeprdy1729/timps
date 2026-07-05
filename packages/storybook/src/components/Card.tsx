import React from 'react';

export interface CardProps {
  children?: React.ReactNode;
  title?: string;
  hoverable?: boolean;
  bordered?: boolean;
  icon?: string;
  status?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ children, title, hoverable, bordered, icon, status, style }) => (
  <div
    style={{
      border: bordered ? '1px solid #e5e7eb' : '1px solid transparent',
      borderRadius: 8,
      padding: 16,
      background: '#fff',
      transition: 'box-shadow 0.2s',
      boxShadow: hoverable ? '0 2px 8px rgba(0,0,0,0.08)' : undefined,
      cursor: hoverable ? 'pointer' : undefined,
      borderLeft: status === 'error' ? '4px solid #ef4444' : status === 'connected' ? '4px solid #22c55e' : undefined,
      ...style,
    }}
  >
    {icon && <div style={{ fontSize: 20, marginBottom: 8 }}>{icon === 'github' ? '🔗' : icon}</div>}
    {title && <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 16 }}>{title}</div>}
    {children}
  </div>
);
