export const TIMPS_THEME = `
:root {
  --timps-bg: #14140F;
  --timps-bg2: #1C1C14;
  --timps-bg3: #252518;
  --timps-bg-hover: #2D2D1E;
  --timps-surface: #1A1D18;
  --timps-text: #F5F0E1;
  --timps-text2: #C8BF8C;
  --timps-text-muted: #8A9098;
  --timps-accent: #4A8C7A;
  --timps-accent-hover: #7EC8B8;
  --timps-accent-light: rgba(74,140,122,0.12);
  --timps-accent-glow: rgba(74,140,122,0.25);
  --timps-border: #2D5A4F;
  --timps-border-light: #3D7A6A;
  --timps-border-focus: #4A8C7A;
  --timps-error: #C83838;
  --timps-warning: #C8B94F;
  --timps-success: #28A070;
  --timps-info: #7EC8B8;
  --timps-radius-sm: 2px;
  --timps-radius-md: 4px;
  --timps-radius-lg: 8px;
  --timps-radius-xl: 12px;
  --timps-font: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --timps-font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
  --timps-code-bg: #0C0E0A;
  --timps-user-bg: #162018;
  --timps-dot-red: #FF5F57;
  --timps-dot-yellow: #FEBC2E;
  --timps-dot-green: #28C840;
  --timps-sidebar-width: 220px;
}
`;

export const TIMPS_ANIMATIONS = `
@keyframes fadeSlide { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
@keyframes fadeIn { from{opacity:0} to{opacity:1} }
@keyframes dotBounce { 0%,80%,100%{transform:scale(0.5);opacity:0.3} 40%{transform:scale(1);opacity:1} }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
@keyframes robotFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
@keyframes robotBlink { 0%,85%,100%{transform:scaleY(1)} 92%{transform:scaleY(0.08)} }
@keyframes statusPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
}
`;

export const TIMPS_GLOBAL_RESET = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--timps-font);
  background: var(--timps-bg);
  color: var(--timps-text);
  font-size: 13px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--timps-border); border-radius: 2px; }
::selection { background: var(--timps-accent-light); }
`;
