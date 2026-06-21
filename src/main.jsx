import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { InventoryProvider } from './context/InventoryContext.jsx';
import { LabProvider } from './context/LabContext.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <InventoryProvider>
        <LabProvider>
          <App />
        </LabProvider>
      </InventoryProvider>
    </AuthProvider>
  </React.StrictMode>
);
