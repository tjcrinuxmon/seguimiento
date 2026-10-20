import React, { useCallback, useEffect, useMemo, useState } from 'react'
import RecursosView from './RecursosView.jsx'
import RiConsultasView from './RiConsultasView.jsx'
import { FranjaAlertas } from '../components/tablero/Tablero.jsx'
import { UMBRAL_DIAS, alertas, asuntosRecursos, asuntosRi, cargarRecursos, cargarRi } from '../components/tablero/dal.js'

export const PARTES_RC = [
  { key: 'pls', label: 'PLS', nombre: 'Procedimiento Laboral Sancionador' },
  { key: 'ri',  label: 'RI-Consultas', nombre: 'Recursos de inconformidad, consultas, requerimientos y protocolo' },
]

// Subdirección de Recursos y Consultas: dos partes, PLS (#/recursos) y RI-Consultas
// (#/recursos/ri). La franja de alertas suma las dos; cada parte la actualiza al capturar.
export default function RecursosSubdireccion({ user, parte, onParte, onDashboard }) {
  const [pls, setPls] = useState(null)
  const [ri, setRi] = useState(null)
  const [fallo, setFallo] = useState(false)

  // Al entrar se leen las dos partes para la franja; la parte abierta la mantiene al día
  useEffect(() => {
    cargarRecursos().then(setPls).catch(() => setFallo(true))
    cargarRi().then(setRi).catch(() => setFallo(true))
  }, [])
  const datosPls = useCallback((d) => setPls({ expedientes: d.expedientes, inhabiles: d.inhabiles }), [])
  const datosRi = useCallback((d) => setRi(d), [])

  const cuenta = useMemo(() => {
    if (!pls || !ri) return null
    const inh = pls.inhabiles instanceof Set ? pls.inhabiles : new Set()
    return alertas([...asuntosRecursos(pls.expedientes, inh), ...asuntosRi(ri)])
  }, [pls, ri])

  return (
    <div className="fade-in max-w-6xl mx-auto flex flex-col gap-4">
      {!fallo && (
        <FranjaAlertas vencidos={cuenta ? cuenta.vencidos : null} porVencer={cuenta?.porVencer}
          umbral={UMBRAL_DIAS} onAbrir={onDashboard} />
      )}

      <div className="flex rounded-lg overflow-hidden self-start" role="tablist" aria-label="Parte de la subdirección"
        style={{ border: '1.5px solid #454247' }}>
        {PARTES_RC.map(p => {
          const on = p.key === parte
          return (
            <button key={p.key} type="button" role="tab" aria-selected={on} onClick={() => onParte(p.key)} title={p.nombre}
              className="px-4 sm:px-5 py-2 text-sm font-bold transition-colors"
              style={on ? { background: '#454247', color: '#fff' } : { background: '#fff', color: '#454247' }}>
              {p.label}
            </button>
          )
        })}
      </div>

      {parte === 'ri'
        ? <RiConsultasView user={user} onDatos={datosRi} />
        : <RecursosView user={user} onDatos={datosPls} />}
    </div>
  )
}
