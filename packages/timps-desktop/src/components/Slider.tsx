import React, { forwardRef, useState, useCallback, useEffect, useRef, CSSProperties, ChangeEvent } from 'react';
import './Slider.css';

export interface SliderProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  showValue?: boolean;
  label?: string;
  formatValue?: (value: number) => string;
  onChange?: (value: number) => void;
  className?: string;
  style?: CSSProperties;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(({
  value,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  showValue = true,
  label,
  formatValue = (v) => String(v),
  onChange,
  className = '',
  style,
  ...props
}, ref) => {
  const [currentValue, setCurrentValue] = useState(value || min);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value !== undefined) {
      setCurrentValue(value);
    }
  }, [value]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    setCurrentValue(newValue);
    onChange?.(newValue);
  }, [onChange]);

  const percentage = ((currentValue - min) / (max - min)) * 100;

  return (
    <div className={`slider-container ${disabled ? 'disabled' : ''} ${className}`} style={style}>
      {(label || showValue) && (
        <div className="slider-header">
          {label && <label className="slider-label">{label}</label>}
          {showValue && <span className="slider-value">{formatValue(currentValue)}</span>}
        </div>
      )}
      <div className="slider-track-container">
        <div className="slider-track" style={{ background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)` }} />
        <input
          ref={ref}
          type="range"
          className="slider-input"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={handleChange}
          disabled={disabled}
          {...props}
        />
      </div>
    </div>
  );
});

Slider.displayName = 'Slider';

export interface RangeSliderProps {
  values?: [number, number];
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  showValues?: boolean;
  label?: string;
  formatValue?: (value: number) => string;
  onChange?: (values: [number, number]) => void;
  className?: string;
  style?: CSSProperties;
}

export const RangeSlider = forwardRef<HTMLInputElement, RangeSliderProps>(({
  values,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  showValues = true,
  label,
  formatValue = (v) => String(v),
  onChange,
  className = '',
  style,
  ...props
}, ref) => {
  const [currentValues, setCurrentValues] = useState<[number, number]>(values || [min, max]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (values) {
      setCurrentValues(values);
    }
  }, [values]);

  const handleChange = useCallback((index: number, newValue: number) => {
    const updated = [...currentValues] as [number, number];
    if (index === 0) {
      updated[0] = Math.min(newValue, updated[1] - step);
    } else {
      updated[1] = Math.max(newValue, updated[0] + step);
    }
    setCurrentValues(updated);
    onChange?.(updated);
  }, [currentValues, step, onChange]);

  const handleMouseDown = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleMouseUp = useCallback(() => {
    setDragIndex(null);
  }, []);

  useEffect(() => {
    if (dragIndex !== null) {
      const handleMouseMove = (e: MouseEvent) => {
        const container = document.querySelector('.range-slider-track');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
        const newValue = min + percentage * (max - min);
        const snappedValue = Math.round(newValue / step) * step;
        handleChange(dragIndex, snappedValue);
      };

      const handleMouseUpGlobal = () => {
        setDragIndex(null);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUpGlobal);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUpGlobal);
      };
    }
  }, [dragIndex, min, max, step, handleChange]);

  const [minPercentage, maxPercentage] = [
    ((currentValues[0] - min) / (max - min)) * 100,
    ((currentValues[1] - min) / (max - min)) * 100,
  ];

  return (
    <div className={`range-slider-container ${disabled ? 'disabled' : ''} ${className}`} style={style}>
      {(label || showValues) && (
        <div className="range-slider-header">
          {label && <label className="range-slider-label">{label}</label>}
          {showValues && (
            <span className="range-slider-values">
              {formatValue(currentValues[0])} - {formatValue(currentValues[1])}
            </span>
          )}
        </div>
      )}
      <div className="range-slider-track-container">
        <div className="range-slider-track">
          <div
            className="range-slider-range"
            style={{ left: `${minPercentage}%`, width: `${maxPercentage - minPercentage}%` }}
          />
        </div>
        <div
          className="range-slider-thumb"
          style={{ left: `${minPercentage}%` }}
          onMouseDown={() => handleMouseDown(0)}
        />
        <div
          className="range-slider-thumb"
          style={{ left: `${maxPercentage}%` }}
          onMouseDown={() => handleMouseDown(1)}
        />
      </div>
    </div>
  );
});

RangeSlider.displayName = 'RangeSlider';

export default Slider;