import React from 'react';

export interface InputProps {
  label?: string;
  placeholder?: string;
  type?: string;
  value?: string;
  error?: string;
  disabled?: boolean;
  prefix?: string;
  suffix?: string;
  size?: 'small' | 'large';
  multiline?: boolean;
  rows?: number;
  icon?: string;
  accept?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

const sizeStyle: Record<string, React.CSSProperties> = {
  small: { padding: '4px 8px', fontSize: 12 },
  large: { padding: '12px 16px', fontSize: 16 },
};

export const Input: React.FC<InputProps> = ({ label, placeholder, type = 'text', value, error, disabled, prefix, suffix, size, multiline, rows, icon, accept, onChange }) => {
  const baseStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: `1px solid ${error ? '#ef4444' : '#d1d5db'}`,
    borderRadius: 6,
    fontSize: size ? sizeStyle[size].fontSize as number : 14,
    outline: 'none',
    boxSizing: 'border-box',
    background: disabled ? '#f3f4f6' : '#fff',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <label style={{ fontSize: 14, fontWeight: 500 }}>{label}</label>}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {prefix && <span style={{ position: 'absolute', left: 10, color: '#9ca3af', fontSize: 14 }}>{prefix}</span>}
        {icon && <span style={{ position: 'absolute', left: 10, color: '#9ca3af' }}>{icon === 'search' ? '🔍' : icon}</span>}
        {multiline ? (
          <textarea placeholder={placeholder} value={value} rows={rows ?? 3} disabled={disabled} onChange={onChange} style={{ ...baseStyle, resize: 'vertical', paddingLeft: prefix || icon ? 30 : 12 }} />
        ) : (
          <input type={type} placeholder={placeholder} value={value} disabled={disabled} accept={accept} onChange={onChange} style={{ ...baseStyle, paddingLeft: prefix || icon ? 30 : 12 }} />
        )}
        {suffix && <span style={{ position: 'absolute', right: 10, color: '#9ca3af', fontSize: 14 }}>{suffix}</span>}
      </div>
      {error && <span style={{ color: '#ef4444', fontSize: 12 }}>{error}</span>}
    </div>
  );
};
