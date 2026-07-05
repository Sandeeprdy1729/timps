import React from 'react';

export interface AvatarProps {
  name?: string;
  src?: string;
  size?: 'small' | 'large' | 'xlarge';
  status?: 'online' | 'offline' | 'busy' | 'away';
  shape?: 'circle' | 'square' | 'rounded';
  count?: number;
}

const sizeMap: Record<string, number> = { small: 28, large: 48, xlarge: 64 };

const initials = (name: string) =>
  name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

const statusColors: Record<string, string> = { online: '#22c55e', offline: '#9ca3af', busy: '#ef4444', away: '#f59e0b' };

export const Avatar: React.FC<AvatarProps> = ({ name = '', src, size = 'small', status, shape = 'circle', count }) => {
  const px = sizeMap[size];
  const borderRadius = shape === 'circle' ? '50%' : shape === 'square' ? 4 : 8;

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {src ? (
        <img src={src} alt={name} style={{ width: px, height: px, borderRadius, objectFit: 'cover', background: '#e5e7eb' }} />
      ) : (
        <div style={{ width: px, height: px, borderRadius, background: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: px * 0.35, fontWeight: 600 }}>
          {count ? `+${count}` : initials(name)}
        </div>
      )}
      {status && (
        <span style={{ position: 'absolute', bottom: 0, right: 0, width: px * 0.3, height: px * 0.3, borderRadius: '50%', background: statusColors[status], border: '2px solid #fff' }} />
      )}
    </div>
  );
};
