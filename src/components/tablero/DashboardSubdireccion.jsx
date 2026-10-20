import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Encabezado, Alertas, Panel, Barras, TINTA } from './Tablero.jsx'
import { MatrizPlazos, CargaAbogados, DetalleAsuntos } from './Plazos.jsx'
import {
  UMBRAL_DIAS, URGENTE_DIAS, TIPOS_LITIGIO, TIPOS_RECURSOS, TIPOS_RI, cargarLitigio, cargarRecursos, cargarRi,
  asuntosLitigio, asuntosRecursos, asuntosRi, expedientesRecursos, consultasRi, alertas, matriz, cargaAbogados,
} from './dal.js'

// Dashboard de una subdirección: se abre desde el botón "Ver dashboard" de su franja de
// alertas (#/litigio/dashboard, #/recursos/dashboard). Cada número de la matriz y de la
// carga por abogado abre abajo el detalle filtrado; el filtro va en la dirección
// (#/litigio/dashboard?tipo=emplaz&estatus=vencido) para que "atrás" regrese al resumen.
// `grupos`: una matriz por grupo de tipos (Recursos tiene PLS y RI-Consultas).
function DashboardSubdireccion({ titulo, archivo, grupos, cargar, procesar, Extra, filtro, onFiltro, onVolver }) {
  const tipos = useMemo(() => grupos.flatMap(g => g.tipos), [grupos])
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
    return { asuntos, extra, alertas: alertas(asuntos), carga: cargaAbogados(asuntos),
      matrices: grupos.map(g => ({ ...g, m: matriz(asuntos.filter(a => g.tipos.some(t => t.clave === a.tipo)), g.tipos) })) }
  }, [datos, procesar, grupos])

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

        {t.matrices.map((g, i) => (
          <Panel key={g.titulo || i} titulo={g.titulo ? `Plazos por estatus · ${g.titulo}` : 'Plazos por estatus'}
            nota={i === 0 ? `Pendientes según los días que faltan (urgente: ${URGENTE_DIAS} días o menos); atendidos según si se cumplió antes o después del vencimiento.` : g.nota}>
            <MatrizPlazos m={g.m} onFiltro={onFiltro} />
          </Panel>
        ))}

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
const cargarRecursosTodo = async () => {
  const [pls, ri] = await Promise.all([cargarRecursos(), cargarRi()])
  return { ...pls, ri }
}
const procesarRecursos = (d) => ({
  asuntos: [...asuntosRecursos(d.expedientes, d.inhabiles), ...asuntosRi(d.ri)],
  extra: { pls: expedientesRecursos(d.expedientes), ri: consultasRi(d.ri) },
})

const GRUPOS_LITIGIO = [{ tipos: TIPOS_LITIGIO }]
const GRUPOS_RECURSOS = [
  { titulo: 'PLS', tipos: TIPOS_RECURSOS },
  { titulo: 'RI-Consultas', tipos: TIPOS_RI,
    nota: 'Atendido con la fecha de atención o, si no la tiene, con estatus CONCLUIDO (cuenta como a tiempo).' },
]

// Recursos: además de los plazos, cómo van los expedientes PLS y las consultas de RI
function ExtraRecursos({ datos }) {
  const x = datos.pls
  return <>
    <Panel titulo="RI-Consultas por catálogo" nota="Incluye los catálogos sin plazo (jurídico-laboral, rescisiones).">
      <div className="overflow-x-auto -mx-4 sm:-mx-5">
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: 420 }}>
          <thead>
            <tr style={{ background: '#F7F5F3' }}>
              {['Catálogo', 'En trámite', 'Concluidas', 'Total'].map((h, i) => (
                <th key={h} className={`px-4 sm:px-5 py-2 text-xs font-bold text-ine-muted ${i ? 'text-center' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.ri.map(c => (
              <tr key={c.seccion} style={{ borderTop: `1px solid ${TINTA.pista}` }}>
                <td className="px-4 sm:px-5 py-2 font-semibold" style={{ color: TINTA.media }}>{c.label}</td>
                <td className="px-4 sm:px-5 py-2 text-center font-bold" style={{ color: c.enTramite ? '#92400E' : TINTA.suave }}>{c.enTramite || '·'}</td>
                <td className="px-4 sm:px-5 py-2 text-center" style={{ color: TINTA.media }}>{c.concluidas || '·'}</td>
                <td className="px-4 sm:px-5 py-2 text-center font-bold" style={{ color: TINTA.fuerte }}>{c.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
    {x.total > 0 && <div className="grid gap-4 lg:grid-cols-2">
      <Panel titulo="PLS · Expedientes en trámite por etapa" nota={`${x.enTramite} en trámite de ${x.total}`}>
        <Barras datos={x.porEtapa} total={x.enTramite} mostrarPct />
      </Panel>
      <Panel titulo="PLS · Determinaciones" nota={`${x.total} expedientes`}>
        <Barras datos={x.determinaciones} total={x.total} mostrarPct />
      </Panel>
    </div>}
  </>
}

export const DashboardLitigio = (props) => (
  <DashboardSubdireccion titulo="Subdirección de Litigio" archivo="litigio" grupos={GRUPOS_LITIGIO}
    cargar={cargarLitigio} procesar={procesarLitigio} {...props} />
)

export const DashboardRecursos = (props) => (
  <DashboardSubdireccion titulo="Subdirección de Recursos y Consultas" archivo="recursos" grupos={GRUPOS_RECURSOS}
    cargar={cargarRecursosTodo} procesar={procesarRecursos} Extra={ExtraRecursos} {...props} />
)
