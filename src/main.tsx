import { Buffer } from 'buffer'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { loadRuntimeBackendConfig } from './lib/runtimeBackendConfig'
import './index.css'

if (typeof globalThis !== 'undefined') (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer

const rootEl = document.getElementById('root')!
rootEl.innerHTML =
  '<div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;font-family:Outfit,system-ui,sans-serif;font-size:1rem;color:#94a3b8;background:#020509;">Cargando…</div>'

void loadRuntimeBackendConfig()
  .catch(() => {})
  .finally(() => {
    rootEl.innerHTML = ''
    void import('./App').then(({ default: App }) => {
      ReactDOM.createRoot(rootEl).render(
        <React.StrictMode>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <App />
          </BrowserRouter>
        </React.StrictMode>,
      )
    })
  })
