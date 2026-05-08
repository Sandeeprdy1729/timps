import React, { forwardRef, useState, useCallback, useEffect, useRef, ReactNode, CSSProperties, createPortal } from 'react';
import './Popover.css';

export interface PopoverProps {
  children: ReactNode;
  content: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'click' | 'hover' | 'focus';
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const Popover = forwardRef<HTMLDivElement, PopoverProps>(({
  children,
  content,
  position = 'bottom',
  trigger = 'click',
  disabled,
  className = '',
  style,
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [positionStyle, setPositionStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !popoverRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popoverRect = popoverRef.current.getBoundingClientRect();
    const gap = 8;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = triggerRect.top - popoverRect.height - gap;
        left = triggerRect.left + (triggerRect.width - popoverRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + gap;
        left = triggerRect.left + (triggerRect.width - popoverRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - popoverRect.height) / 2;
        left = triggerRect.left - popoverRect.width - gap;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - popoverRect.height) / 2;
        left = triggerRect.right + gap;
        break;
    }

    setPositionStyle({
      position: 'fixed',
      top: Math.max(0, top + window.scrollY),
      left: Math.max(0, left + window.scrollX),
    });
  }, [position]);

  const showPopover = useCallback(() => {
    if (disabled) return;
    calculatePosition();
    setIsOpen(true);
  }, [disabled, calculatePosition]);

  const hidePopover = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('scroll', hidePopover);
      window.addEventListener('resize', calculatePosition);
      return () => {
        window.removeEventListener('scroll', hidePopover);
        window.removeEventListener('resize', calculatePosition);
      };
    }
  }, [isOpen, hidePopover, calculatePosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleClick = useCallback(() => {
    if (trigger === 'click') {
      isOpen ? hidePopover() : showPopover();
    }
  }, [trigger, isOpen, showPopover, hidePopover]);

  const handleMouseEnter = useCallback(() => {
    if (trigger === 'hover') showPopover();
  }, [trigger, showPopover]);

  const handleMouseLeave = useCallback(() => {
    if (trigger === 'hover') hidePopover();
  }, [trigger, hidePopover]);

  const handleFocus = useCallback(() => {
    if (trigger === 'focus') showPopover();
  }, [trigger, showPopover]);

  const handleBlur = useCallback(() => {
    if (trigger === 'focus') hidePopover();
  }, [trigger, hidePopover]);

  return (
    <>
      <div
        ref={(node) => {
          triggerRef.current = node;
          if (typeof ref === 'function') ref(node);
        }}
        className={`popover-trigger ${className}`}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={style}
      >
        {children}
      </div>
      {isOpen && createPortal(
        <div
          ref={popoverRef}
          className={`popover popover-${position} ${isOpen ? 'open' : ''}`}
          style={positionStyle}
          role="popover"
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
});

Popover.displayName = 'Popover';

export interface PopoverContentProps {
  children?: ReactNode;
  className?: string;
}

export const PopoverContent: React.FC<PopoverContentProps> = ({
  children,
  className = '',
}) => {
  return <div className={`popover-content ${className}`}>{children}</div>;
};

export interface PopoverHeaderProps {
  children?: ReactNode;
  className?: string;
}

export const PopoverHeader: React.FC<PopoverHeaderProps> = ({
  children,
  className = '',
}) => {
  return <div className={`popover-header ${className}`}>{children}</div>;
};

export interface PopoverFooterProps {
  children?: ReactNode;
  className?: string;
}

export const PopoverFooter: React.FC<PopoverFooterProps> = ({
  children,
  className = '',
}) => {
  return <div className={`popover-footer ${className}`}>{children}</div>;
};

export default Popover;