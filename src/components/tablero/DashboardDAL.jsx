import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { getDalSection } from '../../api.js'
import { Encabezado, Alertas, Cifras, Panel, Barras, Columnas, Plazo, Tabla, contar, diasPara } from './Tablero.jsx'

// Dashboard de la Dirección de Asuntos Laborales (por ahora, Subdirección de Litigio).
const UMBRAL_DIAS = 7          // "por vencer": plazos que vencen en esta cantidad de días o menos
const HORIZONTE_DIAS = 30      // la tabla de vencimientos muestra hasta este plazo (y todos los vencidos)
const SECCIONES = ['actores', 'emplaz', 'noemplaz', 'sentencias', 'requerims', 'cumplims', 'incidentes', 'amparos', 'conciliacion', 'oic', 'reencauz']

// Plazos que cuentan como pendientes mientras no se registre su entrega/cumplimiento
const PLAZOS = [
  { seccion: 'sentencias', tipo: 'Sentencia',     pendiente: r => !r.fechaEntregaTEPJF },
  { seccion: 'requerims',  tipo: 'Requerimiento', pendiente: r => !r.fechaEntregaTEPJF },
  { seccion: 'incidentes', tipo: 'Incidente',     pendiente: () => true },
  { seccion: 'amparos',    tipo: 'Amparo',        pendiente: r => !r.fechaCumplimiento },
]

export default function DashboardDAL() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setError(null)
    try {
      const res = await Promise.all(SECCIONES.map(s => getDalSection(s)))
      setDatos(Object.fromEntries(SECCIONES.map((s, i) => [s, res[i]])))
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const t = useMemo(() => {
    if (!datos) return null
    const d = datos

    const plazos = PLAZOS.flatMap(p => d[p.seccion]
      .filter(r => p.pendiente(r))
      .map(r => ({ id: `${p.seccion}-${r.id}`, expediente: r.expediente, tipo: p.tipo, abogado: r.abogado, dias: diasPara(r.fechaVencimiento) }))
      .filter(r => r.dias !== null))
    const vencidos = plazos.filter(r => r.dias < 0).length
    const porVencer = plazos.filter(r => r.dias >= 0 && r.dias <= UMBRAL_DIAS).length
    const tablaPlazos = plazos.filter(r => r.dias <= HORIZONTE_DIAS).sort((a, b) => a.dias - b.dias)

    // Actores por año; si hay muchos años, los más antiguos se agrupan en "Anteriores"
    let porAno = contar(d.actores, r => r.ano).sort((a, b) => a.nombre.localeCompare(b.nombre))
    if (porAno.length > 7) {
      const viejos = porAno.slice(0, porAno.length - 6)
      porAno = [{ nombre: 'Anteriores', valor: viejos.reduce((s, x) => s + x.valor, 0) }, ...porAno.slice(-6)]
    }

    const concluidos = d.cumplims.filter(r => r.estatus === 'FORMALMENTE CONCLUIDO').length
    const cumplimientos = contar(d.cumplims, r => r.estatus && r.estatus.charAt(0) + r.estatus.slice(1).toLowerCase(), { sinValor: 'Sin estatus' })
    const carga = contar([...d.sentencias, ...d.requerims, ...d.incidentes, ...d.amparos, ...d.emplaz, ...d.conciliacion], r => r.abogado, { tope: 8 })

    const cifras = [
      { label: 'Actores / expedientes', valor: d.actores.length },
      { label: 'Emplazamientos', valor: d.emplaz.length },
      { label: 'Sentencias', valor: d.sentencias.length, nota: `${d.sentencias.filter(r => !r.fechaEntregaTEPJF).length} sin entrega` },
      { label: 'Requerimientos', valor: d.requerims.length, nota: `${d.requerims.filter(r => !r.fechaEntregaTEPJF).length} sin entrega` },
      { label: 'Cumplimientos', valor: d.cumplims.length, nota: `${concluidos} concluidos` },
      { label: 'Incidentes', valor: d.incidentes.length },
      { label: 'Amparos', valor: d.amparos.length, nota: `${d.amparos.filter(r => !r.fechaCumplimiento).length} sin cumplimiento` },
      { label: 'Conciliación', valor: d.conciliacion.length },
    ]
    return { vencidos, porVencer, tablaPlazos, porAno, cumplimientos, carga, cifras, totalCumplims: d.cumplims.length }
  }, [datos])

  return (
    <div className="fade-in max-w-6xl mx-auto flex flex-col gap-5">
      <Encabezado titulo="Dashboard · Asuntos Laborales" subtitulo="Con datos de la Subdirección de Litigio. Se actualiza al abrirlo." />

      {error && (
        <div className="carga-error" role="alert">
          <span>No se pudieron cargar los datos: {error}</span>
          <button type="button" onClick={cargar}>Reintentar</button>
        </div>
      )}
      {!t && !error && <div className="ine-card p-5" dangerouslySetInnerHTML={{ __html: window.Carga?.lineas(8) || 'Cargando…' }} />}

      {t && <>
        <Alertas vencidos={t.vencidos} porVencer={t.porVencer} umbral={UMBRAL_DIAS} />
        <Cifras items={t.cifras} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel titulo="Actores por año">
            <Columnas datos={t.porAno} />
          </Panel>
          <Panel titulo="Cumplimientos por estatus" nota={`${t.totalCumplims} en total`}>
            <Barras datos={t.cumplimientos} total={t.totalCumplims} mostrarPct />
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel titulo="Carga por abogado" nota="Asuntos asignados (sentencias, requerimientos, incidentes, amparos, emplazamientos y conciliación). Los 8 con más.">
            <Barras datos={t.carga} unidad="asuntos" />
          </Panel>
          <Panel titulo="Plazos vencidos y próximos" nota={`Sin entrega o cumplimiento registrado, hasta ${HORIZONTE_DIAS} días.`}>
            <Tabla
              filas={t.tablaPlazos}
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
      </>}
    </div>
  )
}
