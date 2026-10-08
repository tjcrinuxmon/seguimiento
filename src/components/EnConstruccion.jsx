import React from 'react'

// Lugar reservado para un rubro que todavía se está esquematizando (p. ej. Consulta, Contratos).
export default function EnConstruccion({ direccion, rubro, onNavigate }) {
  return (
    <div className="fade-in max-w-xl mx-auto ine-card p-8" style={{ borderTop: '3px solid #C5A989' }}>
      <p className="text-xs font-semibold text-ine-muted">Dirección de {direccion.label}</p>
      <h1 className="text-lg font-bold text-ine-text mt-1">{rubro.label}</h1>
      <p className="text-sm text-ine-text mt-4">
        Este rubro todavía se está definiendo. Cuando quede listo su esquema, aquí se capturará y consultará su seguimiento.
      </p>
      <button onClick={() => onNavigate('inicio')} className="btn-outline mt-6" style={{ fontSize: 13 }}>
        Volver al inicio
      </button>
    </div>
  )
}
