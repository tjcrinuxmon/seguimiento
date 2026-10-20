import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createRicRecord, updateRicRecord, deleteRicRecord } from '../api.js'
import { SectionView, AbogadosCtx } from '../components/DALView.jsx'
import { SECCIONES_RI } from './riCampos.js'
import { cargarRi } from '../components/tablero/dal.js'

const RIC_API = { crear: createRicRecord, actualizar: updateRicRecord, eliminar: deleteRicRecord }
const PESTANA_KEY = 'seguimiento_ri_pestana'
const leerPestana = () => {
  try { const k = localStorage.getItem(PESTANA_KEY); return SECCIONES_RI.some(s => s.key === k) ? k : SECCIONES_RI[0].key }
  catch { return SECCIONES_RI[0].key }
}

// RI-Consultas: una pestaña por catálogo (los que antes eran hojas del Excel JDRYC). Avisa a
// la subdirección cada vez que cambian los registros (`onDatos`), para su franja de alertas.
export default function RiConsultasView({ user, onDatos }) {
  const [activa, setActiva] = useState(leerPestana)
  const [store, setStore] = useState(null)
  const [error, setError] = useState(null)
  const [extra, setExtra] = useState([])      // abogados agregados en esta sesión

  const cambiar = (k) => { setActiva(k); try { localStorage.setItem(PESTANA_KEY, k) } catch {} }

  const cargar = useCallback(() => {
    setError(null)
    cargarRi().then(setStore).catch(e => setError(e?.response?.data?.error || e.message))
  }, [])
  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { if (store) onDatos?.(store) }, [store, onDatos])

  // Abogados: los que ya aparecen en los registros más los que se agreguen
  const abogados = useMemo(() => {
    const nombres = new Set(extra)
    for (const lista of Object.values(store || {})) for (const r of lista) {
      for (const n of String(r.abogado || '').split('/')) if (n.trim()) nombres.add(n.trim())
    }
    return ['', ...[...nombres].sort((a, b) => a.localeCompare(b))]
  }, [store, extra])
  const addAbogado = useCallback((n) => setExtra(xs => [...xs, n]), [])

  const seccion = SECCIONES_RI.find(s => s.key === activa)

  return (
    <AbogadosCtx.Provider value={{ abogados, addAbogado }}>
      <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid #E3DFDA', boxShadow: '0 2px 8px rgba(0,0,0,.07)' }}>
        <nav className="flex items-center gap-0.5 px-3 py-1.5 overflow-x-auto bg-white" style={{ borderBottom: '1px solid #E3DFDA', scrollbarWidth: 'none' }}
          aria-label="Catálogos de RI-Consultas">
          {SECCIONES_RI.map(s => {
            const on = s.key === activa
            return (
              <button key={s.key} type="button" onClick={() => cambiar(s.key)} aria-current={on ? 'page' : undefined}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap flex-shrink-0 transition-colors"
                style={on ? { background: '#454247', color: '#fff', fontWeight: 700 } : { color: '#828A91', fontWeight: 500 }}>
                {s.label}
                {store && <span className="px-1.5 rounded-full" style={{ fontSize: 10, background: on ? 'rgba(255,255,255,.2)' : '#EDEAE6' }}>{store[s.key].length}</span>}
              </button>
            )
          })}
        </nav>

        <div className="p-4 sm:p-6" style={{ background: '#F7F5F3' }}>
          {error ? (
            <div className="carga-error" role="alert">
              <span>No se pudieron cargar los registros: {error}</span>
              <button type="button" onClick={cargar}>Reintentar</button>
            </div>
          ) : !store ? (
            <div className="ine-card p-5" dangerouslySetInnerHTML={{ __html: window.Carga?.lineas(6) || 'Cargando…' }} />
          ) : (
            <SectionView
              key={activa}
              title={seccion.titulo}
              section={activa}
              schemas={seccion.campos}
              records={store[activa]}
              onUpdate={(records) => setStore(s => ({ ...s, [activa]: records }))}
              user={user}
              api={RIC_API}
            />
          )}
        </div>
      </div>
    </AbogadosCtx.Provider>
  )
}
