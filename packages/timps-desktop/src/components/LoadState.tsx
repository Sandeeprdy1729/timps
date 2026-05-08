/**
 * TIMPS Desktop - Validation errors display
 * Error boundary and validation display.
 */

import './Error.css';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <ErrorDisplay error={this.state.error} />;
    }
    return this.props.children;
  }
}

import React from 'react';

export function ErrorDisplay({ error, onRetry }: { error?: Error; onRetry?: () => void }) {
  return (
    <div className="error-display">
      <div className="error-icon">⚠</div>
      <h3>Something went wrong</h3>
      <p>{error?.message || 'An unexpected error occurred'}</p>
      {onRetry && <button onClick={onRetry}>Try again</button>}
    </div>
  );
}

interface ValidationErrorsProps {
  errors: Record<string, string>;
}

export function ValidationErrors({ errors }: ValidationErrorsProps) {
  const errorList = Object.entries(errors);
  if (errorList.length === 0) return null;

  return (
    <div className="validation-errors">
      {errorList.map(([field, message]) => (
        <div key={field} className="error-item">
          <span className="error-field">{field}</span>
          <span className="error-message">{message}</span>
        </div>
      ))}
    </div>
  );
}

interface LoadingProps {
  fullscreen?: boolean;
  text?: string;
}

export function Loading({ fullscreen, text }: LoadingProps) {
  if (fullscreen) {
    return (
      <div className="loading-fullscreen">
        <div className="loading-spinner" />
        {text && <p>{text}</p>}
      </div>
    );
  }
  return (
    <div className="loading-inline">
      <div className="loading-spinner" />
      {text && <span>{text}</span>}
    </div>
  );
}

interface SkeletonProps {
  variant?: 'text' | 'rect' | 'circle';
  width?: string;
  height?: string;
}

export function LoadingSkeleton({ variant = 'text', width, height }: SkeletonProps) {
  return (
    <div 
      className={`loading-skeleton skeleton-${variant}`}
      style={{ width, height }}
    />
  );
}

export function SkeletonList({ items = 5 }: { items?: number }) {
  return (
    <div className="skeleton-list">
      {Array.from({ length: items }).map((_, i) => (
        <LoadingSkeleton key={i} variant="rect" height="60px" />
      ))}
    </div>
  );
}