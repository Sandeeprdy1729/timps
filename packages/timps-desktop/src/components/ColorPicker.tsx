/**
 * TIMPS Desktop - ColorPicker
 * Color selection component.
 */

import { useState } from 'react';
import './ColorPicker.css';

interface ColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
}

const presetColors = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  '#f43f5e', '#78716c', '#64748b', '#94a3b8', '#1e293b', '#0f172a',
];

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [customColor, setCustomColor] = useState(value || '#6366f1');

  const handlePresetClick = (color: string) => {
    onChange(color);
    setCustomColor(color);
  };

  return (
    <div className="color-picker">
      <div className="color-preview" style={{ background: value || customColor }} />
      <div className="color-presets">
        {presetColors.map(color => (
          <button
            key={color}
            className={`color-preset ${value === color ? 'selected' : ''}`}
            style={{ background: color }}
            onClick={() => handlePresetClick(color)}
          />
        ))}
      </div>
      <div className="color-custom">
        <input
          type="color"
          value={customColor}
          onChange={e => {
            setCustomColor(e.target.value);
            onChange(e.target.value);
          }}
        />
        <span>{customColor}</span>
      </div>
    </div>
  );
}

interface ColorSwatchProps {
  colors: string[];
  selected?: string;
  onSelect: (color: string) => void;
}

export function ColorSwatch({ colors, selected, onSelect }: ColorSwatchProps) {
  return (
    <div className="color-swatch">
      {colors.map(color => (
        <button
          key={color}
          className={`swatch ${selected === color ? 'selected' : ''}`}
          style={{ background: color }}
          onClick={() => onSelect(color)}
        />
      ))}
    </div>
  );
}