import React from 'react';

export interface ButtonProps {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'link';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  block?: boolean;
}

const variantStyle: Record<string, React.CSSProperties> = {
  primary: { background: '#4f46e5', color: '#fff', border: 'none' },
  secondary: { background: '#e5e7eb', color: '#111827', border: '1px solid #d1d5db' },
  ghost: { background: 'transparent', color: '#4f46e5', border: 'none' },
  link: { background: 'transparent', color: '#4f46e5', border: 'none', textDecoration: 'underline' },
};

const sizeStyle: Record<string, React.CSSProperties> = {
  small: { padding: '4px 12px', fontSize: 12 },
  medium: { padding: '8px 16px', fontSize: 14 },
  large: { padding: '12px 24px', fontSize: 16 },
};

export const Button: React.FC<ButtonProps> = ({
  children, variant = 'primary', size = 'medium', disabled, loading, icon, onClick, type, block,
}) => (
  <button
    type={type ?? 'button'}
    disabled={disabled || loading}
    onClick={onClick}
    style={{
      ...variantStyle[variant],
      ...sizeStyle[size],
      borderRadius: 6,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : loading ? 0.7 : 1,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      width: block ? '100%' : undefined,
      justifyContent: 'center',
    }}
  >
    {loading && <span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />}
    {icon && !loading && <span>{icon === 'download' ? '↓' : icon}</span>}
    {children}
  </button>
);
