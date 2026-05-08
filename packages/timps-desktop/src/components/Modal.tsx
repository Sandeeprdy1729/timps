/**
 * TIMPS Desktop - Modal system
 * Reusable modal component.
 */

import { useEffect, useRef, useState, createContext, useContext } from 'react';

interface ModalOptions {
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closable?: boolean;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
}

interface ModalContextValue {
  open: (content: React.ReactNode, options?: ModalOptions) => void;
  close: () => void;
  isOpen: boolean;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
}

interface ModalProviderProps {
  children: React.ReactNode;
}

export function ModalProvider({ children }: ModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<React.ReactNode>(null);
  const [options, setOptions] = useState<ModalOptions>({
    closable: true,
    closeOnOverlay: true,
    closeOnEscape: true,
  });

  const open = (newContent: React.ReactNode, newOptions?: ModalOptions) => {
    setContent(newContent);
    setOptions({ ...options, ...newOptions });
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setContent(null);
  };

  return (
    <ModalContext.Provider value={{ open, close, isOpen }}>
      {children}
      {isOpen && <ModalContent content={content} options={options} onClose={close} />}
    </ModalContext.Provider>
  );
}

function ModalContent({ 
  content, 
  options, 
  onClose 
}: { 
  content: React.ReactNode;
  options: ModalOptions;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (options.closeOnEscape) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [options.closeOnEscape, onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (options.closeOnOverlay && e.target === overlayRef.current) {
      onClose();
    }
  };

  const sizeClass = options.size ? `modal-${options.size}` : '';

  return (
    <div 
      ref={overlayRef}
      className="modal-overlay"
      onClick={handleOverlayClick}
    >
      <div className={`modal-container ${sizeClass}`}>
        {options.title && (
          <div className="modal-header">
            <h3 className="modal-title">{options.title}</h3>
            {options.closable && (
              <button className="modal-close" onClick={onClose}>✕</button>
            )}
          </div>
        )}
        <div className="modal-content">
          {content}
        </div>
      </div>
    </div>
  );
}

// Modal hook-based component
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, size = 'md', children }: ModalProps) {
  const [exiting, setExiting] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    setExiting(true);
    setTimeout(() => {
      setExiting(false);
      onClose();
    }, 200);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      handleClose();
    }
  };

  if (!isOpen && !exiting) return null;

  return (
    <div 
      ref={overlayRef}
      className={`modal-overlay ${exiting ? 'exiting' : ''}`}
      onClick={handleOverlayClick}
    >
      <div className={`modal-container modal-${size}`}>
        {title && (
          <div className="modal-header">
            <h3 className="modal-title">{title}</h3>
            <button className="modal-close" onClick={handleClose}>✕</button>
          </div>
        )}
        <div className="modal-content">
          {children}
        </div>
      </div>
    </div>
  );
}

// Confirmation modal
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
}: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="confirm-message">{message}</p>
      <div className="confirm-actions">
        <button className="btn btn-secondary" onClick={onClose}>
          {cancelLabel}
        </button>
        <button 
          className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
          onClick={handleConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}