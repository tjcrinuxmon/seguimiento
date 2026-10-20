import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Encabezado, Alertas, Panel, Barras } from './Tablero.jsx'
import { MatrizPlazos, CargaAbogados, DetalleAsuntos } from './Plazos.jsx'
import {
  UMBRAL_DIAS, URGENTE_DIAS, TIPOS_LITIGIO, TIPOS_RECURSOS, cargarLitigio, cargarRecursos,
  asuntosLitigio, asuntosRecursos, expedientesRecursos, alertas, matriz, cargaAbogados,
} from './dal.js'

// Dashboard de una subdirección: se abre desde el botón "Ver dashboard" de su franja de
// alertas (#/litigio/dashboard, #/recursos/dashboard). Cada número de la matriz y de la
// carga por abogado abre abajo el detalle filtrado; el filtro va en la dirección
// (#/litigio/dashboard?tipo=emplaz&estatus=vencido) para que "atrás" regrese al resumen.
function DashboardSubdireccion({ titulo, archivo, tipos, cargar, procesar, Extra, filtro, onFiltro, onVolver }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const detalle = useRef(null)

  const leer = useCallback(() => {
    setError(null)
    cargar().then(setDatos).catch(e => setError(e?.response?.data?.error || e.message))
  }, [cargar])
  useEffect(() => { leer() }, [leer])

  const t = useMemo(() => {
    if (!datos) return null
    const { asuntos, extra } = procesar(datos)
    return { asuntos, extra, alertas: alertas(asuntos), matriz: matriz(asuntos, tipos), carga: cargaAbogados(asuntos) }
  }, [datos, procesar, tipos])

  // Al elegir un filtro, el detalle se trae a la vista
  const claveFiltro = filtro ? JSON.stringify(filtro) : ''
  useEffect(() => {
    if (claveFiltro && t) detalle.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [claveFiltro, !!t])

  return (
    <div className="fade-in max-w-6xl mx-auto flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Encabezado titulo={`Dashboard · ${titulo}`} subtitulo="Haz clic en cualquier número para ver el detalle. Se actualiza al abrirlo." />
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
        <Alertas vencidos={t.alertas.vencidos} porVencer={t.alertas.porVencer} umbral={UMBRAL_DIAS} />

        <Panel titulo="Plazos por estatus"
          nota={`Pendientes según los días que faltan (urgente: ${URGENTE_DIAS} días o menos); atendidos según si se cumplió antes o después del vencimiento.`}>
          <MatrizPlazos m={t.matriz} onFiltro={onFiltro} />
        </Panel>

        <Panel titulo="Carga por abogado" nota="Asuntos con plazo de cada persona: lo pendiente y lo ya atendido.">
          <CargaAbogados filas={t.carga} onFiltro={onFiltro} />
        </Panel>

        <div ref={detalle} style={{ scrollMarginTop: 16 }}>
          {filtro && <DetalleAsuntos asuntos={t.asuntos} tipos={tipos} filtro={filtro} onFiltro={onFiltro} archivo={archivo} />}
        </div>

        {Extra && <Extra datos={t.extra} />}
      </>}
    </div>
  )
}

const procesarLitigio = (d) => ({ asuntos: asuntosLitigio(d) })
const procesarRecursos = (d) => ({
  asuntos: asuntosRecursos(d.expedientes, d.inhabiles),
  extra: expedientesRecursos(d.expedientes),
})

// Recursos: además de los plazos, cómo van los expedientes
function ExtraRecursos({ datos: x }) {
  if (!x.total) return null
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel titulo="Expedientes en trámite por etapa" nota={`${x.enTramite} en trámite de ${x.total}`}>
        <Barras datos={x.porEtapa} total={x.enTramite} mostrarPct />
      </Panel>
      <Panel titulo="Determinaciones" nota={`${x.total} expedientes`}>
        <Barras datos={x.determinaciones} total={x.total} mostrarPct />
      </Panel>
    </div>
  )
}

export const DashboardLitigio = (props) => (
  <DashboardSubdireccion titulo="Subdirección de Litigio" archivo="litigio" tipos={TIPOS_LITIGIO}
    cargar={cargarLitigio} procesar={procesarLitigio} {...props} />
)

export const DashboardRecursos = (props) => (
  <DashboardSubdireccion titulo="Subdirección de Recursos y Consultas" archivo="recursos" tipos={TIPOS_RECURSOS}
    cargar={cargarRecursos} procesar={procesarRecursos} Extra={ExtraRecursos} {...props} />
)
