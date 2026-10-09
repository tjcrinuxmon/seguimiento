import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { getConvenios } from '../../api.js'
import { Encabezado, Alertas, Cifras, Panel, Barras, Plazo, Tabla, contar, diasPara } from './Tablero.jsx'

// Dashboard de la Dirección de Contratos y Convenios (por ahora, Subdirección de Convenios).
const UMBRAL_DIAS = 5          // "por vencer": convenios que vencen en esta cantidad de días o menos
const HORIZONTE_DIAS = 30      // la tabla de vencimientos muestra hasta este plazo (y todos los vencidos)

const ESTATUS = {
  revision: 'Revisión', revision_interna: 'Rev. interna subdirección', validacion: 'Validación',
  liberado: 'Liberado', no_liberado: 'No liberado', cancelado: 'Cancelado',
}
const EN_TRAMITE = ['revision', 'revision_interna', 'validacion']

// Etapas del proceso de revisión: cuántos convenios ya registraron cada oficio
const ETAPAS = [
  { nombre: 'Solicitud recibida',      campo: 'oficio_solicitud' },
  { nombre: '1ª revisión',             campo: 'oficio_primera_revision' },
  { nombre: '2ª revisión',             campo: 'oficio_segunda_revision' },
  { nombre: 'Validación jurídica',     campo: 'oficio_validacion_juridica' },
  { nombre: 'Validación preliminar',   campo: 'oficio_validacion_preliminar' },
  { nombre: 'Liberado',                estatus: 'liberado' },
]

export default function DashboardDCyC() {
  const [convenios, setConvenios] = useState(null)
  const [error, setError] = useState(null)

  const cargar = useCallback(() => {
    setError(null)
    getConvenios().then(setConvenios).catch(e => setError(e?.response?.data?.error || e.message))
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const t = useMemo(() => {
    if (!convenios) return null
    const c = convenios
    const conPlazo = c.map(x => ({ ...x, dias: diasPara(x.fecha_vencimiento) })).filter(x => x.dias !== null)
    const cuenta = (est) => c.filter(x => x.estatus === est).length

    return {
      total: c.length,
      vencidos: conPlazo.filter(x => x.dias < 0).length,
      porVencer: conPlazo.filter(x => x.dias >= 0 && x.dias <= UMBRAL_DIAS).length,
      cifras: [
        { label: 'Convenios', valor: c.length },
        { label: 'En trámite', valor: c.filter(x => EN_TRAMITE.includes(x.estatus)).length, nota: 'revisión o validación' },
        { label: 'Liberados', valor: cuenta('liberado') },
        { label: 'No liberados', valor: cuenta('no_liberado') },
        { label: 'Cancelados', valor: cuenta('cancelado') },
      ],
      porEstatus: contar(c, x => ESTATUS[x.estatus] || x.estatus, { sinValor: 'Sin estatus' }),
      porTipo: contar(c, x => x.tipo_convenio, { sinValor: 'Sin tipo' }),
      etapas: ETAPAS.map(e => ({ nombre: e.nombre, valor: c.filter(x => e.campo ? x[e.campo] : x.estatus === e.estatus).length })),
      carga: contar(c.filter(x => EN_TRAMITE.includes(x.estatus)), x => x.responsable, { tope: 8, sinValor: 'Sin responsable' }),
      tablaPlazos: conPlazo.filter(x => x.dias <= HORIZONTE_DIAS).sort((a, b) => a.dias - b.dias),
      sinAvance: c.filter(x => ['revision', 'revision_interna'].includes(x.estatus) && !x.oficio_primera_revision),
    }
  }, [convenios])

  return (
    <div className="fade-in max-w-6xl mx-auto flex flex-col gap-5">
      <Encabezado titulo="Dashboard · Contratos y Convenios" subtitulo="Con datos de la Subdirección de Convenios. Se actualiza al abrirlo." />

      {error && (
        <div className="carga-error" role="alert">
          <span>No se pudieron cargar los datos: {error}</span>
          <button type="button" onClick={cargar}>Reintentar</button>
        </div>
      )}
      {!t && !error && <div className="ine-card p-5" dangerouslySetInnerHTML={{ __html: window.Carga?.lineas(8) || 'Cargando…' }} />}

      {t && <>
        <Alertas vencidos={t.vencidos} porVencer={t.porVencer} umbral={UMBRAL_DIAS} que="convenios" />
        <Cifras items={t.cifras} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel titulo="Convenios por estatus" nota={`${t.total} en total`}>
            <Barras datos={t.porEstatus} total={t.total} mostrarPct />
          </Panel>
          <Panel titulo="Convenios por tipo">
            <Barras datos={t.porTipo} unidad="convenios" />
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel titulo="Avance del proceso de revisión" nota="Cuántos convenios han alcanzado cada etapa, del total.">
            <Barras datos={t.etapas} total={t.total} mostrarPct />
          </Panel>
          <Panel titulo="Carga por responsable" nota="Convenios en trámite asignados a cada persona. Los 8 con más.">
            <Barras datos={t.carga} unidad="convenios" />
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel titulo="Vencimientos" nota={`Vencidos y los que vencen en los próximos ${HORIZONTE_DIAS} días.`}>
            <Tabla
              filas={t.tablaPlazos}
              vacio="Sin convenios vencidos ni próximos a vencer."
              columnas={[
                { titulo: 'Tercero', render: r => <span className="font-semibold text-ine-text">{r.tercero}</span> },
                { titulo: 'Núm.', campo: 'numero_convenio' },
                { titulo: 'Plazo', render: r => <Plazo dias={r.dias} umbral={UMBRAL_DIAS} /> },
              ]}
            />
          </Panel>
          <Panel titulo="En revisión sin 1ª revisión" nota="Convenios recibidos que aún no tienen oficio de primera revisión.">
            <Tabla
              filas={t.sinAvance}
              vacio="Todos los convenios en revisión tienen su primera revisión."
              columnas={[
                { titulo: 'Tercero', render: r => <span className="font-semibold text-ine-text">{r.tercero}</span> },
                { titulo: 'Estatus', render: r => ESTATUS[r.estatus] || r.estatus },
                { titulo: 'Responsable', campo: 'responsable' },
              ]}
            />
          </Panel>
        </div>
      </>}
    </div>
  )
}
