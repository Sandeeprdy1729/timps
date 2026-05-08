import React, { forwardRef, useState, useCallback, CSSProperties } from 'react';
import './Divider.css';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  type?: 'solid' | 'dashed' | 'dotted';
  spacing?: string | number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

export const Divider = forwardRef<HTMLDivElement, DividerProps>(({
  orientation = 'horizontal',
  type = 'solid',
  spacing = 16,
  color,
  className = '',
  style,
}, ref) => {
  const dividerStyle: CSSProperties = {
    ...style,
    gap: spacing,
    backgroundColor: color,
  };

  return (
    <div
      ref={ref}
      className={`divider divider-${orientation} divider-${type} ${className}`}
      style={dividerStyle}
    />
  );
});

Divider.displayName = 'Divider';

export interface DividerWithTextProps {
  orientation?: 'horizontal' | 'vertical';
  text?: string;
  position?: 'left' | 'center' | 'right';
  className?: string;
}

export const DividerWithText: React.FC<DividerWithTextProps> = ({
  orientation = 'horizontal',
  text,
  position = 'center',
  className = '',
}) => {
  if (orientation === 'vertical') {
    return (
      <div className={`divider-with-text-vertical ${className}`}>
        <Divider type="dotted" />
      </div>
    );
  }

  return (
    <div className={`divider-with-text ${className}`}>
      <div className="divider-line" />
      {text && <span className={`divider-text divider-text-${position}`}>{text}</span>}
      <div className="divider-line" />
    </div>
  );
};

DividerWithText.displayName = 'DividerWithText';

export default Divider;