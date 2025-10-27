import React from 'react';
import ReactDOM from 'react-dom/client';
// FIX: Added .tsx extension to module import.
import App from './App.tsx';
// FIX: Added .tsx extension to module import.
import { LanguageProvider } from './hooks/useTranslation.tsx';

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