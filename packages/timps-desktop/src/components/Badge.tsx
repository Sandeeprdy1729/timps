/**
 * TIMPS Desktop - Badge component
 * Notification badges and status indicators.
 */

import './Badge.css';

interface BadgeProps {
  count?: number;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'default';
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
}

export function Badge({ count, variant = 'default', size = 'md', children }: BadgeProps) {
  if (count === undefined) {
    return children ? <span className={`badge badge-${size}`}>{children}</span> : null;
  }

  if (count <= 0) return null;

  return (
    <span className={`badge badge-${size} badge-${variant}`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function StatusDot({ status }: { status: 'online' | 'offline' | 'busy' | 'away' }) {
  return <span className={`status-dot status-${status}`} />;
}

export function ProgressBar({ 
  value, 
  max = 100, 
  showLabel = false 
}: { 
  value: number; 
  max?: number; 
  showLabel?: boolean;
}) {
  const percent = Math.min(Math.round((value / max) * 100), 100);
  
  return (
    <div className="progress-bar">
      <div 
        className="progress-fill" 
        style={{ width: `${percent}%` }}
      />
      {showLabel && <span className="progress-label">{percent}%</span>}
    </div>
  );
}

export function Skeleton({ 
  width, 
  height, 
  variant = 'text' 
}: { 
  width?: string; 
  height?: string; 
  variant?: 'text' | 'circle' | 'rect';
}) {
  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div 
      className={`skeleton skeleton-${variant}`} 
      style={style}
    />
  );
}

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return <div className={`spinner spinner-${size}`} />;
}

export function Tooltip({ 
  children, 
  text 
}: { 
  children: React.ReactNode; 
  text: string;
}) {
  return (
    <div className="tooltip-wrapper">
      {children}
      <span className="tooltip-text">{text}</span>
    </div>
  );
}