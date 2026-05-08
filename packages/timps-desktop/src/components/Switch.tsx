import React, { forwardRef, useState, useCallback, CSSProperties, ChangeEvent, KeyboardEvent } from 'react';
import './Switch.css';

export interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  label?: string;
  description?: string;
  className?: string;
  style?: CSSProperties;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(({
  checked = false,
  onChange,
  disabled = false,
  size = 'medium',
  label,
  description,
  className = '',
  style,
}, ref) => {
  const [isChecked, setIsChecked] = useState(checked);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    const newValue = !isChecked;
    setIsChecked(newValue);
    onChange?.(newValue);
  }, [disabled, isChecked, onChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  }, [handleToggle]);

  return (
    <div className={`switch-wrapper ${disabled ? 'disabled' : ''} ${className}`} style={style}>
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={isChecked}
        className={`switch-track switch-${size} ${isChecked ? 'checked' : ''}`}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      >
        <span className="switch-thumb" />
      </button>
      {(label || description) && (
        <div className="switch-label-container">
          {label && <span className="switch-label">{label}</span>}
          {description && <span className="switch-description">{description}</span>}
        </div>
      )}
    </div>
  );
});

Switch.displayName = 'Switch';

export interface ToggleGroupProps<T> {
  value: T;
  options: Array<{ value: T; label: string; disabled?: boolean }>;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}

export function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  className = '',
}: ToggleGroupProps<T>) {
  return (
    <div className={`toggle-group ${className}`}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className={`toggle-group-item ${value === option.value ? 'active' : ''} ${option.disabled ? 'disabled' : ''}`}
          onClick={() => !option.disabled && onChange(option.value)}
          disabled={disabled || option.disabled}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

ToggleGroup.displayName = 'ToggleGroup';

export interface ToggleButtonProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export const ToggleButton: React.FC<ToggleButtonProps> = ({
  checked = false,
  onChange,
  disabled = false,
  icon,
  label,
  className = '',
  style,
}) => {
  const handleClick = useCallback(() => {
    if (disabled) return;
    onChange?.(!checked);
  }, [disabled, checked, onChange]);

  return (
    <button
      type="button"
      className={`toggle-button ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} ${className}`}
      onClick={handleClick}
      disabled={disabled}
      style={style}
    >
      {icon && <span className="toggle-button-icon">{icon}</span>}
      {label && <span className="toggle-button-label">{label}</span>}
    </button>
  );
};

ToggleButton.displayName = 'ToggleButton';

export default Switch;