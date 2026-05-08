/**
 * TIMPS Desktop - Card
 * Card and container components.
 */

import './Card.css';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ 
  children, 
  title, 
  subtitle, 
  footer, 
  variant = 'default',
  padding = 'md' 
}: CardProps) {
  return (
    <div className={`card card-${variant} padding-${padding}`}>
      {(title || subtitle) && (
        <div className="card-header">
          {title && <h3 className="card-title">{title}</h3>}
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
      )}
      <div className="card-content">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}

interface MediaCardProps {
  image?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function MediaCard({ image, title, description, actions }: MediaCardProps) {
  return (
    <div className="media-card">
      {image && <div className="media-image"><img src={image} alt="" /></div>}
      <div className="media-content">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
        {actions && <div className="media-actions">{actions}</div>}
      </div>
    </div>
  );
}

interface ListItemProps {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
}

export function ListItem({ leading, title, subtitle, trailing, onClick }: ListItemProps) {
  return (
    <div className={`list-item ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      {leading && <div className="list-leading">{leading}</div>}
      <div className="list-content">
        <span className="list-title">{title}</span>
        {subtitle && <span className="list-subtitle">{subtitle}</span>}
      </div>
      {trailing && <div className="list-trailing">{trailing}</div>}
    </div>
  );
}

interface ActionCardProps {
  icon: string;
  title: string;
  description: string;
  action: () => void;
}

export function ActionCard({ icon, title, description, action }: ActionCardProps) {
  return (
    <div className="action-card" onClick={action}>
      <span className="action-icon">{icon}</span>
      <span className="action-title">{title}</span>
      <span className="action-description">{description}</span>
    </div>
  );
}

interface StatCardProps {
  value: string | number;
  label: string;
  change?: { value: number; positive: boolean };
  icon?: string;
}

export function StatCard({ value, label, change, icon }: StatCardProps) {
  return (
    <div className="stat-card">
      {icon && <span className="stat-icon">{icon}</span>}
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {change && (
        <span className={`stat-change ${change.positive ? 'positive' : 'negative'}`}>
          {change.positive ? '↑' : '↓'} {Math.abs(change.value)}%
        </span>
      )}
    </div>
  );
}