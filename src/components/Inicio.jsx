import React, { useEffect, useState, useCallback } from 'react'
import { getResumen } from '../api.js'
import { TONOS } from '../rubros.js'
import Icono from './Icono.jsx'

const Proximamente = () => (
  <span className="px-1.5 py-0.5 rounded font-semibold" style={{ fontSize: 10, background: '#DDD4CE', color: '#454247' }}>
    Próximamente
  </span>
)

function Cifra({ cifra, cargando }) {
  if (!cifra) return cargando ? <span className="carga-skel" style={{ width: 40, height: 18 }} aria-hidden="true" /> : null
  return (
    <span className="text-right flex-shrink-0">
      <span className="block text-lg font-bold leading-none" style={{ color: cifra.alerta ? '#000000' : '#454247' }}>
        {cifra.alerta && <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: '#C5A989' }} />}
        {cifra.num}
      </span>
      <span className="block text-ine-muted mt-1" style={{ fontSize: 11 }}>{cifra.label}</span>
      {cifra.nota && <span className="block font-semibold mt-0.5" style={{ fontSize: 11, color: '#8A6E4B' }}>{cifra.nota}</span>}
    </span>
  )
}

// Dashboard / Reportes de la dirección: dos mosaicos lado a lado.
function Mosaico({ rubro, cifra, cargando, onClick }) {
  const pendiente = rubro.enConstruccion
  return (
    <button onClick={onClick}
      className="flex-1 min-w-0 text-left rounded-lg p-3.5 flex flex-col gap-2 transition-all hover:-translate-y-0.5"
      style={{
        background: pendiente ? '#FBFAF8' : '#FFFFFF',
        border: pendiente ? '1px dashed #DDD4CE' : '1px solid #E3DFDA',
        boxShadow: pendiente ? 'none' : '0 2px 6px rgba(69,66,71,.10)',
      }}>
      <span className="flex items-center justify-between gap-2">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: pendiente ? '#F2F0EE' : '#454247' }}>
          <Icono nombre={rubro.icono} color={pendiente ? '#B2B2B2' : '#FFFFFF'} size={18} />
        </span>
        {pendiente ? <Proximamente /> : <Cifra cifra={cifra} cargando={cargando} />}
      </span>
      <span>
        <span className="block text-sm font-semibold" style={{ color: pendiente ? '#828A91' : '#000000' }}>{rubro.label}</span>
        <span className="block text-xs text-ine-muted mt-0.5">{rubro.descripcion}</span>
      </span>
    </button>
  )
}

// Subdirección: fila con su tono (beige o gris), sombreado y barra de color a la izquierda.
function Subdireccion({ rubro, cifra, cargando, onClick }) {
  const pendiente = rubro.enConstruccion
  const t = TONOS[rubro.tono] || TONOS.gris
  return (
    <button onClick={onClick}
      className="w-full text-left rounded-lg px-4 py-3.5 flex items-center gap-4 transition-all hover:-translate-y-0.5"
      style={{
        background: `linear-gradient(90deg, ${t.fondo} 0%, #FFFFFF 85%)`,
        borderLeft: `4px solid ${pendiente ? '#DDD4CE' : t.acento}`,
        boxShadow: pendiente ? '0 1px 2px rgba(69,66,71,.06)' : '0 2px 8px rgba(69,66,71,.12)',
        opacity: pendiente ? 0.85 : 1,
      }}>
      <span className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: t.icono }}>
        <Icono nombre={rubro.icono} color={t.trazo} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold" style={{ color: pendiente ? '#454247' : '#000000' }}>
          {rubro.label}
          {pendiente && <Proximamente />}
        </span>
        <span className="block text-xs text-ine-muted mt-1">{rubro.descripcion}</span>
      </span>
      {!pendiente && <Cifra cifra={cifra} cargando={cargando} />}
      <svg className="w-4 h-4 flex-shrink-0" style={{ color: pendiente ? '#C5C9CC' : t.acento }}
        fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
      </svg>
    </button>
  )
}

// Pantalla de inicio: por dirección, su Dashboard y Reportes y sus subdirecciones,
// con una cifra de cada rubro activo.
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
  const cargando = !resumen && !error
  const cifraDe = (r) => (!r.enConstruccion && resumen ? r.cifra?.(resumen) : null)

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
          const generales = d.rubros.filter(r => r.tipo !== 'subdireccion')
          const subdirs = d.rubros.filter(r => r.tipo === 'subdireccion')
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
                    {subdirs.length} {subdirs.length === 1 ? 'subdirección' : 'subdirecciones'}
                  </p>
                </div>
              </header>

              <div className="p-4 flex flex-col gap-4" style={{ background: '#FCFBFA' }}>
                {subdirs.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-ine-muted mb-2">Subdirecciones</p>
                    <div className="flex flex-col gap-2.5">
                      {subdirs.map(r => (
                        <Subdireccion key={r.vista} rubro={r} cifra={cifraDe(r)} cargando={cargando} onClick={() => onNavigate(r.vista)} />
                      ))}
                    </div>
                  </div>
                )}
                {generales.length > 0 && (
                  <div className="flex gap-3 pt-4" style={{ borderTop: '1px solid #EDEAE6' }}>
                    {generales.map(r => (
                      <Mosaico key={r.vista} rubro={r} cifra={cifraDe(r)} cargando={cargando} onClick={() => onNavigate(r.vista)} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
