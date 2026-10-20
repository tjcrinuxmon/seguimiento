import React from 'react'
import * as XLSX from 'xlsx'
import { ESTADO, TINTA } from './Tablero.jsx'
import { ESTATUS, GRUPOS, etiquetaEstatus, filtrar } from './dal.js'
import { fmtFecha } from '../../recursos/ui.jsx'

// Piezas de los dashboards de plazos (Asuntos Laborales): matriz tipo × estatus, carga por
// abogado y detalle filtrado. Cada número es un botón que abre el detalle con ese filtro.
// Filtro: { tipo?, estatus?, abogado? } (abogado '' = sin abogado).

const fmt = (n) => Number(n || 0).toLocaleString('es-MX')

// Color de una celda según el estatus (solo si tiene algo): rojo vencido, ámbar por vencer.
const TONO_ESTATUS = {
  vencido: ESTADO.vencido,
  urgente: ESTADO.porVencer,
  proximo: { ...ESTADO.porVencer, fondo: '#FFFDF5' },
  fuera:   { texto: '#8A6E4B', fondo: '#F7F0E8', borde: '#EADBC8' },
}

function Numero({ n, tono, onClick, titulo, fuerte }) {
  if (!n) return <span className="text-ine-muted" aria-label="0">·</span>
  const t = tono || {}
  return (
    <button type="button" onClick={onClick} title={titulo}
      className="min-w-[2.5rem] px-2 py-1 rounded-md text-sm hover:underline focus-visible:underline"
      style={{ color: t.texto || TINTA.fuerte, background: t.fondo || 'transparent', border: `1px solid ${t.borde || 'transparent'}`, fontWeight: fuerte || t.texto ? 800 : 600 }}>
      {fmt(n)}
    </button>
  )
}

// Matriz de plazos por estatus. `m` = matriz() de dal.js
export function MatrizPlazos({ m, onFiltro }) {
  const columnas = ESTATUS.filter(e => e.clave !== 'sin_fecha' || m.totales.sin_fecha)
  const nPend = columnas.filter(e => e.grupo === 'pendiente').length
  const nAt = columnas.filter(e => e.grupo === 'atendido').length
  const th = 'px-2 py-2 text-xs font-bold text-ine-muted text-center whitespace-nowrap'
  const sep = { borderLeft: `2px solid ${TINTA.linea}` }
  const esPrimeraDe = (e, i) => i > 0 && columnas[i - 1].grupo !== e.grupo

  return (
    <div className="overflow-x-auto -mx-4 sm:-mx-5">
      <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: 640 }}>
        <thead>
          <tr>
            <th />
            <th colSpan={nPend} className={th} style={{ color: TINTA.media }}>
              <button type="button" className="hover:underline" onClick={() => onFiltro({ estatus: 'pendiente' })}>Pendientes</button>
            </th>
            <th colSpan={nAt} className={th} style={{ ...sep, color: TINTA.media }}>
              <button type="button" className="hover:underline" onClick={() => onFiltro({ estatus: 'atendido' })}>Atendidos</button>
            </th>
            {m.totales.sin_fecha > 0 && <th style={sep} />}
            <th />
          </tr>
          <tr style={{ background: '#F7F5F3' }}>
            <th className="px-4 sm:px-5 py-2 text-left text-xs font-bold text-ine-muted">Tipo</th>
            {columnas.map((e, i) => (
              <th key={e.clave} className={th} style={esPrimeraDe(e, i) ? sep : undefined}>
                <button type="button" className="hover:underline" onClick={() => onFiltro({ estatus: e.clave })}>{e.label}</button>
              </th>
            ))}
            <th className={th} style={sep}>Total</th>
          </tr>
        </thead>
        <tbody>
          {m.filas.map(f => (
            <tr key={f.tipo} style={{ borderTop: `1px solid ${TINTA.pista}` }}>
              <th scope="row" className="px-4 sm:px-5 py-1.5 text-left font-semibold whitespace-nowrap" style={{ color: TINTA.media }}>
                <button type="button" className="hover:underline text-left" onClick={() => onFiltro({ tipo: f.tipo })}>{f.label}</button>
              </th>
              {columnas.map((e, i) => (
                <td key={e.clave} className="px-1 py-1.5 text-center" style={esPrimeraDe(e, i) ? sep : undefined}>
                  <Numero n={f.cuenta[e.clave]} tono={TONO_ESTATUS[e.clave]} titulo={`${f.label} · ${e.label}`}
                    onClick={() => onFiltro({ tipo: f.tipo, estatus: e.clave })} />
                </td>
              ))}
              <td className="px-1 py-1.5 text-center" style={sep}>
                <Numero n={f.total} titulo={`${f.label} · todos`} onClick={() => onFiltro({ tipo: f.tipo })} />
              </td>
            </tr>
          ))}
          <tr style={{ borderTop: `2px solid ${TINTA.linea}`, background: '#FAF9F7' }}>
            <th scope="row" className="px-4 sm:px-5 py-1.5 text-left text-xs font-bold text-ine-muted">Total</th>
            {columnas.map((e, i) => (
              <td key={e.clave} className="px-1 py-1.5 text-center" style={esPrimeraDe(e, i) ? sep : undefined}>
                <Numero n={m.totales[e.clave]} tono={TONO_ESTATUS[e.clave]} fuerte titulo={e.label} onClick={() => onFiltro({ estatus: e.clave })} />
              </td>
            ))}
            <td className="px-1 py-1.5 text-center" style={sep}>
              <Numero n={m.total} fuerte titulo="Todos" onClick={() => onFiltro({})} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// Carga por abogado: pendientes y atendidos. `filas` = cargaAbogados() de dal.js
