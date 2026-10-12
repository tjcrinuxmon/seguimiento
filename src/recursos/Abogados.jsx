import React, { useState } from 'react'
import { createAbogado, updateAbogado } from '../api.js'

// Catálogo de abogados de la subdirección. Todos lo ven; solo un administrador agrega,
// cambia nombres o da de baja. Los expedientes guardan el id: un cambio de nombre se
// refleja en todos. Dar de baja no borra: el abogado deja de aparecer para asignarse.
function Fila({ a, puedeEditar, onCambio }) {
  const [nombre, setNombre] = useState(a.nombre)
  const [error, setError] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const cambiado = nombre.trim() !== a.nombre

  const guardar = async (datos) => {
    setOcupado(true); setError(null)
    try { await updateAbogado(a.id, datos); onCambio() }
    catch (e) { setError(e?.response?.data?.error || e.message) }
    finally { setOcupado(false) }
  }

  return (
    <li className="py-2.5 flex flex-wrap items-center gap-2" style={{ borderTop: '1px solid #EDEAE6', opacity: a.activo ? 1 : 0.6 }}>
      {puedeEditar ? (
        <>
          <label className="sr-only" htmlFor={`abog-${a.id}`}>Nombre</label>
          <input id={`abog-${a.id}`} className="ine-input flex-1 min-w-[200px]" value={nombre} onChange={e => setNombre(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && cambiado) guardar({ nombre }) }} />
          {cambiado && (
            <button type="button" className="btn-ine" style={{ fontSize: 12, padding: '6px 12px' }} disabled={ocupado || !nombre.trim()}
              onClick={() => guardar({ nombre })}>Guardar</button>
          )}
          <button type="button" className="text-xs font-semibold px-2 py-1 rounded hover:bg-ine-bg" disabled={ocupado}
            style={{ color: a.activo ? '#991B1B' : '#454247' }} onClick={() => guardar({ activo: !a.activo })}>
            {a.activo ? 'Dar de baja' : 'Reactivar'}
          </button>
        </>
      ) : (
        <span className="text-sm text-ine-text flex-1">{a.nombre}</span>
      )}
      {!a.activo && <span className="text-xs text-ine-muted">Inactivo</span>}
      {error && <span className="w-full text-xs font-semibold" role="alert" style={{ color: '#991B1B' }}>{error}</span>}
    </li>
  )
}

export default function Abogados({ subdireccion, abogados, puedeEditar, onCambio, onCerrar }) {
  const [nuevo, setNuevo] = useState('')
  const [error, setError] = useState(null)

  const agregar = async (ev) => {
    ev.preventDefault()
    if (!nuevo.trim()) return
    setError(null)
    try { await createAbogado(subdireccion, nuevo); setNuevo(''); onCambio() }
    catch (e) { setError(e?.response?.data?.error || e.message) }
  }

  return (
    <section className="ine-card p-4 sm:p-5" aria-labelledby="abogados-titulo">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="abogados-titulo" className="text-sm font-bold text-ine-text">Abogados</h2>
          <p className="text-xs text-ine-muted mt-0.5">
            {puedeEditar
              ? 'Un cambio de nombre se refleja en todos sus expedientes. Dar de baja no borra su historial.'
              : 'Solo un administrador puede modificar esta lista.'}
          </p>
        </div>
        <button type="button" onClick={onCerrar} className="text-xs text-ine-muted hover:underline flex-shrink-0">Cerrar</button>
      </div>

      <ul className="mt-3">
        {abogados.map(a => <Fila key={`${a.id}-${a.nombre}-${a.activo}`} a={a} puedeEditar={puedeEditar} onCambio={onCambio} />)}
      </ul>

      {puedeEditar && (
        <form onSubmit={agregar} className="mt-3 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="abog-nuevo" className="ine-label">Agregar abogado</label>
            <input id="abog-nuevo" className="ine-input" placeholder="Nombre completo" value={nuevo} onChange={e => setNuevo(e.target.value)} />
          </div>
          <button type="submit" className="btn-ine" disabled={!nuevo.trim()} style={{ fontSize: 13 }}>Agregar</button>
        </form>
      )}
      {error && <p className="text-xs font-semibold mt-2" role="alert" style={{ color: '#991B1B' }}>{error}</p>}
    </section>
  )
}
