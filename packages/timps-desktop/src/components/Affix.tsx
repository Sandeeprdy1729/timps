import React, { useState, useEffect, useCallback, useRef, CSSProperties } from 'react';
import './Affix.css';

export interface AffixProps {
  children: React.ReactNode;
  offset?: number;
  target?: () => HTMLElement | null;
  position?: 'top' | 'bottom';
  className?: string;
  style?: CSSProperties;
}

export function Affix({
  children,
  offset = 0,
  target,
  position = 'top',
  className = '',
  style,
}: AffixProps) {
  const [isAffixed, setIsAffixed] = useState(false);
  const [affixStyle, setAffixStyle] = useState<CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const checkPosition = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const targetElement = target ? target() : document.documentElement;
    if (!targetElement) return;

    const containerRect = container.getBoundingClientRect();
    const targetScrollTop = targetElement.scrollTop || 0;
    const expectedTop = targetScrollTop + offset;

    if (position === 'top') {
      if (containerRect.top <= offset) {
        setIsAffixed(true);
        setAffixStyle({
          position: 'fixed',
          top: offset,
          left: containerRect.left,
          right: containerRect.right,
          width: containerRect.width,
        });
      } else {
        setIsAffixed(false);
        setAffixStyle({});
      }
    } else {
      const targetHeight = targetElement.clientHeight || window.innerHeight;
      if (containerRect.bottom >= targetHeight - offset) {
        setIsAffixed(true);
        setAffixStyle({
          position: 'fixed',
          bottom: offset,
          left: containerRect.left,
          right: containerRect.right,
          width: containerRect.width,
        });
      } else {
        setIsAffixed(false);
        setAffixStyle({});
      }
    }
  }, [offset, target, position]);

  useEffect(() => {
    const targetElement = target ? target() : window;
    if (!targetElement) return;

    targetElement.addEventListener('scroll', checkPosition);
    targetElement.addEventListener('resize', checkPosition);

    checkPosition();

    return () => {
      targetElement.removeEventListener('scroll', checkPosition);
      targetElement.removeEventListener('resize', checkPosition);
    };
  }, [checkPosition, target]);

  return (
    <div
      ref={containerRef}
      className={`affix-container ${isAffixed ? 'affixed' : ''} ${className}`}
      style={style}
    >
      <div className="affix-target" style={affixStyle}>
        {children}
      </div>
    </div>
  );
}

export interface BackToTopProps {
  target?: () => HTMLElement | null;
  threshold?: number;
  className?: string;
  style?: CSSProperties;
}

export function BackToTop({
  target,
  threshold = 300,
  className = '',
  style,
}: BackToTopProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const targetElement = target ? target() : document.documentElement;
      if (!targetElement) return;

      const scrollTop = targetElement.scrollTop || 0;
      setIsVisible(scrollTop > threshold);
    };

    const targetElement = target ? target() : window;
    if (!targetElement) return;

    targetElement.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => {
      targetElement.removeEventListener('scroll', handleScroll);
    };
  }, [target, threshold]);

  const scrollToTop = useCallback(() => {
    const targetElement = target ? target() : document.documentElement;
    targetElement?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [target]);

  if (!isVisible) return null;

  return (
    <button
      type="button"
      className={`back-to-top ${className}`}
      onClick={scrollToTop}
      style={style}
    >
      ↑
    </button>
  );
}

export default Affix;