import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { getDalSection, getExpedientesRc, getInhabiles } from '../../api.js'
import { Encabezado, Alertas, Cifras, Panel, Subseccion, Barras, Columnas, Plazo, Tabla, contar, diasPara } from './Tablero.jsx'
import { TONOS } from '../../rubros.js'
import Icono from '../Icono.jsx'
import { ETAPAS, calcularPlazos, etapaActual, expedienteClave } from '../../recursos/plazos.js'
import { DETERMINACIONES } from '../../recursos/campos.js'

// Dashboard de la Dirección de Asuntos Laborales: Subdirección de Litigio y
// Subdirección de Recursos y Consultas. Las alertas de arriba suman las dos.
const UMBRAL_DIAS = 7          // "por vencer": plazos que vencen en esta cantidad de días o menos
const HORIZONTE_DIAS = 30      // las tablas de plazos muestran hasta este plazo (y todos los vencidos)
const SECCIONES = ['actores', 'emplaz', 'noemplaz', 'sentencias', 'requerims', 'cumplims', 'incidentes', 'amparos', 'conciliacion', 'oic', 'reencauz']

// Litigio: plazos que cuentan como pendientes mientras no se registre su entrega/cumplimiento
const PLAZOS_LITIGIO = [
  { seccion: 'sentencias', tipo: 'Sentencia',     pendiente: r => !r.fechaEntregaTEPJF },
  { seccion: 'requerims',  tipo: 'Requerimiento', pendiente: r => !r.fechaEntregaTEPJF },
  { seccion: 'incidentes', tipo: 'Incidente',     pendiente: () => true },
  { seccion: 'amparos',    tipo: 'Amparo',        pendiente: r => !r.fechaCumplimiento },
]

const icono = (nombre, tono) => (
  <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: tono.icono }}>
    <Icono nombre={nombre} color={tono.trazo} size={18} />
  </span>
)

function calcularLitigio(d) {
  const plazos = PLAZOS_LITIGIO.flatMap(p => d[p.seccion]
    .filter(r => p.pendiente(r))
    .map(r => ({ id: `${p.seccion}-${r.id}`, expediente: r.expediente, tipo: p.tipo, abogado: r.abogado, dias: diasPara(r.fechaVencimiento) }))
    .filter(r => r.dias !== null))

  // Actores por año; si hay muchos años, los más antiguos se agrupan en "Anteriores"
  let porAno = contar(d.actores, r => r.ano).sort((a, b) => a.nombre.localeCompare(b.nombre))
  if (porAno.length > 7) {
    const viejos = porAno.slice(0, porAno.length - 6)
    porAno = [{ nombre: 'Anteriores', valor: viejos.reduce((s, x) => s + x.valor, 0) }, ...porAno.slice(-6)]
  }
  const concluidos = d.cumplims.filter(r => r.estatus === 'FORMALMENTE CONCLUIDO').length

  return {
    vencidos: plazos.filter(r => r.dias < 0).length,
    porVencer: plazos.filter(r => r.dias >= 0 && r.dias <= UMBRAL_DIAS).length,
    tablaPlazos: plazos.filter(r => r.dias <= HORIZONTE_DIAS).sort((a, b) => a.dias - b.dias),
    porAno,
    cumplimientos: contar(d.cumplims, r => r.estatus && r.estatus.charAt(0) + r.estatus.slice(1).toLowerCase(), { sinValor: 'Sin estatus' }),
    totalCumplims: d.cumplims.length,
    carga: contar([...d.sentencias, ...d.requerims, ...d.incidentes, ...d.amparos, ...d.emplaz, ...d.conciliacion], r => r.abogado, { tope: 8 }),
    cifras: [
      { label: 'Actores / expedientes', valor: d.actores.length },
      { label: 'Emplazamientos', valor: d.emplaz.length },
      { label: 'Sentencias', valor: d.sentencias.length, nota: `${d.sentencias.filter(r => !r.fechaEntregaTEPJF).length} sin entrega` },
      { label: 'Requerimientos', valor: d.requerims.length, nota: `${d.requerims.filter(r => !r.fechaEntregaTEPJF).length} sin entrega` },
      { label: 'Cumplimientos', valor: d.cumplims.length, nota: `${concluidos} concluidos` },
      { label: 'Incidentes', valor: d.incidentes.length },
      { label: 'Amparos', valor: d.amparos.length, nota: `${d.amparos.filter(r => !r.fechaCumplimiento).length} sin cumplimiento` },
      { label: 'Conciliación', valor: d.conciliacion.length },
    ],
  }
}

