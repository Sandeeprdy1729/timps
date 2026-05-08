import React, { forwardRef, useState, useCallback, useEffect, useRef, useImperativeHandle, ReactNode, CSSProperties } from 'react';
import './Progress.css';

export interface ProgressProps {
  value?: number;
  max?: number;
  showValue?: boolean;
  size?: 'small' | 'medium' | 'large';
  color?: string;
  trackColor?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(({
  value = 0,
  max = 100,
  showValue = false,
  size = 'medium',
  color = '#3b82f6',
  trackColor = '#e5e7eb',
  label,
  className = '',
  style,
}, ref) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div ref={ref} className={`progress-container ${className}`} style={style}>
      {(label || showValue) && (
        <div className="progress-header">
          {label && <span className="progress-label">{label}</span>}
          {showValue && <span className="progress-value">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className={`progress-track progress-${size}`} style={{ background: trackColor }}>
        <div
          className="progress-fill"
          style={{
            width: `${percentage}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
});

Progress.displayName = 'Progress';

export interface CircularProgressProps {
  value?: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  showValue?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const CircularProgress = forwardRef<SVGSVGElement, CircularProgressProps>(({
  value = 0,
  max = 100,
  size = 48,
  strokeWidth = 4,
  color = '#3b82f6',
  trackColor = '#e5e7eb',
  showValue = true,
  className = '',
  style,
}, ref) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg
      ref={ref}
      className={`circular-progress ${className}`}
      width={size}
      height={size}
      style={style}
    >
      <circle
        className="circular-progress-track"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <circle
        className="circular-progress-fill"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {showValue && (
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="circular-progress-text"
        >
          {Math.round(percentage)}%
        </text>
      )}
    </svg>
  );
});

CircularProgress.displayName = 'CircularProgress';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  animated?: boolean;
  striped?: boolean;
  color?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  animated = true,
  striped = false,
  color = '#3b82f6',
  className = '',
  style,
  children,
  ...props
}) => {
  const [stripeStyle, setStripeStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (striped) {
      setStripeStyle({
        backgroundImage: `linear-gradient(
          45deg,
          rgba(255, 255, 255, 0.15) 25%,
          transparent 25%,
          transparent 50%,
          rgba(255, 255, 255, 0.15) 50%,
          rgba(255, 255, 255, 0.15) 75%,
          transparent 75%,
          transparent
        )`,
        backgroundSize: '1rem 1rem',
      });
    }
  }, [striped]);

  return (
    <div
      className={`progress-bar ${animated ? 'animated' : ''} ${className}`}
      style={{ ...style, background: color, ...stripeStyle }}
      {...props}
    >
      {children}
    </div>
  );
};

ProgressBar.displayName = 'ProgressBar';

export interface MultiProgressProps {
  values: Array<{ label?: string; value: number; color?: string }>;
  max?: number;
  showTotal?: boolean;
  stacked?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const MultiProgress: React.FC<MultiProgressProps> = ({
  values,
  max = 100,
  showTotal = true,
  stacked = false,
  className = '',
  style,
}) => {
  const total = values.reduce((sum, v) => sum + v.value, 0);
  const totalPercentage = Math.min(100, (total / max) * 100);

  let accumulatedWidth = 0;

  return (
    <div className={`multi-progress ${className}`} style={style}>
      <div className="multi-progress-track">
        {values.map((item, index) => {
          const percentage = (item.value / max) * 100;
          const width = stacked ? percentage : 0;
          const startPos = accumulatedWidth;
          accumulatedWidth += percentage;

          return (
            <div
              key={index}
              className="multi-progress-segment"
              style={{
                width: stacked ? `${percentage}%` : 'auto',
                left: stacked ? `${startPos}%` : 'auto',
                background: item.color || `#3b82f6`,
              }}
            >
              {item.label && !stacked && (
                <span className="multi-progress-label">{item.label}</span>
              )}
            </div>
          );
        })}
      </div>
      {showTotal && (
        <div className="multi-progress-total">
          {total.toFixed(0)} / {max} ({totalPercentage.toFixed(0)}%)
        </div>
      )}
    </div>
  );
};

MultiProgress.displayName = 'MultiProgress';

export default Progress;