import React, { useEffect, useState, useCallback } from 'react'
import { getResumen } from '../api.js'

// Íconos de los rubros (trazo de 1.8, 24×24)
const ICONOS = {
  balanza:   'M12 3v18M7 21h10M4 7h16M7 7l-3 7a3 3 0 006 0L7 7zm10 0l-3 7a3 3 0 006 0l-3-7z',
  grafica:   'M4 4v16h16M8 16v-4M12 16V8M16 16v-6',
  consulta:  'M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12zM9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1-1.5 2M12 16.5h.01',
  documento: 'M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zM14 3v5h5M9 13h6M9 17h4',
  pastel:    'M11 4a8 8 0 108.9 9H11V4zM14 3.6A8 8 0 0120.4 10H14V3.6z',
  firma:     'M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zM14 3v5h5M9 15l2 2 4-4',
}

function Icono({ nombre, color, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONOS[nombre]} />
    </svg>
  )
}

// Pantalla de inicio: los rubros que el usuario puede consultar, agrupados por dirección,
// con una cifra de cada uno.
export default function Inicio({ user, direcciones, onNavigate }) {
  const [resumen, setResumen] = useState(null)
  const [error, setError] = useState(null)

  const cargar = useCallback(() => {
    setError(null)
    getResumen().then(setResumen).catch(e => setError(e?.response?.data?.error || e.message))
  }, [])
  useEffect(() => { cargar() }, [cargar])

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

  const nombre = user?.name?.split(' ')[0]

  return (
    <div className="fade-in max-w-5xl mx-auto">
      <div className="mb-6 pl-4" style={{ borderLeft: '4px solid #C5A989' }}>
        <h1 className="text-xl font-bold text-ine-text">Módulo de Seguimiento</h1>
        <p className="text-sm text-ine-muted mt-1">
          {nombre ? `Hola, ${nombre}. ` : ''}Seguimiento de actividades de las Direcciones de Área.
        </p>
      </div>

      {error && (
        <div className="carga-error mb-4" role="alert">
          <span>No se pudieron cargar las cifras: {error}</span>
          <button type="button" onClick={cargar}>Reintentar</button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 items-start">
        {direcciones.map(d => {
          const activos = d.rubros.filter(r => !r.enConstruccion).length
          const pendientes = d.rubros.length - activos
          return (
            <section key={d.key} className="ine-card overflow-hidden">
              <header className="px-5 py-4 flex items-center gap-3" style={{ background: d.tema.fondo }}>
                <span className="w-11 h-11 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,.22)', color: d.tema.texto, border: '1.5px solid rgba(255,255,255,.35)' }}>
                  {d.corto}
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold leading-tight" style={{ color: d.tema.texto }}>Dirección de {d.label}</h2>
                  <p className="text-xs mt-0.5" style={{ color: d.tema.sutil }}>
                    {activos} {activos === 1 ? 'rubro activo' : 'rubros activos'}
                    {pendientes ? ` · ${pendientes} por definir` : ''}
                  </p>
                </div>
              </header>

              <ul>
                {d.rubros.map(r => {
                  const cifra = !r.enConstruccion && resumen ? r.cifra?.(resumen) : null
                  return (
                    <li key={r.vista} style={{ borderTop: r.enConstruccion ? '1px dashed #E3DFDA' : '1px solid #EDEAE6' }}>
                      <button onClick={() => onNavigate(r.vista)}
                        className="w-full text-left px-5 py-4 flex items-center gap-4 transition-colors hover:bg-ine-bg"
                        style={r.enConstruccion ? { background: '#FBFAF8' } : undefined}>
                        <span className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: r.enConstruccion ? '#F2F0EE' : d.tema.icono }}>
                          <Icono nombre={r.icono} color={r.enConstruccion ? '#B2B2B2' : d.tema.trazo} />
                        </span>

                        <span className="flex-1 min-w-0">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold"
                            style={{ color: r.enConstruccion ? '#828A91' : '#000000' }}>
                            {r.label}
                            {r.enConstruccion && (
                              <span className="px-1.5 py-0.5 rounded font-semibold" style={{ fontSize: 10, background: '#DDD4CE', color: '#454247' }}>
                                Próximamente
                              </span>
                            )}
                          </span>
                          <span className="block text-xs text-ine-muted mt-1">{r.descripcion}</span>
                        </span>

                        {!r.enConstruccion && (
                          <span className="text-right flex-shrink-0 min-w-[64px]">
                            {cifra ? (
                              <>
                                <span className="block text-lg font-bold leading-none" style={{ color: cifra.alerta ? '#000000' : '#454247' }}>
                                  {cifra.alerta && <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: '#C5A989' }} />}
                                  {cifra.num}
                                </span>
                                <span className="block text-ine-muted mt-1" style={{ fontSize: 11 }}>{cifra.label}</span>
                                {cifra.nota && <span className="block font-semibold mt-0.5" style={{ fontSize: 11, color: '#8A6E4B' }}>{cifra.nota}</span>}
                              </>
                            ) : !error && (
                              <span className="carga-skel" style={{ width: 40, height: 18 }} aria-hidden="true" />
                            )}
                          </span>
                        )}

                        <svg className="w-4 h-4 flex-shrink-0" style={{ color: r.enConstruccion ? '#C5C9CC' : '#C5A989' }}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                        </svg>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
