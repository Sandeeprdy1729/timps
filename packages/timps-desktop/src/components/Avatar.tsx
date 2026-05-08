/**
 * TIMPS Desktop - Avatar
 * User avatars and profile pictures.
 */

import './Avatar.css';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy' | 'away';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getColor(name: string): string {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
}

export function Avatar({ src, name, size = 'md', status }: AvatarProps) {
  const initials = name ? getInitials(name) : '?';
  const backgroundColor = name ? getColor(name) : 'var(--bg-tertiary)';

  return (
    <div className={`avatar avatar-${size}`}>
      {src ? (
        <img src={src} alt={name} />
      ) : (
        <div className="avatar-fallback" style={{ backgroundColor }}>
          {initials}
        </div>
      )}
      {status && <span className={`avatar-status status-${status}`} />}
    </div>
  );
}

interface AvatarGroupProps {
  avatars: { src?: string; name: string }[];
  max?: number;
  size?: 'xs' | 'sm' | 'md';
}

export function AvatarGroup({ avatars, max = 4, size = 'sm' }: AvatarGroupProps) {
  const visible = avatars.slice(0, max);
  const remaining = avatars.length - max;

  return (
    <div className="avatar-group">
      {visible.map((avatar, index) => (
        <Avatar key={index} src={avatar.src} name={avatar.name} size={size} />
      ))}
      {remaining > 0 && (
        <div className={`avatar-group-more avatar-${size}`}>+{remaining}</div>
      )}
    </div>
  );
}

interface UserCardProps {
  name: string;
  email?: string;
  avatar?: string;
  status?: 'online' | 'offline' | 'busy' | 'away';
  onClick?: () => void;
}

export function UserCard({ name, email, avatar, status, onClick }: UserCardProps) {
  return (
    <div className={`user-card ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <Avatar src={avatar} name={name} size="lg" status={status} />
      <div className="user-info">
        <span className="user-name">{name}</span>
        {email && <span className="user-email">{email}</span>}
      </div>
    </div>
  );
}