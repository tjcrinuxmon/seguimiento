import React from 'react'

// Pantalla de inicio: los rubros que el usuario puede consultar, agrupados por dirección.
export default function Inicio({ user, direcciones, onNavigate }) {
  if (!direcciones.length) {
    return (
      <div className="max-w-xl mx-auto ine-card p-8 text-center">
        <h2 className="text-lg font-bold text-ine-text">Aún no tienes rubros asignados</h2>
        <p className="text-sm text-ine-muted mt-2">
          Pide a un administrador del portal que te asigne la dirección que reporta su seguimiento aquí.
        </p>
      </div>
    )
  }

  return (
    <div className="fade-in max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ine-text">Seguimiento</h1>
        <p className="text-sm text-ine-muted mt-1">
          {user?.name ? `${user.name} · ` : ''}Elige el rubro que quieres consultar o actualizar.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {direcciones.map(d => (
          <section key={d.key} className="ine-card overflow-hidden">
            <h2 className="px-5 py-3 text-sm font-bold text-white" style={{ background: '#454247' }}>
              Dirección de {d.label}
            </h2>
            <ul>
              {d.rubros.map(r => (
                <li key={r.vista} style={{ borderTop: '1px solid #EDEAE6' }}>
                  <button onClick={() => onNavigate(r.vista)}
                    className="w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-ine-bg transition-colors">
                    <span className="flex-1">
                      <span className="flex items-center gap-2 text-sm font-semibold text-ine-text">
                        {r.label}
                        {r.enConstruccion && (
                          <span className="px-1.5 py-0.5 rounded font-semibold" style={{ fontSize: 10, background: '#DDD4CE', color: '#454247' }}>
                            Próximamente
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-ine-muted mt-1">{r.descripcion}</span>
                    </span>
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#C5A989' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
