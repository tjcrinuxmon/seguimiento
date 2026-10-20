import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Encabezado, Alertas, Subseccion, Panel } from './Tablero.jsx'
import { MatrizPlazos } from './Plazos.jsx'
import {
  UMBRAL_DIAS, TIPOS_LITIGIO, TIPOS_RECURSOS, TIPOS_RI, cargarLitigio, cargarRecursos, cargarRi, asuntosLitigio,
  asuntosRecursos, asuntosRi, expedientesRecursos, alertas, matriz, filtroAQuery,
} from './dal.js'
import { TONOS } from '../../rubros.js'
import Icono from '../Icono.jsx'

// Dashboard de la Dirección de Asuntos Laborales: alertas de las dos subdirecciones sumadas
// y la matriz de plazos de cada una. Cada número lleva al dashboard de la subdirección con
// el detalle ya filtrado; ahí están la carga por abogado y lo demás (DashboardSubdireccion.jsx).

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
      const [litigio, recursos, ri] = await Promise.all([cargarLitigio(), cargarRecursos(), cargarRi()])
      setDatos({ litigio, recursos, ri })
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const t = useMemo(() => {
    if (!datos) return null
    const lit = asuntosLitigio(datos.litigio)
    const pls = asuntosRecursos(datos.recursos.expedientes, datos.recursos.inhabiles)
    const ri = asuntosRi(datos.ri)
    return {
      lit: { alertas: alertas(lit), matriz: matriz(lit, TIPOS_LITIGIO) },
      rc: { alertas: alertas([...pls, ...ri]), matriz: matriz(pls, TIPOS_RECURSOS), matrizRi: matriz(ri, TIPOS_RI),
        exp: expedientesRecursos(datos.recursos.expedientes) },
    }
  }, [datos])

  const ir = (vista) => (f) => onNavigate(`${vista}/dashboard?${filtroAQuery(f)}`)

  return (
    <div className="fade-in max-w-6xl mx-auto flex flex-col gap-5">
      <Encabezado titulo="Dashboard · Asuntos Laborales"
        subtitulo="Subdirección de Litigio y Subdirección de Recursos y Consultas. Haz clic en cualquier número para ver el detalle." />

      {error && (
        <div className="carga-error" role="alert">
          <span>No se pudieron cargar los datos: {error}</span>
          <button type="button" onClick={cargar}>Reintentar</button>
        </div>
      )}
      {!t && !error && <div className="ine-card p-5" dangerouslySetInnerHTML={{ __html: window.Carga?.lineas(8) || 'Cargando…' }} />}

      {t && <>
        {/* Alertas de toda la dirección */}
        <Alertas vencidos={t.lit.alertas.vencidos + t.rc.alertas.vencidos} porVencer={t.lit.alertas.porVencer + t.rc.alertas.porVencer} umbral={UMBRAL_DIAS} />
        {(t.lit.alertas.vencidos + t.rc.alertas.vencidos + t.lit.alertas.porVencer + t.rc.alertas.porVencer) > 0 && (
          <p className="text-xs text-ine-muted -mt-3">
            Litigio: {t.lit.alertas.vencidos} vencidos y {t.lit.alertas.porVencer} por vencer · Recursos y Consultas: {t.rc.alertas.vencidos} vencidos y {t.rc.alertas.porVencer} por vencer.
          </p>
        )}

        <Subseccion titulo="Subdirección de Litigio" tono={TONOS.beige} icono={icono('balanza', TONOS.beige)}
          onVer={() => onNavigate('litigio/dashboard')} />
        <Panel titulo="Plazos por estatus">
          <MatrizPlazos m={t.lit.matriz} onFiltro={ir('litigio')} />
        </Panel>

        <Subseccion titulo="Subdirección de Recursos y Consultas" tono={TONOS.gris} icono={icono('consulta', TONOS.gris)}
          nota={t.rc.exp.total ? `PLS: ${t.rc.exp.total} expedientes, ${t.rc.exp.enTramite} en trámite.` : 'PLS: aún no hay expedientes capturados.'}
          onVer={() => onNavigate('recursos/dashboard')} />
        {t.rc.exp.total > 0 && (
          <Panel titulo="Plazos por estatus · PLS">
            <MatrizPlazos m={t.rc.matriz} onFiltro={ir('recursos')} />
          </Panel>
        )}
        <Panel titulo="Plazos por estatus · RI-Consultas">
          <MatrizPlazos m={t.rc.matrizRi} onFiltro={ir('recursos')} />
        </Panel>
      </>}
    </div>
  )
}
