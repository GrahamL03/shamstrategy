import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Theme CSS entry point (Tailwind v4 tokens + Custom Themes)
import './styles/themes.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);