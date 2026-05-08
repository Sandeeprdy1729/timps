/**
 * TIMPS Desktop - Form components
 * Input, textarea, checkbox, radio components.
 */

import './Form.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, id, ...props }: InputProps) {
  return (
    <div className="form-field">
      {label && <label htmlFor={id} className="form-label">{label}</label>}
      <input id={id} className={`form-input ${error ? 'has-error' : ''}`} {...props} />
      {error && <span className="form-error">{error}</span>}
      {hint && <span className="form-hint">{hint}</span>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, id, ...props }: TextareaProps) {
  return (
    <div className="form-field">
      {label && <label htmlFor={id} className="form-label">{label}</label>}
      <textarea id={id} className={`form-textarea ${error ? 'has-error' : ''}`} {...props} />
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Checkbox({ label, checked, onChange, disabled }: CheckboxProps) {
  return (
    <label className={`form-checkbox ${disabled ? 'disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="checkbox标记">{checked ? '✓' : ''}</span>
      <span>{label}</span>
    </label>
  );
}

interface RadioGroupProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function RadioGroup({ name, value, onChange, options }: RadioGroupProps) {
  return (
    <div className="form-radio-group">
      {options.map(option => (
        <label key={option.value} className="form-radio">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={e => onChange(e.target.value)}
          />
          <span className="radio-mark" />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="form-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      {label && <span className="toggle-label">{label}</span>}
    </label>
  );
}

interface SwitchProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function Switch({ options, value, onChange }: SwitchProps) {
  return (
    <div className="form-switch">
      {options.map((option, index) => (
        <button
          key={option.value}
          className={`switch-option ${value === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface RangeProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
}

export function Range({ 
  value, 
  onChange, 
  min = 0, 
  max = 100, 
  step = 1, 
  label, 
  showValue = true 
}: RangeProps) {
  return (
    <div className="form-range">
      {label && <label className="form-label">{label}</label>}
      <input
        type="range"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
      />
      {showValue && <span className="range-value">{value}</span>}
    </div>
  );
}

interface FileInputProps {
  label?: string;
  accept?: string;
  multiple?: boolean;
  onChange: (files: FileList) => void;
}

export function FileInput({ label, accept, multiple, onChange }: FileInputProps) {
  return (
    <div className="form-field">
      {label && <label className="form-label">{label}</label>}
      <label className="file-input">
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={e => e.target.files && onChange(e.target.files)}
        />
        <span>Click to select files</span>
      </label>
    </div>
  );
}