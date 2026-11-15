import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyThemePreference } from './lib/theme'

/* Resolve System / Light / Dark before first paint of React tree */
applyThemePreference()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
