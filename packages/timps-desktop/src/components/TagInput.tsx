import React, { useState, useCallback, useRef, CSSProperties, ChangeEvent, KeyboardEvent } from 'react';
import './TagInput.css';

export interface TagInputProps {
  value?: string[];
  onChange?: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  max?: number;
  className?: string;
  style?: CSSProperties;
}

export function TagInput({
  value = [],
  onChange,
  placeholder = 'Add tag...',
  disabled = false,
  max,
  className = '',
  style,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [errors, setErrors] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setErrors('');
  }, []);

  const addTag = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    if (value.includes(trimmed)) {
      setErrors('Tag already exists');
      return;
    }

    if (max && value.length >= max) {
      setErrors(`Maximum ${max} tags allowed`);
      return;
    }

    onChange?.([...value, trimmed]);
    setInputValue('');
  }, [inputValue, value, max, onChange]);

  const removeTag = useCallback((index: number) => {
    const newTags = value.filter((_, i) => i !== index);
    onChange?.(newTags);
  }, [value, onChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value.length - 1);
    }
  }, [addTag, inputValue, value.length, removeTag]);

  const handleContainerClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className={`tag-input-container ${disabled ? 'disabled' : ''} ${errors ? 'has-error' : ''} ${className}`}
      style={style}
      onClick={handleContainerClick}
    >
      <div className="tag-input-tags">
        {value.map((tag, index) => (
          <span key={index} className="tag-input-tag">
            {tag}
            <button
              type="button"
              className="tag-input-remove"
              onClick={() => removeTag(index)}
              disabled={disabled}
            >
              ×
            </button>
          </span>
        ))}
        {!disabled && value.length < (max || Infinity) && (
          <input
            ref={inputRef}
            type="text"
            className="tag-input-field"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={addTag}
            placeholder={value.length === 0 ? placeholder : ''}
            disabled={disabled}
          />
        )}
      </div>
      {errors && <div className="tag-input-error">{errors}</div>}
    </div>
  );
}

export default TagInput;