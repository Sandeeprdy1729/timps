import React from 'react';

export interface ModalProps {
  open?: boolean;
  onClose?: () => void;
  size?: 'small' | 'large';
  fullscreen?: boolean;
  centered?: boolean;
  closable?: boolean;
  maskClosable?: boolean;
  children?: React.ReactNode;
}

const sizeMap: Record<string, string> = { small: '400px', large: '800px' };

export const Modal: React.FC<ModalProps> & {
  Header: React.FC<{ children?: React.ReactNode }>;
  Body: React.FC<{ children?: React.ReactNode }>;
  Footer: React.FC<{ children?: React.ReactNode }>;
} = ({ open, onClose, size, fullscreen, centered, closable, maskClosable = true, children }) => {
  if (!open) return null;
  const width = fullscreen ? '100vw' : size ? sizeMap[size] : '600px';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: centered ? 'center' : 'flex-start', justifyContent: 'center', paddingTop: centered ? 0 : 80 }}
      onClick={maskClosable ? onClose : undefined}
    >
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', width, maxWidth: fullscreen ? undefined : '90vw', maxHeight: fullscreen ? undefined : '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

Modal.Header = ({ children }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb', fontSize: 16, fontWeight: 600 }}>
    {children}
  </div>
);

Modal.Body = ({ children }) => (
  <div style={{ padding: '16px 20px', overflow: 'auto', flex: 1, fontSize: 14 }}>
    {children}
  </div>
);

Modal.Footer = ({ children }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid #e5e7eb' }}>
    {children}
  </div>
);
