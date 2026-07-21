import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyTheme, getTheme } from './appSettings';
import './index.css';

applyTheme(getTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
