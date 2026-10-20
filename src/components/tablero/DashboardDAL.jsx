import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Encabezado, Alertas, Subseccion } from './Tablero.jsx'
import { BloqueLitigio, BloqueRecursos } from './BloquesDAL.jsx'
import { UMBRAL_DIAS, cargarLitigio, cargarRecursos, calcularLitigio, calcularRecursos } from './dal.js'
import { TONOS } from '../../rubros.js'
import Icono from '../Icono.jsx'

// Dashboard de la Dirección de Asuntos Laborales: alertas de las dos subdirecciones sumadas
// y, de cada una, sus cifras y plazos. El detalle (gráficas y carga por abogado) está en el
// dashboard de cada subdirección (DashboardSubdireccion.jsx), con los mismos cálculos.

const icono = (nombre, tono) => (
  <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: tono.icono }}>
    <Icono nombre={nombre} color={tono.trazo} size={18} />
  </span>
)

export default function DashboardDAL({ onNavigate }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setError(null)
    try {
      const [litigio, recursos] = await Promise.all([cargarLitigio(), cargarRecursos()])
      setDatos({ litigio, recursos })
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const t = useMemo(() => datos && {
    lit: calcularLitigio(datos.litigio),
    rc: calcularRecursos(datos.recursos.expedientes, datos.recursos.inhabiles),
  }, [datos])

  return (
    <div className="fade-in max-w-6xl mx-auto flex flex-col gap-5">
      <Encabezado titulo="Dashboard · Asuntos Laborales"
        subtitulo="Subdirección de Litigio y Subdirección de Recursos y Consultas. Se actualiza al abrirlo." />

      {error && (
        <div className="carga-error" role="alert">
          <span>No se pudieron cargar los datos: {error}</span>
          <button type="button" onClick={cargar}>Reintentar</button>
        </div>
      )}
      {!t && !error && <div className="ine-card p-5" dangerouslySetInnerHTML={{ __html: window.Carga?.lineas(8) || 'Cargando…' }} />}

      {t && <>
        {/* Alertas de toda la dirección */}
        <Alertas vencidos={t.lit.vencidos + t.rc.vencidos} porVencer={t.lit.porVencer + t.rc.porVencer} umbral={UMBRAL_DIAS} />
        {(t.lit.vencidos + t.rc.vencidos + t.lit.porVencer + t.rc.porVencer) > 0 && (
          <p className="text-xs text-ine-muted -mt-3">
            Litigio: {t.lit.vencidos} vencidos y {t.lit.porVencer} por vencer · Recursos y Consultas: {t.rc.vencidos} vencidos y {t.rc.porVencer} por vencer.
          </p>
        )}

        <Subseccion titulo="Subdirección de Litigio" tono={TONOS.beige} icono={icono('balanza', TONOS.beige)}
          onVer={() => onNavigate('litigio/dashboard')} />
        <BloqueLitigio t={t.lit} compacto />

        <Subseccion titulo="Subdirección de Recursos y Consultas" tono={TONOS.gris} icono={icono('consulta', TONOS.gris)}
          nota={t.rc.total ? `${t.rc.total} expedientes, ${t.rc.enTramite} en trámite.` : 'Aún no hay expedientes capturados.'}
          onVer={() => onNavigate('recursos/dashboard')} />
        <BloqueRecursos t={t.rc} compacto />
      </>}
    </div>
  )
}
