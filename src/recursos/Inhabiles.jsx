import React, { useState } from 'react'
import { addInhabil, removeInhabil } from '../api.js'
import { fmtFecha } from './ui.jsx'

// Calendario de días inhábiles (además de sábados y domingos). Todos lo ven; solo un
// administrador lo modifica. Afecta el cálculo de todos los plazos en días hábiles.
export default function Inhabiles({ dias, puedeEditar, onCambio, onCerrar }) {
  const [fecha, setFecha] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  const agregar = async (ev) => {
    ev.preventDefault()
    if (!fecha) return
    setOcupado(true); setError(null)
    try { await addInhabil(fecha, motivo); setFecha(''); setMotivo(''); onCambio() }
    catch (e) { setError(e?.response?.data?.error || e.message) }
    finally { setOcupado(false) }
  }
  const quitar = async (f) => {
    setError(null)
    try { await removeInhabil(f); onCambio() }
    catch (e) { setError(e?.response?.data?.error || e.message) }
  }

  const anioActual = new Date().getFullYear()
  const proximos = dias.filter(d => Number(d.fecha.slice(0, 4)) >= anioActual)

  return (
    <section className="ine-card p-4 sm:p-5" aria-labelledby="inhabiles-titulo">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="inhabiles-titulo" className="text-sm font-bold text-ine-text">Días inhábiles</h2>
          <p className="text-xs text-ine-muted mt-0.5">
            Además de sábados y domingos. Se descuentan al contar los plazos en días hábiles.
          </p>
        </div>
        <button type="button" onClick={onCerrar} className="text-xs text-ine-muted hover:underline flex-shrink-0">Cerrar</button>
      </div>

      {puedeEditar && (
        <form onSubmit={agregar} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="inh-fecha" className="ine-label">Fecha</label>
            <input id="inh-fecha" type="date" className="ine-input" value={fecha} onChange={e => setFecha(e.target.value)} required />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label htmlFor="inh-motivo" className="ine-label">Motivo</label>
            <input id="inh-motivo" type="text" className="ine-input" placeholder="Por ejemplo, 16 de septiembre" value={motivo} onChange={e => setMotivo(e.target.value)} />
          </div>
          <button type="submit" className="btn-ine" disabled={ocupado || !fecha} style={{ fontSize: 13 }}>Agregar día</button>
        </form>
      )}
      {error && <p className="text-xs font-semibold mt-2" role="alert" style={{ color: '#991B1B' }}>{error}</p>}

      {proximos.length === 0 ? (
        <p className="text-sm text-ine-muted mt-4">No hay días inhábiles capturados para {anioActual} en adelante.</p>
      ) : (
        <ul className="mt-4 flex flex-col">
          {proximos.map(d => (
            <li key={d.fecha} className="flex items-center justify-between gap-3 py-2 text-sm" style={{ borderTop: '1px solid #EDEAE6' }}>
              <span><strong className="text-ine-text">{fmtFecha(d.fecha)}</strong>{d.motivo && <span className="text-ine-muted"> · {d.motivo}</span>}</span>
              {puedeEditar && (
                <button type="button" onClick={() => quitar(d.fecha)} className="text-xs font-semibold px-2 py-1 rounded hover:bg-ine-bg" style={{ color: '#991B1B' }}>
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
