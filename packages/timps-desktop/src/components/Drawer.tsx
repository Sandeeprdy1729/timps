import React, { useState, createContext, useContext, ReactNode, CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import './Drawer.css';

export interface DrawerContextValue {
  isOpen: boolean;
  close: () => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function useDrawer() {
  const context = useContext(DrawerContext);
  if (!context) throw new Error('useDrawer must be used within DrawerProvider');
  return context;
}

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  position?: 'left' | 'right' | 'top' | 'bottom';
  size?: string | number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Drawer({
  isOpen,
  onClose,
  position = 'right',
  size = 320,
  children,
  className = '',
  style,
}: DrawerProps) {
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setMounted(true);
      document.body.style.overflow = 'hidden';
    } else {
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    onClose();
  };

  const drawerStyle: CSSProperties = {
    ...style,
    [position]: 0,
    width: position === 'left' || position === 'right' ? size : undefined,
    height: position === 'top' || position === 'bottom' ? size : undefined,
  };

  if (!mounted) return null;

  return createPortal(
    <DrawerContext.Provider value={{ isOpen, close: handleClose }}>
      <div className={`drawer-overlay ${isOpen ? 'open' : ''}`} onClick={handleClose} />
      <div
        className={`drawer drawer-${position} ${isOpen ? 'open' : ''} ${className}`}
        style={drawerStyle}
      >
        {children}
      </div>
    </DrawerContext.Provider>,
    document.body
  );
}

export interface DrawerHeaderProps {
  children?: ReactNode;
  className?: string;
}

export function DrawerHeader({ children, className = '' }: DrawerHeaderProps) {
  return <div className={`drawer-header ${className}`}>{children}</div>;
}

export interface DrawerBodyProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function DrawerBody({ children, className = '', style }: DrawerBodyProps) {
  return (
    <div className={`drawer-body ${className}`} style={style}>
      {children}
    </div>
  );
}

export interface DrawerFooterProps {
  children?: ReactNode;
  className?: string;
}

export function DrawerFooter({ children, className = '' }: DrawerFooterProps) {
  return <div className={`drawer-footer ${className}`}>{children}</div>;
}

export interface DrawerCloseProps {
  className?: string;
}

export function DrawerClose({ className = '' }: DrawerCloseProps) {
  const { close } = useDrawer();
  return (
    <button type="button" className={`drawer-close ${className}`} onClick={close}>
      ×
    </button>
  );
}

export default Drawer;