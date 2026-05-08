import React, { useState, useCallback, CSSProperties, createPortal } from 'react';
import './Alert.css';

export interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  icon?: React.ReactNode;
  closable?: boolean;
  onClose?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function Alert({
  type = 'info',
  title,
  message,
  icon,
  closable = false,
  onClose,
  className = '',
  style,
}: AlertProps) {
  const [isVisible, setIsVisible] = useState(true);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    onClose?.();
  }, [onClose]);

  if (!isVisible) return null;

  return (
    <div className={`alert alert-${type} ${className}`} style={style} role="alert">
      <div className="alert-icon">
        {icon || <span className={`alert-icon-default icon-${type}`} />}
      </div>
      <div className="alert-content">
        {title && <div className="alert-title">{title}</div>}
        <div className="alert-message">{message}</div>
      </div>
      {closable && (
        <button
          type="button"
          className="alert-close"
          onClick={handleClose}
          aria-label="Close"
        >
          ×
        </button>
      )}
    </div>
  );
}

export interface AlertBannerProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  message: string;
  action?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export function AlertBanner({
  type = 'info',
  message,
  action,
  onDismiss,
  className = '',
}: AlertBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  if (!isVisible) return null;

  return (
    <div className={`alert-banner alert-banner-${type} ${className}`}>
      <div className="alert-banner-content">
        <span className="alert-banner-message">{message}</span>
        {action && <div className="alert-banner-action">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          className="alert-banner-close"
          onClick={handleDismiss}
        >
          ×
        </button>
      )}
    </div>
  );
}

export interface ToastAlertProps {
  id: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  duration?: number;
  onClose: (id: string) => void;
}

export function ToastAlert({
  id,
  type = 'info',
  title,
  message,
  duration = 3000,
  onClose,
}: ToastAlertProps) {
  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onClose(id), duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  return (
    <Alert
      type={type}
      title={title}
      message={message}
      closable
      onClose={() => onClose(id)}
    />
  );
}

export default Alert;