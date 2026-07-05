import React, { useState, useRef, useEffect } from 'react';

export interface TooltipProps {
  content: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
  mouseEnterDelay?: number;
  visible?: boolean;
  theme?: 'dark' | 'light';
}

const placementStyles: Record<string, React.CSSProperties> = {
  top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6 },
  bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6 },
  left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 6 },
  right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 6 },
};

export const Tooltip: React.FC<TooltipProps> = ({ content, placement = 'top', children, mouseEnterDelay = 0, visible: controlledVisible, theme = 'dark' }) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const isVisible = controlledVisible ?? visible;

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const show = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(true), mouseEnterDelay * 1000);
  };
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {isVisible && (
        <span style={{
          position: 'absolute', ...placementStyles[placement],
          background: theme === 'dark' ? '#1f2937' : '#fff',
          color: theme === 'dark' ? '#fff' : '#111827',
          padding: '6px 10px', borderRadius: 6, fontSize: 13, whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 1000,
          pointerEvents: 'none',
        }}>
          {content}
        </span>
      )}
    </span>
  );
};
