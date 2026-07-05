import React from 'react';

export interface ProgressProps {
  value: number;
  size?: 'small' | 'large';
  showLabel?: boolean;
  striped?: boolean;
  animated?: boolean;
  status?: 'success' | 'warning' | 'error';
  type?: 'line' | 'circle' | 'dashboard';
  label?: string;
}

const statusColors: Record<string, string> = { success: '#22c55e', warning: '#f59e0b', error: '#ef4444' };
const sizeHeights: Record<string, number> = { small: 6, large: 16 };

export const Progress: React.FC<ProgressProps> = ({ value, size = 'small', showLabel, striped, animated, status, type = 'line', label }) => {
  const clamped = Math.max(0, Math.min(100, value));
  const color = status ? statusColors[status] : '#4f46e5';

  if (type === 'circle') {
    const r = 40;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (clamped / 100) * circumference;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <svg width={100} height={100}>
          <circle cx={50} cy={50} r={r} fill="none" stroke="#e5e7eb" strokeWidth={8} />
          <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={8} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 50 50)" />
        </svg>
        {showLabel && <span style={{ fontSize: 14, fontWeight: 600 }}>{Math.round(clamped)}%</span>}
        {label && <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>}
      </div>
    );
  }

  if (type === 'dashboard') {
    const r = 40;
    const circumference = 2 * Math.PI * r * 0.75;
    const offset = circumference - (clamped / 100) * circumference;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <svg width={100} height={100}>
          <path d="M 12 85 A 40 40 0 1 1 88 85" fill="none" stroke="#e5e7eb" strokeWidth={8} />
          <path d="M 12 85 A 40 40 0 1 1 88 85" fill="none" stroke={color} strokeWidth={8} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        {showLabel && <span style={{ fontSize: 14, fontWeight: 600 }}>{Math.round(clamped)}%</span>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: sizeHeights[size], background: '#e5e7eb', borderRadius: sizeHeights[size], overflow: 'hidden' }}>
          <div style={{
            width: `${clamped}%`, height: '100%', background: color, borderRadius: sizeHeights[size],
            transition: 'width 0.3s',
            backgroundImage: striped ? 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)' : undefined,
            backgroundSize: striped ? '1rem 1rem' : undefined,
            animation: animated ? 'progress-stripes 1s linear infinite' : undefined,
          }} />
        </div>
        {showLabel && <span style={{ fontSize: 12, fontWeight: 600, minWidth: 35, textAlign: 'right' }}>{Math.round(clamped)}%</span>}
      </div>
    </div>
  );
};
