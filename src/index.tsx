import React from 'react';
import ReactDOM from 'react-dom/client';
import './ui/theme.css';
import './index.css';
import App from './App';
import { initializeGoogleAnalytics } from '@shared/helpers/google-analytics.helper';

initializeGoogleAnalytics();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
