import React, { forwardRef, useState, useCallback, useEffect, useRef, ReactNode, CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import './Dropdown.css';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  divider?: boolean;
}

export interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const Dropdown = forwardRef<HTMLButtonElement, DropdownProps>(({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled,
  className = '',
  style,
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<DropdownOption | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const current = options.find(opt => opt.value === value);
    if (current) setSelected(current);
  }, [options, value]);

  const handleSelect = useCallback((option: DropdownOption) => {
    if (option.divider || option.disabled) return;
    setSelected(option);
    onChange?.(option.value);
    setIsOpen(false);
  }, [onChange]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, handleClickOutside]);

  const containerStyle: CSSProperties = {
    ...style,
    position: 'relative',
  };

  return (
    <div ref={dropdownRef} className={`dropdown-container ${className}`} style={containerStyle}>
      <button
        ref={ref}
        type="button"
        className={`dropdown-trigger ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className="dropdown-value">
          {selected?.icon && <span className="dropdown-icon">{selected.icon}</span>}
          {selected?.label || placeholder}
        </span>
        <span className="dropdown-arrow">▼</span>
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          {options.map((option, index) => (
            option.divider ? (
              <div key={index} className="dropdown-divider" />
            ) : (
              <button
                key={option.value}
                type="button"
                className={`dropdown-option ${option.disabled ? 'disabled' : ''} ${selected?.value === option.value ? 'selected' : ''}`}
                onClick={() => handleSelect(option)}
                disabled={option.disabled}
              >
                {option.icon && <span className="dropdown-option-icon">{option.icon}</span>}
                {option.label}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
});

Dropdown.displayName = 'Dropdown';

export interface DropdownMenuProps {
  children?: ReactNode;
  className?: string;
  anchor?: 'left' | 'right';
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  children,
  className = '',
  anchor = 'left',
}) => {
  return (
    <div className={`dropdown-menu-container ${anchor === 'right' ? 'anchor-right' : ''} ${className}`}>
      {children}
    </div>
  );
};

DropdownMenu.displayName = 'DropdownMenu';

export interface DropdownItemProps {
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
}

export const DropdownItem: React.FC<DropdownItemProps> = ({
  children,
  onClick,
  disabled,
  icon,
  className = '',
}) => {
  return (
    <button
      type="button"
      className={`dropdown-item ${disabled ? 'disabled' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="dropdown-item-icon">{icon}</span>}
      {children}
    </button>
  );
};

DropdownItem.displayName = 'DropdownItem';

export interface NestedDropdownProps {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const NestedDropdown: React.FC<NestedDropdownProps> = ({
  label,
  icon,
  children,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => setIsOpen(true), []);
  const handleMouseLeave = useCallback(() => setIsOpen(false), []);

  return (
    <div
      ref={containerRef}
      className={`nested-dropdown ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button type="button" className="nested-dropdown-trigger">
        {icon && <span className="nested-dropdown-icon">{icon}</span>}
        {label}
        <span className="nested-dropdown-arrow">▶</span>
      </button>
      {isOpen && (
        <div className="nested-dropdown-menu">
          {children}
        </div>
      )}
    </div>
  );
};

NestedDropdown.displayName = 'NestedDropdown';

export default Dropdown;