function calcularRecursos(expedientes, inhabiles) {
  const filas = expedientes.map(x => ({ ...x, etapa: etapaActual(x), plazos: calcularPlazos(x, inhabiles) }))
  const enTramite = filas.filter(x => !x.etapa.concluido)
  // Solo los plazos que le tocan a la DEAJ y no se han cumplido
  const pendientes = filas.flatMap(x => x.plazos
    .filter(p => p.quien === 'deaj' && ['vencido', 'por_vencer', 'pendiente'].includes(p.estado))
    .map(p => ({ ...p, id: `${x.id}-${p.clave}`, expediente: expedienteClave(x), abogado: x.abogado })))
  const etiquetaDet = Object.fromEntries(DETERMINACIONES.map(d => [d.valor, d.label]))

  return {
    vencidos: pendientes.filter(p => p.estado === 'vencido').length,
    porVencer: pendientes.filter(p => p.estado === 'por_vencer').length,
    tablaPlazos: pendientes.filter(p => p.dias <= HORIZONTE_DIAS).sort((a, b) => a.dias - b.dias),
    porEtapa: ETAPAS.map(et => ({ nombre: et.label, valor: enTramite.filter(x => x.etapa.clave === et.clave).length })).filter(x => x.valor),
    determinaciones: contar(filas, x => etiquetaDet[x.determinacion], { sinValor: 'Sin determinar' }),
    carga: contar(enTramite, x => x.abogado, { tope: 8, sinValor: 'Sin abogado' }),
    total: filas.length,
    enTramite: enTramite.length,
    cifras: [
      { label: 'Expedientes', valor: filas.length },
      { label: 'En trámite', valor: enTramite.length },
      { label: 'Concluidos', valor: filas.length - enTramite.length },
      { label: 'Con plazo vencido', valor: new Set(pendientes.filter(p => p.estado === 'vencido').map(p => p.expediente)).size },
    ],
  }
}

export default function DashboardDAL() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setError(null)
    try {
      const [secciones, expedientes, inhabiles] = await Promise.all([
        Promise.all(SECCIONES.map(s => getDalSection(s))),
        getExpedientesRc(),
        getInhabiles(),
      ])
      setDatos({
        litigio: Object.fromEntries(SECCIONES.map((s, i) => [s, secciones[i]])),
        expedientes,
        inhabiles: new Set(inhabiles.map(d => d.fecha)),
      })
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const t = useMemo(() => datos && {
    lit: calcularLitigio(datos.litigio),
    rc: calcularRecursos(datos.expedientes, datos.inhabiles),
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

        {/* ── Subdirección de Litigio ── */}
        <Subseccion titulo="Subdirección de Litigio" tono={TONOS.beige} icono={icono('balanza', TONOS.beige)} />
        <Cifras items={t.lit.cifras} />
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel titulo="Actores por año">
            <Columnas datos={t.lit.porAno} />
          </Panel>
          <Panel titulo="Cumplimientos por estatus" nota={`${t.lit.totalCumplims} en total`}>
            <Barras datos={t.lit.cumplimientos} total={t.lit.totalCumplims} mostrarPct />
          </Panel>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel titulo="Carga por abogado" nota="Asuntos asignados (sentencias, requerimientos, incidentes, amparos, emplazamientos y conciliación). Los 8 con más.">
            <Barras datos={t.lit.carga} unidad="asuntos" />
          </Panel>
          <Panel titulo="Plazos vencidos y próximos" nota={`Sin entrega o cumplimiento registrado, hasta ${HORIZONTE_DIAS} días.`}>
            <Tabla
              filas={t.lit.tablaPlazos}
              vacio="Sin plazos vencidos ni próximos."
              columnas={[
                { titulo: 'Expediente', render: r => <span className="font-semibold text-ine-text">{r.expediente || '—'}</span> },
                { titulo: 'Tipo', campo: 'tipo' },
                { titulo: 'Abogado', campo: 'abogado' },
                { titulo: 'Plazo', render: r => <Plazo dias={r.dias} umbral={UMBRAL_DIAS} /> },
              ]}
            />
          </Panel>
        </div>

        {/* ── Subdirección de Recursos y Consultas ── */}
        <Subseccion titulo="Subdirección de Recursos y Consultas" tono={TONOS.gris} icono={icono('consulta', TONOS.gris)}
          nota={t.rc.total ? `${t.rc.total} expedientes, ${t.rc.enTramite} en trámite.` : 'Aún no hay expedientes capturados.'} />
        <Cifras items={t.rc.cifras} />
        {t.rc.total > 0 && <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel titulo="Expedientes en trámite por etapa" nota={`${t.rc.enTramite} en trámite`}>
              <Barras datos={t.rc.porEtapa} total={t.rc.enTramite} mostrarPct />
            </Panel>
            <Panel titulo="Determinaciones" nota={`${t.rc.total} expedientes`}>
              <Barras datos={t.rc.determinaciones} total={t.rc.total} mostrarPct />
            </Panel>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel titulo="Carga por abogado" nota="Expedientes en trámite asignados a cada persona. Los 8 con más.">
              <Barras datos={t.rc.carga} unidad="expedientes" />
            </Panel>
            <Panel titulo="Plazos vencidos y próximos" nota={`Lo que le toca a la DEAJ y aún no se cumple, hasta ${HORIZONTE_DIAS} días.`}>
              <Tabla
                filas={t.rc.tablaPlazos}
                vacio="Sin plazos vencidos ni próximos."
                columnas={[
                  { titulo: 'Expediente', render: r => <span className="font-semibold text-ine-text whitespace-nowrap">{r.expediente}</span> },
                  { titulo: 'Plazo', campo: 'label' },
                  { titulo: 'Abogado', campo: 'abogado' },
                  { titulo: 'Vence', render: r => <Plazo dias={r.dias} umbral={UMBRAL_DIAS} /> },
                ]}
              />
            </Panel>
          </div>
        </>}
      </>}
    </div>
  )
}
