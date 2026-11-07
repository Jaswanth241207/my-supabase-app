import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import './index.css'

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: import.meta.env.VITE_APP_ENV ?? 'production', tracesSampleRate: 0.1, sendDefaultPii: false })
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<div className="p-8 text-center">Something went wrong. Please reload the page.</div>}>
      <BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)
