import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
  options?: SelectOption[];
}

export interface SelectProps {
  options: SelectOption[];
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  multiple?: boolean;
  searchable?: boolean;
  size?: 'small' | 'large';
  error?: string;
  loading?: boolean;
}

const sizeStyle: Record<string, React.CSSProperties> = {
  small: { padding: '4px 8px', fontSize: 13 },
  large: { padding: '12px 16px', fontSize: 16 },
};

export const Select: React.FC<SelectProps> = ({ options, value, onChange, label, placeholder, disabled, multiple, searchable, size, error, loading }) => {
  const baseStyle: React.CSSProperties = {
    width: '100%', border: `1px solid ${error ? '#ef4444' : '#d1d5db'}`, borderRadius: 6,
    outline: 'none', background: disabled ? '#f3f4f6' : loading ? '#f9fafb' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer',
    ...(size ? sizeStyle[size] : { padding: '8px 12px', fontSize: 14 }),
  };

  const renderOptions = (opts: SelectOption[]): React.ReactNode =>
    opts.map(opt => opt.options ? (
      <optgroup key={opt.label} label={opt.label}>
        {renderOptions(opt.options)}
      </optgroup>
    ) : (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <label style={{ fontSize: 14, fontWeight: 500 }}>{label}</label>}
      <select
        disabled={disabled || loading}
        multiple={multiple}
        value={value}
        onChange={e => {
          if (multiple) {
            const selected = Array.from(e.target.selectedOptions).map(o => o.value);
            onChange?.(selected);
          } else {
            onChange?.(e.target.value);
          }
        }}
        style={baseStyle}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {renderOptions(options)}
      </select>
      {loading && <span style={{ fontSize: 12, color: '#6b7280' }}>Loading...</span>}
      {error && <span style={{ color: '#ef4444', fontSize: 12 }}>{error}</span>}
    </div>
  );
};
