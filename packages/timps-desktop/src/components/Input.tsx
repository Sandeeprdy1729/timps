import React, { forwardRef, useState, useCallback, useRef, ReactNode, ChangeEvent, KeyboardEvent } from 'react';
import './Input.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  onRightIconClick?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconClick,
  className = '',
  id,
  ...props
}, ref) => {
  const [focused, setFocused] = useState(false);
  const [hasValue, setHasValue] = useState(!!props.value || !!props.defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => setFocused(false), []);
  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setHasValue(!!e.target.value);
    props.onChange?.(e);
  }, [props.onChange]);

  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`input-wrapper ${focused ? 'focused' : ''} ${error ? 'has-error' : ''} ${hasValue ? 'has-value' : ''} ${className}`}>
      {label && <label htmlFor={inputId} className="input-label">{label}</label>}
      <div className="input-container">
        {leftIcon && <span className="input-icon left">{leftIcon}</span>}
        <input
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === 'function') ref(node);
          }}
          id={inputId}
          className="input-field"
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          {...props}
        />
        {rightIcon && (
          <button
            type="button"
            className="input-icon right"
            onClick={onRightIconClick}
            tabIndex={-1}
          >
            {rightIcon}
          </button>
        )}
      </div>
      {error && <span className="input-error">{error}</span>}
      {hint && !error && <span className="input-hint">{hint}</span>}
    </div>
  );
});

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  showCount?: boolean;
  maxLength?: number;
  autoResize?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  error,
  hint,
  showCount,
  maxLength,
  autoResize,
  className = '',
  id,
  value,
  onChange,
  ...props
}, ref) => {
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => setFocused(false), []);
  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    if (autoResize && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
    onChange?.(e);
  }, [autoResize, onChange]);

  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
  const charCount = typeof value === 'string' ? value.length : 0;

  return (
    <div className={`textarea-wrapper ${focused ? 'focused' : ''} ${error ? 'has-error' : ''} ${className}`}>
      {label && <label htmlFor={textareaId} className="textarea-label">{label}</label>}
      <textarea
        ref={(node) => {
          textareaRef.current = node;
          if (typeof ref === 'function') ref(node);
        }}
        id={textareaId}
        className="textarea-field"
        value={value}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        maxLength={maxLength}
        {...props}
      />
      {(showCount || error || hint) && (
        <div className="textarea-footer">
          {error && <span className="textarea-error">{error}</span>}
          {!error && hint && <span className="textarea-hint">{hint}</span>}
          {showCount && !error && (
            <span className="textarea-counter">
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export interface SearchInputProps extends Omit<InputProps, 'leftIcon' | 'rightIcon'> {
  onClear?: () => void;
  loading?: boolean;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(({
  onClear,
  loading,
  className = '',
  value,
  ...props
}, ref) => {
  const [query, setQuery] = useState((value as string) || '');

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    props.onChange?.(e);
  }, [props.onChange]);

  const handleClear = useCallback(() => {
    setQuery('');
    onClear?.();
  }, [onClear]);

  return (
    <Input
      ref={ref}
      className={`search-input ${className}`}
      leftIcon={loading ? <span className="search-spinner" /> : <span className="search-icon">🔍</span>}
      rightIcon={query && !loading && (
        <button type="button" className="search-clear" onClick={handleClear}>
          ✕
        </button>
      )}
      value={query}
      onChange={handleChange}
      {...props}
    />
  );
});

SearchInput.displayName = 'SearchInput';

export interface FileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  onFileSelect?: (files: File[]) => void;
}

export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(({
  label = 'Choose file',
  accept,
  multiple,
  maxSize,
  onFileSelect,
  className = '',
  id,
  onChange,
  ...props
}, ref) => {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    let validFiles = selectedFiles;

    if (maxSize) {
      validFiles = selectedFiles.filter(file => {
        if (file.size > maxSize) {
          setError(`File ${file.name} exceeds maximum size of ${maxSize} bytes`);
          return false;
        }
        return true;
      });
    }

    setFiles(validFiles);
    setError('');
    onFileSelect?.(validFiles);
    onChange?.(e);
  }, [maxSize, onFileSelect, onChange]);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const fileInputId = id || `file-input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`file-input-wrapper ${className}`}>
      <input
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === 'function') ref(node);
        }}
        id={fileInputId}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="file-input-hidden"
        {...props}
      />
      <button type="button" className="file-input-button" onClick={handleClick}>
        {label}
      </button>
      {files.length > 0 && (
        <div className="file-input-list">
          {files.map((file, index) => (
            <div key={index} className="file-input-item">
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </div>
          ))}
        </div>
      )}
      {error && <span className="file-input-error">{error}</span>}
    </div>
  );
});

FileInput.displayName = 'FileInput';

export default Input;
