import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// CSS Theme Entrypoint (Tailwind v4 + Custom Properties)
import './styles/themes.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);