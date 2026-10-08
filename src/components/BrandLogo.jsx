import React from 'react'

// Logo oficial del INE (Manual de Identidad Institucional 2026, sección 2.3).
// No se redibuja: se usa el archivo maestro de public/logo-ine-reducido.png.
// `size` se interpreta como la altura en px; el ancho se ajusta solo.
export default function BrandLogo({ size = 32, className = '', alt = 'Instituto Nacional Electoral' }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}logo-ine-reducido.png`}
      alt={alt}
      className={className}
      style={{ height: size, width: 'auto', display: 'block', flexShrink: 0 }}
    />
  )
}
