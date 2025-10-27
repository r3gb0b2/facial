import React from 'react';
import ReactDOM from 'react-dom/client';
// FIX: Removed .tsx extension from module imports to fix module resolution errors.
import App from './App';
import { LanguageProvider } from './hooks/useTranslation';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>
);