import React from 'react'
import { Cifras, Panel, Barras, Columnas, Plazo, Tabla } from './Tablero.jsx'
import { UMBRAL_DIAS, HORIZONTE_DIAS } from './dal.js'

// Bloques de cada subdirección de Asuntos Laborales. El dashboard de la subdirección los
// muestra completos; el de la dirección, en modo `compacto` (cifras y plazos).

export function BloqueLitigio({ t, compacto = false }) {
  const plazos = (
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
  )
  if (compacto) return <><Cifras items={t.cifras} />{plazos}</>

  return <>
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
      {plazos}
    </div>
  </>
}

export function BloqueRecursos({ t, compacto = false }) {
  if (!t.total) return <Cifras items={t.cifras} />
  const plazos = (
    <Panel titulo="Plazos vencidos y próximos" nota={`Lo que le toca a la DEAJ y aún no se cumple, hasta ${HORIZONTE_DIAS} días.`}>
      <Tabla
        filas={t.tablaPlazos}
        vacio="Sin plazos vencidos ni próximos."
        columnas={[
          { titulo: 'Expediente', render: r => <span className="font-semibold text-ine-text whitespace-nowrap">{r.expediente}</span> },
          { titulo: 'Plazo', campo: 'label' },
          { titulo: 'Abogado', campo: 'abogado' },
          { titulo: 'Vence', render: r => <Plazo dias={r.dias} umbral={UMBRAL_DIAS} /> },
        ]}
      />
    </Panel>
  )
  if (compacto) return <><Cifras items={t.cifras} />{plazos}</>

  return <>
    <Cifras items={t.cifras} />
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel titulo="Expedientes en trámite por etapa" nota={`${t.enTramite} en trámite`}>
        <Barras datos={t.porEtapa} total={t.enTramite} mostrarPct />
      </Panel>
      <Panel titulo="Determinaciones" nota={`${t.total} expedientes`}>
        <Barras datos={t.determinaciones} total={t.total} mostrarPct />
      </Panel>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel titulo="Carga por abogado" nota="Expedientes en trámite asignados a cada persona. Los 8 con más.">
        <Barras datos={t.carga} unidad="expedientes" />
      </Panel>
      {plazos}
    </div>
  </>
}
