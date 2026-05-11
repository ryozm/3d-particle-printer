import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<Loading />}>
      <App />
    </Suspense>
  </React.StrictMode>
)

function Loading() {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#000',
      color: '#0ff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'monospace',
      fontSize: '1.2rem',
    }}>
      Loading...
    </div>
  )
}