export function CargaAbogados({ filas, onFiltro }) {
  if (!filas.length) return <p className="text-sm text-ine-muted py-4">Sin asuntos registrados.</p>
  const cols = [
    { clave: 'pendiente',  label: 'Pendientes' },
    { clave: 'vencido',    label: 'Vencidos',    tono: TONO_ESTATUS.vencido },
    { clave: 'por_vencer', label: 'Por vencer',  tono: TONO_ESTATUS.urgente },
    { clave: 'atendido',   label: 'Atendidos',   sep: true },
    { clave: 'fuera',      label: 'Fuera de plazo', tono: TONO_ESTATUS.fuera },
  ]
  const sep = { borderLeft: `2px solid ${TINTA.linea}` }
  return (
    <div className="overflow-x-auto -mx-4 sm:-mx-5">
      <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: 560 }}>
        <thead>
          <tr style={{ background: '#F7F5F3' }}>
            <th className="px-4 sm:px-5 py-2 text-left text-xs font-bold text-ine-muted">Abogado</th>
            {cols.map(c => (
              <th key={c.clave} className="px-2 py-2 text-xs font-bold text-ine-muted text-center whitespace-nowrap" style={c.sep ? sep : undefined}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map(r => (
            <tr key={r.abogado} style={{ borderTop: `1px solid ${TINTA.pista}` }}>
              <th scope="row" className="px-4 sm:px-5 py-1.5 text-left font-semibold whitespace-nowrap" style={{ color: TINTA.media }}>
                <button type="button" className="hover:underline text-left" onClick={() => onFiltro({ abogado: r.abogado })}>
                  {r.abogado || <span className="text-ine-muted font-normal">Sin abogado</span>}
                </button>
              </th>
              {cols.map(c => (
                <td key={c.clave} className="px-1 py-1.5 text-center" style={c.sep ? sep : undefined}>
                  <Numero n={r[c.clave]} tono={c.tono} titulo={`${r.abogado || 'Sin abogado'} · ${c.label}`}
                    onClick={() => onFiltro({ abogado: r.abogado, estatus: c.clave })} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Estatus de un asunto con sus días
export function EstatusAsunto({ a }) {
  const t = TONO_ESTATUS[a.estatus] || ESTADO.neutro
  const texto = {
    vencido:  `Vencido hace ${-a.dias} d`,
    urgente:  a.dias === 0 ? 'Vence hoy' : a.dias === 1 ? 'Vence mañana' : `Vence en ${a.dias} d`,
    proximo:  `Vence en ${a.dias} d`,
    en_plazo: `En plazo · ${a.dias} d`,
    a_tiempo: '✓ A tiempo',
    fuera:    `✓ ${a.retraso} d fuera de plazo`,
    sin_fecha:'Sin fecha de vencimiento',
  }[a.estatus]
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: t.fondo, color: t.texto, border: `1px solid ${t.borde}` }}>{texto}</span>
  )
}

const LIMITE = 300

// Detalle: tabla de los asuntos que cumplen el filtro, con selectores para cambiarlo y Excel.
export function DetalleAsuntos({ asuntos, tipos, filtro, onFiltro, archivo }) {
  const filas = filtrar(asuntos, filtro)
  const abogados = [...new Set(asuntos.flatMap(a => a.abogados.length ? a.abogados : ['']))].sort((a, b) => a.localeCompare(b))
  const tipoLabel = tipos.find(t => t.clave === filtro.tipo)?.label
  const partes = [tipoLabel, filtro.estatus && etiquetaEstatus(filtro.estatus), filtro.abogado !== undefined && (filtro.abogado || 'Sin abogado')].filter(Boolean)
  const cambiar = (campo, valor) => {
    const f = { ...filtro }
    if (valor === null) delete f[campo]; else f[campo] = valor
    onFiltro(f)
  }

  const descargar = () => {
    const datos = filas.map(a => ({
      Expediente: a.expediente, Tipo: a.tipoLabel, Abogado: a.abogado || 'Sin abogado',
      Vence: a.vence || '', Atendido: a.cierre || '', Estatus: etiquetaEstatus(a.estatus),
      'Días': a.estatus === 'fuera' ? a.retraso : a.dias ?? '',
    }))
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(datos), 'Detalle')
    XLSX.writeFile(libro, `${archivo}-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <section className="ine-card p-4 sm:p-5" aria-label="Detalle">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-ine-text">Detalle{partes.length ? `: ${partes.join(' · ')}` : ': todos los asuntos'}</h2>
          <p className="text-xs text-ine-muted mt-0.5">{fmt(filas.length)} {filas.length === 1 ? 'asunto' : 'asuntos'}. Lo pendiente primero, del más urgente.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-outline" style={{ fontSize: 13 }} disabled={!filas.length} onClick={descargar}>↓ Excel</button>
          <button type="button" className="btn-outline" style={{ fontSize: 13 }} onClick={() => onFiltro(null)}>✕ Cerrar</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <select className="ine-input" style={{ width: 'auto' }} aria-label="Tipo" value={filtro.tipo || ''} onChange={e => cambiar('tipo', e.target.value || null)}>
          <option value="">Todos los tipos</option>
          {tipos.map(t => <option key={t.clave} value={t.clave}>{t.label}</option>)}
        </select>
        <select className="ine-input" style={{ width: 'auto' }} aria-label="Estatus" value={filtro.estatus || ''} onChange={e => cambiar('estatus', e.target.value || null)}>
          <option value="">Todos los estatus</option>
          {Object.entries(GRUPOS).map(([k, g]) => <option key={k} value={k}>{g.label}</option>)}
          <option disabled>──────────</option>
          {ESTATUS.map(e => <option key={e.clave} value={e.clave}>{e.label}</option>)}
        </select>
        <select className="ine-input" style={{ width: 'auto' }} aria-label="Abogado"
          value={filtro.abogado === undefined ? '*' : filtro.abogado} onChange={e => cambiar('abogado', e.target.value === '*' ? null : e.target.value)}>
          <option value="*">Todos los abogados</option>
          {abogados.map(a => <option key={a} value={a}>{a || 'Sin abogado'}</option>)}
        </select>
      </div>

      {!filas.length ? (
        <p className="text-sm text-ine-muted py-6">Ningún asunto con este filtro.</p>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:-mx-5 mt-3">
          <table className="w-full text-xs" style={{ borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ background: '#F7F5F3' }}>
                {['Expediente', 'Estatus', 'Tipo', 'Abogado', 'Vence', 'Atendido'].map(h => (
                  <th key={h} className="text-left font-bold text-ine-muted px-4 sm:px-5 py-2 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.slice(0, LIMITE).map(a => (
                <tr key={a.id} style={{ borderTop: `1px solid ${TINTA.pista}`, color: TINTA.media }}>
                  <td className="px-4 sm:px-5 py-2 font-semibold text-ine-text whitespace-nowrap">{a.expediente}</td>
                  <td className="px-4 sm:px-5 py-2"><EstatusAsunto a={a} /></td>
                  <td className="px-4 sm:px-5 py-2">{a.tipoLabel}</td>
                  <td className="px-4 sm:px-5 py-2 whitespace-nowrap">{a.abogado || '—'}</td>
                  <td className="px-4 sm:px-5 py-2 whitespace-nowrap">{a.vence ? fmtFecha(a.vence) : '—'}</td>
                  <td className="px-4 sm:px-5 py-2 whitespace-nowrap">{a.cierre ? fmtFecha(a.cierre) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filas.length > LIMITE && (
            <p className="text-xs text-ine-muted px-4 sm:px-5 pt-2">Se muestran {LIMITE} de {fmt(filas.length)}; el Excel trae todos.</p>
          )}
        </div>
      )}
    </section>
  )
}
