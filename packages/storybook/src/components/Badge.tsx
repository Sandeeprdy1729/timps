import React from 'react';

export interface BadgeProps {
  children?: React.ReactNode;
  count?: number;
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'processing';
  size?: 'small' | 'medium' | 'large';
  dot?: boolean;
}

const variantColors: Record<string, { bg: string; color: string }> = {
  default: { bg: '#e5e7eb', color: '#374151' },
  success: { bg: '#22c55e', color: '#fff' },
  warning: { bg: '#f59e0b', color: '#fff' },
  error: { bg: '#ef4444', color: '#fff' },
  processing: { bg: '#3b82f6', color: '#fff' },
};

const sizeMap: Record<string, number> = { small: 6, medium: 8, large: 10 };

export const Badge: React.FC<BadgeProps> = ({ children, count, max, variant = 'default', size = 'medium', dot }) => {
  const colors = variantColors[variant];
  const s = sizeMap[size];

  if (dot) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: s, height: s, borderRadius: '50%', background: colors.bg, display: 'inline-block' }} />
        {children}
      </span>
    );
  }

  if (count !== undefined) {
    const display = max !== undefined && count > max ? `${max}+` : String(count);
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', background: colors.bg, color: colors.color, borderRadius: 10, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
        {display}
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', background: colors.bg, color: colors.color, borderRadius: 10, padding: '2px 10px', fontSize: 12, fontWeight: 500 }}>
      {children}
    </span>
  );
};
