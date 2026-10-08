import React from 'react'

// Íconos de Seguimiento (trazo, 24×24). Se usan en el inicio y en el menú.
const ICONOS = {
  dashboard: 'M4 13h6V4H4v9zm0 7h6v-4H4v4zm10 0h6v-9h-6v9zm0-16v4h6V4h-6z',
  reportes:  'M9 4h6a1 1 0 011 1v1H8V5a1 1 0 011-1zM8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 12h6M9 16h4',
  balanza:   'M12 3v18M7 21h10M4 7h16M7 7l-3 7a3 3 0 006 0L7 7zm10 0l-3 7a3 3 0 006 0l-3-7z',
  consulta:  'M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12zM9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1-1.5 2M12 16.5h.01',
  documento: 'M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zM14 3v5h5M9 13h6M9 17h4',
  firma:     'M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zM14 3v5h5M9 15l2 2 4-4',
}

export default function Icono({ nombre, color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d={ICONOS[nombre]} />
    </svg>
  )
}
