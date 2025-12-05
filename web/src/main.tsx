/**
 * main.tsx - Application Entry Point
 * 
 * This is the root file that React uses to mount the application to the DOM.
 * 
 * Responsibilities:
 * - Imports the App component
 * - Imports global CSS styles
 * - Mounts the React app to the #root div in index.html
 * 
 * IMPORTANT: We do NOT wrap App in a Router here because App.tsx
 * already has its own BrowserRouter. Having two Routers causes errors.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/**
 * Mount React Application
 * 
 * Steps:
 * 1. Find the #root element in index.html
 * 2. Create a React root
 * 3. Render the App component wrapped in React.StrictMode
 * 
 * React.StrictMode:
 * - Highlights potential problems in development
 * - Does not render any visible UI
 * - Only runs in development mode (stripped in production)
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 
      App component contains its own BrowserRouter 
      Do NOT wrap App in another Router here
    */}
    <App />
  </React.StrictMode>,
);