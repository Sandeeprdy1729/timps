import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from './theme/ThemeProvider';
import { PopupChat } from './components/PopupChat';
import './index.css';

const rootStyle = document.createElement('style');
rootStyle.textContent = `
  html, body, #root {
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: 0 0 16px 16px;
  }
  body {
    border-radius: 0 0 16px 16px;
  }
`;
document.head.appendChild(rootStyle);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <PopupChat />
    </ThemeProvider>
  </React.StrictMode>,
);
