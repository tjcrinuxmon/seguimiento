import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Encabezado, Alertas } from './Tablero.jsx'
import { BloqueLitigio, BloqueRecursos } from './BloquesDAL.jsx'
import { UMBRAL_DIAS, cargarLitigio, cargarRecursos, calcularLitigio, calcularRecursos } from './dal.js'

// Dashboard de una subdirección: se abre desde el botón "Ver dashboard" de su franja de
// alertas (#/litigio/dashboard, #/recursos/dashboard). Usa los mismos cálculos y bloques que
// el dashboard de la dirección.
function DashboardSubdireccion({ titulo, cargar, calcular, Bloque, onVolver }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)

  const leer = useCallback(() => {
    setError(null)
    cargar().then(setDatos).catch(e => setError(e?.response?.data?.error || e.message))
  }, [cargar])
  useEffect(() => { leer() }, [leer])

  const t = useMemo(() => datos && calcular(datos), [datos, calcular])

  return (
    <div className="fade-in max-w-6xl mx-auto flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Encabezado titulo={`Dashboard · ${titulo}`} subtitulo="Se actualiza al abrirlo." />
        <button type="button" className="btn-outline" style={{ fontSize: 13 }} onClick={onVolver}>← Volver a la captura</button>
      </div>

      {error && (
        <div className="carga-error" role="alert">
          <span>No se pudieron cargar los datos: {error}</span>
          <button type="button" onClick={leer}>Reintentar</button>
        </div>
      )}
      {!t && !error && <div className="ine-card p-5" dangerouslySetInnerHTML={{ __html: window.Carga?.lineas(8) || 'Cargando…' }} />}

      {t && <>
        <Alertas vencidos={t.vencidos} porVencer={t.porVencer} umbral={UMBRAL_DIAS} />
        <Bloque t={t} />
      </>}
    </div>
  )
}

const calcularRc = (d) => calcularRecursos(d.expedientes, d.inhabiles)

export const DashboardLitigio = ({ onVolver }) => (
  <DashboardSubdireccion titulo="Subdirección de Litigio" cargar={cargarLitigio} calcular={calcularLitigio}
    Bloque={BloqueLitigio} onVolver={onVolver} />
)

export const DashboardRecursos = ({ onVolver }) => (
  <DashboardSubdireccion titulo="Subdirección de Recursos y Consultas" cargar={cargarRecursos} calcular={calcularRc}
    Bloque={BloqueRecursos} onVolver={onVolver} />
)
