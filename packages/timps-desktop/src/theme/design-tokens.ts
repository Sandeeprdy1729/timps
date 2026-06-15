/**
 * TIMPS Design Tokens
 * Modern color system and design tokens for TIMPS Desktop
 */

export const designTokens = {
  // Color System
  colors: {
    // Primary palette - TIMPS signature green
    primary: {
      50: '#f0f7f4',
      100: '#dcf0ea',
      200: '#c3e9dc',
      300: '#a9e2d0',
      400: '#8fdbc4',
      500: '#75d5b8', // Main primary
      600: '#5cc0ab',
      700: '#52ad9a',
      800: '#499b87',
      900: '#407a72',
    },
    
    // Secondary palette - warm earth tones
    secondary: {
      50: '#fdf8f0',
      100: '#fcf1de',
      200: '#fae9be',
      300: '#f8e09e',
      400: '#f6d97e',
      500: '#f4d05e', // Main secondary
      600: '#e1be56',
      700: '#cfa94d',
      800: '#bc954c',
      900: '#aa8549',
    },
    
    // Neutral system
    neutral: {
      0: '#ffffff',
      50: '#fafbfc',
      100: '#f2f5f7',
      200: '#e9ecf0',
      300: '#e0e4e7',
      400: '#d7dee3',
      500: '#cfd7dc', // Main neutral
      600: '#b9c1c7',
      700: '#a6acaf',
      800: '#8e95a0',
      900: '#777b8d',
      950: '#5a5e6b',
      975: '#3d4150',
      1000: '#121216',
    },
    
    // Status colors
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    
    // Semantic colors
    bg: {
      primary: '#ffffff',
      secondary: '#fafbfc',
      tertiary: '#f2f5f7',
      overlay: 'rgba(18, 18, 22, 0.8)',
      modal: 'rgba(18, 18, 22, 0.95)',
    },
    
    text: {
      primary: '#121216',
      secondary: '#5a5e6b',
      tertiary: '#8e95a0',
      disabled: '#cfd7dc',
      inverse: '#ffffff',
    },
    
    border: {
      primary: '#e0e4e7',
      secondary: '#f2f5f7',
      tertiary: '#e9ecf0',
      focus: '#3b82f6',
      error: '#ef4444',
    },
    
    // Special
    accent: '#3b82f6',
    accentDark: '#1d4ed8',
    accentLight: '#dbeafe',
  },
  
  // Typography
  typography: {
    fontFamily: {
      primary: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: 'SF Mono, Monaco, Menlo, monospace',
    },
    
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
    },
    
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
    
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
      loose: 2,
    },
  },
  
  // Spacing
  spacing: {
    px: '1px',
    0: '0',
    0.5: '0.25rem',   // 4px
    1: '0.5rem',      // 8px
    1.5: '0.75rem',   // 12px
    2: '1rem',        // 16px
    2.5: '1.25rem',   // 20px
    3: '1.5rem',      // 24px
    3.5: '1.75rem',   // 28px
    4: '2rem',        // 32px
    5: '2.5rem',      // 40px
    6: '3rem',        // 48px
    8: '4rem',        // 64px
    10: '5rem',       // 80px
    12: '6rem',       // 96px
    16: '8rem',       // 128px
  },
  
  // Border radius
  borderRadius: {
    none: '0',
    sm: '0.25rem',    // 4px
    base: '0.5rem',   // 8px
    md: '0.75rem',    // 12px
    lg: '1rem',       // 16px
    xl: '1.5rem',     // 24px
    '2xl': '2rem',    // 32px
    full: '9999px',
  },
  
  // Shadows
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px rgba(0, 0, 0, 0.1)',
    md: '0 2px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 4px 12px rgba(0, 0, 0, 0.1)',
    xl: '0 8px 24px rgba(0, 0, 0, 0.12)',
    '2xl': '0 12px 36px rgba(0, 0, 0, 0.15)',
    inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
    focus: '0 0 0 3px rgba(59, 130, 246, 0.3)',
  },
  
  // Z-index
  zIndex: {
    hide: -1,
    auto: 'auto',
    base: 0,
    docked: 10,
    dropdown: 1000,
    sticky: 1100,
    banner: 1200,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    skipLink: 1600,
    toast: 1700,
    tooltip: 1800,
  },
  
  // Breakpoints
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  
  // Animation
  animation: {
    duration: {
      fast: '150ms',
      normal: '300ms',
      slow: '500ms',
      slower: '700ms',
    },
    
    easing: {
      linear: 'linear',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },
};

export type DesignTokens = typeof designTokens;
