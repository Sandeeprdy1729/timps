/**
 * TIMPS Desktop - Select
 * Custom select dropdown component.
 */

import { useState, useRef, useEffect } from 'react';
import './Select.css';

interface SelectOption {
  value: string;
  label: string;
  icon?: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function Select({ options, value, onChange, placeholder = 'Select...', disabled }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`select ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`} ref={ref}>
      <button className="select-trigger" onClick={() => !disabled && setIsOpen(!isOpen)}>
        {selected ? (
          <>
            {selected.icon && <span className="select-icon">{selected.icon}</span>}
            <span>{selected.label}</span>
          </>
        ) : (
          <span className="select-placeholder">{placeholder}</span>
        )}
        <span className="select-arrow">▼</span>
      </button>
      {isOpen && (
        <div className="select-dropdown">
          {options.map(option => (
            <button
              key={option.value}
              className={`select-option ${option.value === value ? 'selected' : ''}`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.icon && <span className="select-icon">{option.icon}</span>}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface MultiSelectProps {
  options: SelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export function MultiSelect({ options, values, onChange, placeholder }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter(v => v !== value));
    } else {
      onChange([...values, value]);
    }
  };

  const selectedOptions = options.filter(o => values.includes(o.value));

  return (
    <div className={`select multi ${isOpen ? 'open' : ''}`} ref={ref}>
      <button className="select-trigger" onClick={() => setIsOpen(!isOpen)}>
        {selectedOptions.length > 0 ? (
          <span>{selectedOptions.map(o => o.label).join(', ')}</span>
        ) : (
          <span className="select-placeholder">{placeholder || 'Select...'}</span>
        )}
        <span className="select-arrow">▼</span>
      </button>
      {isOpen && (
        <div className="select-dropdown">
          {options.map(option => (
            <label key={option.value} className="select-checkbox">
              <input
                type="checkbox"
                checked={values.includes(option.value)}
                onChange={() => handleToggle(option.value)}
              />
              {option.icon && <span className="select-icon">{option.icon}</span>}
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

interface AutocompleteProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  filter?: (option: SelectOption, query: string) => boolean;
}

export function Autocomplete({ 
  options, 
  value, 
  onChange, 
  placeholder, 
  filter 
}: AutocompleteProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = options.filter(o => {
    if (!query) return true;
    return filter ? filter(o, query) : o.label.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className={`select autocomplete ${isOpen ? 'open' : ''}`} ref={ref}>
      <input
        type="text"
        className="select-input"
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        placeholder={placeholder}
      />
      {isOpen && filtered.length > 0 && (
        <div className="select-dropdown">
          {filtered.map(option => (
            <button
              key={option.value}
              className={`select-option ${option.value === value ? 'selected' : ''}`}
              onClick={() => {
                onChange(option.value);
                setQuery(option.label);
                setIsOpen(false);
              }}
            >
              {option.icon && <span className="select-icon">{option.icon}</span>}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}