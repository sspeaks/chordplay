import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import unmuteAudio from 'unmute-ios-audio'

// Unmute Web Audio on iOS even when the hardware silent switch is on.
// Must be called early so it can register user-activation event handlers.
unmuteAudio()

// Load Eruda on-device console when ?debug is in the URL
if (new URLSearchParams(window.location.search).has('debug')) {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/eruda';
  script.onload = () => (window as any).eruda?.init();
  document.head.appendChild(script);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)