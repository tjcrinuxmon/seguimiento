import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './carga.js' // barra de carga y marcadores compartidos (window.Carga)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
