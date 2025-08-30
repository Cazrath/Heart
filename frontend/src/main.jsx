import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './ui/App'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(<App />)
