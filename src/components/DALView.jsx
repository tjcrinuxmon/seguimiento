import React, { useState, useCallback, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { getDalSection, createDalRecord, updateDalRecord, deleteDalRecord, getAbogados } from '../api.js'
import Abogados from '../recursos/Abogados.jsx'
import { FranjaAlertas } from './tablero/Tablero.jsx'
import { UMBRAL_DIAS, alertas as contarAlertas, asuntosLitigio, estatusLitigio, clasificar } from './tablero/dal.js'
import { EstatusAsunto } from './tablero/Plazos.jsx'
import { indiceExpedientes, relacionados, clavesExpediente, SECCIONES_RELACION } from './litigio/expedientes.js'

/* ─── CONSTANTS ─────────────────────────────────────────────────────────── */
const ANOS = ['','2022','2023','2024','2025','2026']

// Abogados activos del catálogo de la subdirección (botón "Abogados"), para los selectores.
// La usan Litigio y RI-Consultas.
export const AbogadosCtx = React.createContext(null)
// Litigio: registros de todas las secciones unidos por expediente (columnas "Sentencia",
// "Requerimientos", "Emplazamiento", la sección "Del mismo expediente" del detalle y las
// sugerencias al capturar el expediente). RI-Consultas no lo usa.
const RelacionesCtx = React.createContext(null)
// Abre la ventana de detalle con una "pila" de registros: [{ section, row, enfocar? }]. La
// provee cada SectionView (las pastillas de las columnas ligadas la usan).
const VerCtx = React.createContext(null)
const SECTIONS = ['actores','emplaz','noemplaz','sentencias','requerims','cumplims','incidentes','amparos','conciliacion','oic','reencauz']

/* ─── UTILITIES ─────────────────────────────────────────────────────────── */
const fmtDate = d => { if (!d) return '—'; const [y,m,day] = d.split('-'); return `${day}/${m}/${y}` }
const addDays = (ds, n) => {
  if (!ds || !n) return ''
  const d = new Date(ds + 'T00:00:00')
  d.setDate(d.getDate() + Number(n))
  return d.toISOString().slice(0,10)
}
const daysUntil = ds => {
  if (!ds) return null
  const t = new Date(); t.setHours(0,0,0,0)
  return Math.round((new Date(ds + 'T00:00:00') - t) / 86400000)
}

// Listas dentro de un registro (p. ej. los conceptos de condena de una sentencia):
// type 'lista' con `columnas`. En el Excel van en una celda: "concepto, sentido, … | …".
const textoLista = (c, filas) => (Array.isArray(filas) ? filas : []).map(f => c.columnas
  .map(k => f[k.key] ? (k.type === 'date' ? `${k.label}: ${fmtDate(f[k.key])}` : k.key === 'plazo' ? `${f[k.key]} días` : f[k.key]) : '')
  .filter(Boolean).join(', ')).join(' | ')
// Estatus de un concepto con vencimiento (pendiente / vencido / cumplido a tiempo…)
const estatusConcepto = (f) => f.sentido === 'Absolución' || !f.vencimiento ? null : clasificar(f.vencimiento, f.cumplimiento || null)

/* ─── SHARED UI ─────────────────────────────────────────────────────────── */
function VBadge({ ds }) {
  if (!ds) return <span style={{ color: '#B2B2B2', fontSize: 12 }}>—</span>
  const d = daysUntil(ds)
  const style = d < 0
    ? { background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FECACA' }
    : d <= 3
    ? { background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }
    : d <= 10
    ? { background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A' }
    : { background: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0' }
  return (
    <span style={{ ...style, display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {fmtDate(ds)}
      <span style={{ opacity: 0.7 }}>{d < 0 ? `+${Math.abs(d)}d` : `${d}d`}</span>
    </span>
  )
}

function EntregaBadge({ entrega, venc }) {
  if (!entrega) return <span style={{ color:'#B2B2B2', fontSize:12 }}>—</span>
  if (!venc) return <span style={{ fontSize:13 }}>{fmtDate(entrega)}</span>

  const diff = Math.round(
    (new Date(entrega + 'T00:00:00') - new Date(venc + 'T00:00:00')) / 86400000
  )
  const onTime = diff <= 0
  const style = onTime
    ? { background:'#D1FAE5', color:'#065F46', border:'1px solid #A7F3D0' }
    : { background:'#FEE2E2', color:'#B91C1C', border:'1px solid #FECACA' }
  return (
    <span style={{ ...style, display:'inline-flex', alignItems:'center', gap:4,
      padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
      {fmtDate(entrega)}
      {!onTime && <span style={{ opacity:0.7 }}>+{diff}d</span>}
    </span>
  )
}

// Lista editable de renglones dentro del formulario. Si la lista tiene `venceDesde` (un campo de
// fecha del registro), al capturar el plazo de un renglón se calcula su vencimiento (editable).
function ListaCampo({ schema, value, onChange, form }) {
  const filas = Array.isArray(value) ? value : []
  const poner = (i, k, v) => onChange(filas.map((f, j) => {
    if (j !== i) return f
    const n = { ...f, [k]: v }
    if (k === 'plazo' && schema.venceDesde && form?.[schema.venceDesde] && v) n.vencimiento = addDays(form[schema.venceDesde], v)
    return n
  }))
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#454247', display: 'block', marginBottom: 2 }}>{schema.label}</label>
      {schema.ayuda && <p style={{ fontSize: 11, color: '#828A91', margin: '0 0 8px' }}>{schema.ayuda}</p>}
      <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
        {filas.map((f, i) => (
          <div key={i} style={{ background:'#FBFAF8',border:'1px solid #EDEAE6',borderRadius:8,padding:10 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6 }}>
              <span style={{ fontSize:11,fontWeight:700,color:'#828A91' }}>{schema.renglon || 'Renglón'} {i + 1}</span>
              <button type="button" onClick={() => onChange(filas.filter((_, j) => j !== i))}
                style={{ border:'none',background:'none',cursor:'pointer',fontSize:12,fontWeight:600,color:'#991B1B' }}>Quitar</button>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))',gap:8 }}>
              {schema.columnas.map(c => (
                <div key={c.key} style={c.wide ? { gridColumn:'1 / -1' } : {}}>
                  <span style={{ fontSize:11,fontWeight:600,color:'#454247',display:'block',marginBottom:3 }}>{c.label}</span>
                  {c.type === 'select' ? (
                    <select className="ine-input" value={f[c.key] ?? ''} onChange={e => poner(i, c.key, e.target.value)}>
                      {['', ...c.options].map(o => <option key={o} value={o}>{o || '— Seleccionar —'}</option>)}
                    </select>
                  ) : (
                    <input className="ine-input" type={c.type || 'text'} value={f[c.key] ?? ''} min={c.type === 'number' ? 0 : undefined}
                      onChange={e => poner(i, c.key, e.target.value)} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn-outline" style={{ marginTop:8,fontSize:12,padding:'6px 12px' }}
        onClick={() => onChange([...filas, { ...(schema.nuevo || {}) }])}>+ {schema.agregar || 'Agregar'}</button>
    </div>
  )
}

function FieldInput({ schema, value, onChange, form }) {
  if (schema.type === 'lista') return <ListaCampo schema={schema} value={value} onChange={onChange} form={form} />
  const { label, type, options, required, rows } = schema
  const abogadosCtx = React.useContext(AbogadosCtx)
  const relCtx = React.useContext(RelacionesCtx)

  const labelEl = (
    <label style={{ fontSize: 12, fontWeight: 700, color: '#454247', display: 'block', marginBottom: 5 }}>
      {label}{required && <span style={{ color: '#B91C1C', marginLeft: 2 }}>*</span>}
    </label>
  )


  if (type === 'checkbox') return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', paddingTop: 22 }}>
      <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)}
        style={{ width: 16, height: 16, accentColor: '#454247' }} />
      <span style={{ fontSize: 13 }}>{label}</span>
    </label>
  )
  if (type === 'select' && schema.catalogo && schema.multiple) {
    // Uno o varios abogados ("A/B"): los activos del catálogo; los que ya tenía el registro se
    // conservan aunque estén dados de baja (se pueden quitar para reasignar).
    const activos = (abogadosCtx?.abogados || []).filter(Boolean)
    const elegidos = String(value || '').split('/').map(x => x.trim()).filter(Boolean)
    const poner = (lista) => onChange(lista.join('/'))
    return (
      <div>
        {labelEl}
        <div className="ine-input" style={{ display:'flex',flexWrap:'wrap',alignItems:'center',gap:6,minHeight:40,height:'auto',padding:'6px 8px' }}>
          {elegidos.map(n => (
            <span key={n} style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'2px 4px 2px 10px',borderRadius:16,fontSize:12,fontWeight:600,
              background: activos.includes(n) ? '#EDEAE6' : '#F7F5F3', color:'#454247', border:'1px solid #E3DFDA' }}
              title={activos.includes(n) ? n : `${n} (dado de baja)`}>
              {n}{!activos.includes(n) && <span style={{ fontWeight:400,color:'#828A91' }}>· baja</span>}
              <button type="button" onClick={() => poner(elegidos.filter(x => x !== n))} aria-label={`Quitar a ${n}`}
                style={{ border:'none',background:'none',cursor:'pointer',color:'#828A91',fontSize:14,lineHeight:1,padding:'0 4px' }}>×</button>
            </span>
          ))}
          <select value="" onChange={e => { if (e.target.value) poner([...elegidos, e.target.value]) }} aria-label={`Agregar ${label.toLowerCase()}`}
            style={{ border:'none',background:'transparent',fontSize:13,color:'#828A91',flex:1,minWidth:140,outline:'none',cursor:'pointer' }}>
            <option value="">{elegidos.length ? '+ Agregar otro' : '— Seleccionar —'}</option>
            {activos.filter(a => !elegidos.includes(a)).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
    )
  }
  if (type === 'select') {
    // catalogo: lista de un catálogo que se administra aparte (botón "Abogados")
    const base = (schema.catalogo && abogadosCtx) ? ['', ...abogadosCtx.abogados.filter(Boolean)] : (options || [])
    // Un valor guardado que ya no está en la lista (p. ej. importado) se conserva como opción
    const opts = value && !base.includes(value) ? [...base, value] : base
    return (
      <div>
        {labelEl}
        <select className="ine-input" value={value ?? ''} onChange={e => onChange(e.target.value)}>
          {opts.map(o => <option key={o} value={o}>{o || '— Seleccionar —'}</option>)}
        </select>
      </div>
    )
  }
  if (type === 'textarea') return (
    <div>
      {labelEl}
      <textarea className="ine-input" rows={rows||3} value={value||''} onChange={e => onChange(e.target.value)} />
    </div>
  )
  const sugerir = schema.key === 'expediente' && relCtx?.expedientes?.length
  return (
    <div>
      {labelEl}
      <input type={type||'text'} className="ine-input" value={value??''} onChange={e => onChange(e.target.value)}
        list={sugerir ? 'expedientes-litigio' : undefined} autoComplete={sugerir ? 'off' : undefined} />
      {sugerir && (
        <datalist id="expedientes-litigio">{relCtx.expedientes.map(x => <option key={x} value={x} />)}</datalist>
      )}
      {sugerir && value && !relCtx.idx.has(clavesExpediente(value)[0]) && (
        <p style={{ fontSize:11,color:'#92400E',marginTop:4 }}>Expediente nuevo: no aparece en ninguna otra sección.</p>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:'fixed',inset:0,zIndex:200,display:'flex',alignItems:'flex-start',
      justifyContent:'center',paddingTop:48,paddingLeft:16,paddingRight:16,
      background:'rgba(42,18,57,.55)' }}>
      <div className="ine-card" style={{ width:'100%',maxWidth:680,maxHeight:'88vh',
        display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,.28)',
        animation:'fadeIn .18s ease-out' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',
          padding:'16px 24px',borderBottom:'1px solid #E3DFDA',flexShrink:0 }}>
          <h2 style={{ fontWeight:700,fontSize:15,color:'#454247',margin:0 }}>{title}</h2>
          <button onClick={onClose} style={{ background:'none',border:'none',fontSize:22,
            cursor:'pointer',color:'#B2B2B2',lineHeight:1,padding:'0 6px' }}>×</button>
        </div>
        <div style={{ overflow:'auto',flex:1,padding:'20px 24px' }}>{children}</div>
      </div>
    </div>
  )
}

function ConfirmDelete({ onConfirm, onCancel }) {
  return (
    <div style={{ position:'fixed',inset:0,zIndex:210,display:'flex',alignItems:'center',
      justifyContent:'center',padding:16,background:'rgba(42,18,57,.55)' }}>
      <div className="ine-card" style={{ padding:28,maxWidth:340,width:'100%',textAlign:'center',
        animation:'fadeIn .18s ease-out' }}>
        <div style={{ fontSize:36,marginBottom:12 }}>⚠️</div>
        <p style={{ fontWeight:700,marginBottom:6 }}>¿Eliminar registro?</p>
        <p style={{ color:'#828A91',fontSize:13,marginBottom:20 }}>Esta acción no se puede deshacer.</p>
        <div style={{ display:'flex',gap:12,justifyContent:'center' }}>
          <button className="btn-outline" onClick={onCancel}>Cancelar</button>
          <button className="btn-ine" style={{ background:'#DC2626',boxShadow:'none' }} onClick={onConfirm}>Eliminar</button>
        </div>
      </div>
    </div>
  )
}

function RecordForm({ title, schemas, initial, onSave, onClose, saving }) {
  const [form, setForm] = useState(() => {
    const d = {}
    schemas.forEach(s => { d[s.key] = initial?.[s.key] ?? (s.type === 'checkbox' ? false : s.type === 'lista' ? [] : '') })
    return d
  })
  const set = (key, val) => setForm(f => {
    const n = { ...f, [key]: val }
    if ((key === 'plazo' || key === 'fechaNotificacion') && n.plazo && n.fechaNotificacion)
      n.fechaVencimiento = addDays(n.fechaNotificacion, n.plazo)
    // Listas cuyo vencimiento se cuenta desde este campo: se recalculan los renglones con plazo
    for (const l of schemas.filter(x => x.type === 'lista' && x.venceDesde === key && val)) {
      n[l.key] = (n[l.key] || []).map(f => (f.plazo ? { ...f, vencimiento: addDays(val, f.plazo) } : f))
    }
    return n
  })
  const handleSave = () => {
    const miss = schemas.filter(s => s.required && !form[s.key])
    if (miss.length) { alert('Campos requeridos: ' + miss.map(s => s.label).join(', ')); return }
    onSave(form)
  }
  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
        {schemas.filter(s => !s.tableOnly).map(s => (
          <div key={s.key} style={s.wide ? { gridColumn:'1 / -1' } : {}}>
            <FieldInput schema={s} value={form[s.key]} onChange={v => set(s.key, v)} form={form} />
          </div>
        ))}
      </div>
      <div style={{ display:'flex',gap:12,justifyContent:'flex-end',
        marginTop:24,paddingTop:20,borderTop:'1px solid #E3DFDA' }}>
        <button className="btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
        <button className="btn-ine" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : (initial ? 'Guardar cambios' : 'Agregar registro')}
        </button>
      </div>
    </Modal>
  )
}

// Detalle de un registro: todos sus campos (también los que no salen en la tabla), con
// Editar y Cerrar. Se abre al hacer clic en un renglón.
// Del mismo expediente: los registros de las demás secciones, con sus fechas y estatus. Cada
// tarjeta abre el detalle de ese registro (`onAbrir`). `enfocar`: sección a la que se lleva la vista.
function DelMismoExpediente({ row, section, onAbrir, enfocar }) {
  const rel = React.useContext(RelacionesCtx)
  const ref = React.useRef(null)
  useEffect(() => {
    if (enfocar) ref.current?.querySelector(`[data-seccion="${enfocar}"]`)?.scrollIntoView({ block: 'center' })
  }, [enfocar, row])
  if (!rel || !row.expediente) return null
  const otros = relacionados(rel.idx, row, section)
  const secciones = SECCIONES_RELACION.filter(k => otros[k]?.length)
  return (
    <section ref={ref} style={{ marginTop:20,paddingTop:16,borderTop:'1px solid #E3DFDA' }}>
      <h3 style={{ fontSize:13,fontWeight:700,color:'#454247',margin:'0 0 2px' }}>Del mismo expediente</h3>
      <p style={{ fontSize:11,color:'#828A91',margin:'0 0 10px' }}>Haz clic en cualquiera para ver su detalle.</p>
      {!secciones.length && <p style={{ fontSize:12,color:'#828A91',margin:0 }}>No hay registros de este expediente en otras secciones.</p>}
      <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
        {secciones.flatMap(k => otros[k].map((r, i) => {
          const est = estatusLitigio(k, r)
          const datos = (SCHEMAS[k] || []).filter(c => c.key !== 'expediente' && !c.calc && r[c.key] &&
            (c.type === 'date' || c.key === 'estatus' || c.key === 'actor' || c.key === 'abogado' || c.key === 'sentido'))
          const resaltar = enfocar === k
          return (
            <button key={`${k}-${r.id}`} type="button" onClick={() => onAbrir(k, r)} data-seccion={i === 0 ? k : undefined}
              title={`Ver el detalle de ${SECTION_TITLES[k].toLowerCase()}`}
              style={{ textAlign:'left',width:'100%',cursor:'pointer',background: resaltar ? '#FFFBEB' : '#FBFAF8',
                border:`1px solid ${resaltar ? '#FCD34D' : '#EDEAE6'}`,borderRadius:8,padding:'8px 12px' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#828A91' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = resaltar ? '#FCD34D' : '#EDEAE6' }}>
              <span style={{ display:'flex',flexWrap:'wrap',alignItems:'center',gap:8,justifyContent:'space-between' }}>
                <span style={{ fontSize:12,fontWeight:700,color:'#454247' }}>
                  {SECTION_TITLES[k]}{r.expediente !== row.expediente && <span style={{ fontWeight:400,color:'#828A91' }}> · {r.expediente}</span>}
                </span>
                <span style={{ display:'inline-flex',alignItems:'center',gap:8 }}>
                  {est && est.estatus !== 'sin_fecha' && <EstatusAsunto a={est} />}
                  <span aria-hidden="true" style={{ color:'#828A91',fontSize:14 }}>›</span>
                </span>
              </span>
              {datos.length > 0 && (
                <span style={{ display:'block',fontSize:12,color:'#454247',margin:'4px 0 0' }}>
                  {datos.map(c => `${c.label}: ${c.type === 'date' ? fmtDate(r[c.key]) : r[c.key]}`).join(' · ')}
                </span>
              )}
            </button>
          )
        }))}
      </div>
    </section>
  )
}

// Detalle de un registro: todos sus campos, con Editar y Cerrar. En Litigio se puede navegar a
// los registros ligados (`pila`: de dónde se viene) y editar el que se está viendo, aunque sea
// de otra sección. En RI-Consultas (sin relaciones) Editar abre el formulario de la tabla.
function DetalleRegistro({ pila, setPila, title, schemas, canEdit, onEdit, onClose }) {
  const rel = React.useContext(RelacionesCtx)
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const { section, row, enfocar } = pila[pila.length - 1]
  // Al saltar a otro registro, la ventana vuelve arriba (salvo que haya que enfocar una lista)
  const arriba = React.useRef(null)
  useEffect(() => { if (!enfocar) arriba.current?.scrollIntoView({ block: 'start' }) }, [pila.length, row, enfocar])
  const sch = rel ? (SCHEMAS[section] || schemas) : schemas
  const tit = rel ? SECTION_TITLES[section] : title

  const valor = (c) => {
    const v = row[c.key]
    if (c.entregaBadge) return <EntregaBadge entrega={v} venc={row[c.entregaBadge]} />
    if (c.isVenc) return <VBadge ds={v} />
    if (c.type === 'checkbox') return v ? 'Sí' : 'No'
    if (c.type === 'lista') return (
      <span style={{ display:'flex',flexDirection:'column',gap:6,marginTop:2 }}>
        {(v || []).map((f, i) => {
          const est = estatusConcepto(f)
          return (
            <span key={i} style={{ display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8,
              background:'#FBFAF8',border:'1px solid #EDEAE6',borderRadius:8,padding:'6px 10px' }}>
              <span style={{ fontSize:13 }}>
                <strong>{f.concepto || '(sin concepto)'}</strong>
                <span style={{ color:'#828A91' }}>
                  {[f.sentido, f.plazo && `${f.plazo} días`, f.vencimiento && `vence ${fmtDate(f.vencimiento)}`,
                    f.cumplimiento && `cumplido ${fmtDate(f.cumplimiento)}`].filter(Boolean).map(x => ` · ${x}`).join('')}
                </span>
              </span>
              {est && est.estatus !== 'sin_fecha' && <EstatusAsunto a={est} />}
            </span>
          )
        })}
      </span>
    )
    if (v === undefined || v === null || v === '') return <span style={{ color:'#B2B2B2' }}>—</span>
    if (c.type === 'date') return fmtDate(v)
    return <span style={{ whiteSpace:'pre-wrap',overflowWrap:'anywhere' }}>{String(v)}</span>
  }
  // Primero los campos con algo capturado; los vacíos al final, para que lo importante se vea
  const vacio = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)
  const llenos = sch.filter(c => !c.tableOnly && !vacio(row[c.key]))
  const vacios = sch.filter(c => !c.tableOnly && !llenos.includes(c))
  const Campo = ({ c }) => (
    <div style={c.wide || c.type === 'textarea' ? { gridColumn:'1 / -1' } : {}}>
      <dt style={{ fontSize:11,fontWeight:700,color:'#828A91',marginBottom:3 }}>{c.label}</dt>
      <dd style={{ fontSize:13,color:'#454247',margin:0 }}>{valor(c)}</dd>
    </div>
  )

  if (editando) return (
    <RecordForm title={`Editar — ${tit}`} schemas={sch} initial={row} saving={guardando}
      onClose={() => setEditando(false)}
      onSave={async (form) => {
        setGuardando(true)
        try {
          const guardado = await updateDalRecord(section, row.id, form)
          rel.actualizar(section, guardado)
          setPila(p => [...p.slice(0, -1), { section, row: guardado }])
          setEditando(false)
        } catch (e) { alert(e?.response?.data?.error || 'Error al guardar el registro') }
        finally { setGuardando(false) }
      }} />
  )

  return (
    <Modal title={rel && row.expediente ? `${tit} · ${row.expediente}` : tit} onClose={onClose}>
      <div ref={arriba} />
      {pila.length > 1 && (
        <nav aria-label="De dónde vienes" style={{ display:'flex',flexWrap:'wrap',alignItems:'center',gap:6,fontSize:12,marginBottom:14 }}>
          {pila.slice(0, -1).map((x, i) => (
            <React.Fragment key={i}>
              <button type="button" onClick={() => setPila(p => p.slice(0, i + 1))}
                style={{ border:'none',background:'none',cursor:'pointer',color:'#454247',textDecoration:'underline',padding:0,fontSize:12 }}>
                {i === pila.length - 2 ? '← ' : ''}{SECTION_TITLES[x.section]}
              </button>
              <span aria-hidden="true" style={{ color:'#828A91' }}>›</span>
            </React.Fragment>
          ))}
          <span style={{ fontWeight:700,color:'#454247' }}>{tit}</span>
        </nav>
      )}
      <dl style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:'14px 20px',margin:0 }}>
        {llenos.map(c => <Campo key={c.key} c={c} />)}
      </dl>
      {vacios.length > 0 && (
        <p style={{ fontSize:12,color:'#828A91',marginTop:16 }}>
          Sin capturar: {vacios.map(c => c.label).join(', ')}.
        </p>
      )}
      <DelMismoExpediente row={row} section={section} enfocar={enfocar}
        onAbrir={(k, r) => setPila(p => [...p.slice(0, -1), { section, row }, { section: k, row: r }])} />
      <div style={{ display:'flex',gap:12,justifyContent:'flex-end',marginTop:20,paddingTop:16,borderTop:'1px solid #E3DFDA' }}>
        <button className="btn-outline" onClick={onClose}>Cerrar</button>
        {canEdit && <button className="btn-ine" onClick={() => (rel ? setEditando(true) : onEdit())}>Editar</button>}
      </div>
    </Modal>
  )
}

function DataTable({ schemas, rows, onView, onEdit, onDelete, canEdit, canDelete }) {
  const cols = schemas.filter(s => !s.formOnly)
  const rel = React.useContext(RelacionesCtx)
  const ver = React.useContext(VerCtx)
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%',fontSize:13,borderCollapse:'separate',borderSpacing:0 }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key} style={{ padding:'10px 12px',textAlign:'left',fontSize:11,fontWeight:700,
                color:'#828A91',background:'#F7F5F3',borderBottom:'1.5px solid #E3DFDA',
                whiteSpace:'nowrap',position:'sticky',top:0,zIndex:1 }}>
                {c.label}
              </th>
            ))}
            <th style={{ padding:'10px 12px',background:'#F7F5F3',borderBottom:'1.5px solid #E3DFDA',width:80 }} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={cols.length+1} style={{ padding:'40px 12px',textAlign:'center',color:'#B2B2B2' }}>
              Sin registros. Usa «Nuevo registro» para agregar.
            </td></tr>
          )}
          {rows.map((row, i) => (
            <tr key={row.id||i} style={{ borderBottom:'1px solid #EDEAE6',cursor:'pointer' }}
              onClick={() => onView(row)} tabIndex={0} title="Ver el registro completo"
              onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) onView(row) }}
              onMouseEnter={e => e.currentTarget.style.background='#F7F5F3'}
              onMouseLeave={e => e.currentTarget.style.background=''}>
              {cols.map(c => (
                <td key={c.key} title={typeof row[c.key] === 'string' && row[c.key].length > 25 ? row[c.key] : undefined}
                  style={{ padding:'10px 12px',whiteSpace:'nowrap',maxWidth:c.wide ? 320 : 200,overflow:'hidden',textOverflow:'ellipsis' }}>
                  {c.calc
                    ? (rel ? c.calc(row, rel, ver?.abrir) : null)
                    : c.entregaBadge
                    ? <EntregaBadge entrega={row[c.key]} venc={row[c.entregaBadge]} />
                    : c.isVenc
                    ? <VBadge ds={row[c.key]} />
                    : c.type === 'checkbox'
                    ? row[c.key] ? <span style={{ color:'#059669',fontWeight:700 }}>✓</span> : <span style={{ color:'#B2B2B2' }}>—</span>
                    : c.type === 'date' ? fmtDate(row[c.key])
                    : <span style={c.key === 'expediente' ? { fontWeight:600,color:'#454247' } : {}}>
                        {row[c.key] || '—'}
                      </span>}
                </td>
              ))}
              <td style={{ padding:'10px 12px' }} onClick={e => e.stopPropagation()}>
                <div style={{ display:'flex',gap:4 }}>
                  {canEdit && (
                    <button onClick={() => onEdit(row)} title="Editar"
                      style={{ background:'none',border:'none',cursor:'pointer',padding:'4px 8px',
                        borderRadius:5,fontSize:13,color:'#828A91' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#EFEBE7'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}>✏️</button>
                  )}
                  {canDelete && (
                    <button onClick={() => onDelete(row)} title="Eliminar"
                      style={{ background:'none',border:'none',cursor:'pointer',padding:'4px 8px',
                        borderRadius:5,fontSize:13,color:'#EF4444' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#FEE2E2'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}>🗑</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const PAGE_SIZE = 10
// Secciones con un solo registro por expediente (texto para el aviso)
const UNICO_POR_EXPEDIENTE = { sentencias: 'una sentencia' }
const DAL_API = { crear: createDalRecord, actualizar: updateDalRecord, eliminar: deleteDalRecord }

// Tabla de captura de una sección (buscar, paginar, Excel, alta/edición/baja). `api` dice
// dónde se guarda: Litigio por omisión; RI-Consultas pasa la suya.
export function SectionView({ title, section, schemas, records, onUpdate, user, api = DAL_API }) {
  const [showForm,   setShowForm]   = useState(false)
  const [editing,    setEditing]    = useState(null)
  const [deleting,   setDeleting]   = useState(null)
  const [pila,       setPila]       = useState(null)   // detalle abierto: [{ section, row, enfocar? }]
  const [search,     setSearch]     = useState('')
  const [saving,     setSaving]     = useState(false)
  const [page,       setPage]       = useState(0)
  const [anoFilter,  setAnoFilter]  = useState('')

  const canEdit   = user?.role === 'admin' || user?.role === 'ejecutiva' || user?.direccion === 'asuntos_laborales'
  const canDelete = user?.role === 'admin'

  const hasAnoField = schemas.some(s => s.key === 'ano')

  const filtered = useMemo(() => {
    let result = records
    if (hasAnoField && anoFilter) result = result.filter(r => r.ano === anoFilter)
    if (!search.trim()) return result
    const q = search.toLowerCase()
    return result.filter(r => Object.values(r).some(v => (v && typeof v === 'object' ? JSON.stringify(v) : String(v)).toLowerCase().includes(q)))
  }, [records, search, anoFilter, hasAnoField])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages - 1)
  const paginated  = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  const handleSearch = (val) => { setSearch(val); setPage(0) }

  const exportExcel = () => {
    // El Excel lleva todos los campos, también los que solo salen en el formulario
    const cols = schemas.filter(s => !s.tableOnly)
    const data = filtered.map(row => {
      const obj = {}
      cols.forEach(c => { obj[c.label] = c.type === 'lista' ? textoLista(c, row[c.key]) : (row[c.key] ?? '') })
      return obj
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31))
    XLSX.writeFile(wb, `${section}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // Secciones con un solo registro por expediente: si ya existe, se avisa y se ofrece modificarlo
  const [duplicado, setDuplicado] = useState(null)
  const handleSave = async (form) => {
    // (Al editar sin cambiar el expediente no se revisa: hay expedientes con dos sentencias de antes)
    const mismoExpediente = editing && clavesExpediente(editing.expediente).join() === clavesExpediente(form.expediente).join()
    if (UNICO_POR_EXPEDIENTE[section] && !mismoExpediente) {
      const claves = clavesExpediente(form.expediente)
      const existente = records.find(r => (!editing || r.id !== editing.id) && clavesExpediente(r.expediente).some(k => claves.includes(k)))
      if (existente) { setDuplicado(existente); return }
    }
    setSaving(true)
    try {
      if (editing) {
        const saved = await api.actualizar(section, editing.id, form)
        onUpdate(records.map(r => r.id === editing.id ? saved : r))
      } else {
        const created = await api.crear(section, form)
        onUpdate([...records, created])
      }
      setShowForm(false); setEditing(null)
    } catch (e) { alert(e?.response?.data?.error || 'Error al guardar el registro') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try {
      await api.eliminar(section, deleting.id)
      onUpdate(records.filter(r => r.id !== deleting.id))
    } catch { alert('Error al eliminar el registro') }
    setDeleting(null)
  }

  return (
    <div className="fade-in">
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:18,fontWeight:700,color:'#454247',margin:0 }}>{title}</h2>
          <p style={{ color:'#828A91',fontSize:13,marginTop:3 }}>
            {records.length} registro{records.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canEdit && (
          <button className="btn-ine" onClick={() => { setEditing(null); setShowForm(true) }}>
            + Nuevo registro
          </button>
        )}
      </div>

      <div className="ine-card">
        <div style={{ padding:'12px 16px',borderBottom:'1px solid #E3DFDA',
          display:'flex',alignItems:'center',gap:10,flexWrap:'wrap' }}>
          <input className="ine-input" style={{ flex:1,minWidth:180,maxWidth:300 }}
            placeholder="Buscar en todos los campos…"
            value={search} onChange={e => handleSearch(e.target.value)} />
          {hasAnoField && (
            <select className="ine-input" style={{ width:'auto' }}
              value={anoFilter} onChange={e => { setAnoFilter(e.target.value); setPage(0) }}>
              <option value="">Todos los años</option>
              {ANOS.filter(a => a).map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          <button className="btn-outline" onClick={exportExcel}
            style={{ marginLeft:'auto', whiteSpace:'nowrap', fontSize:12, padding:'6px 14px' }}>
            ↓ Excel
          </button>
        </div>
        <VerCtx.Provider value={{ abrir: setPila }}>
        <DataTable schemas={schemas} rows={paginated}
          onView={r => setPila([{ section, row: r }])}
          onEdit={r => { setEditing(r); setShowForm(true) }}
          onDelete={r => setDeleting(r)}
          canEdit={canEdit} canDelete={canDelete} />
        </VerCtx.Provider>
        {filtered.length > PAGE_SIZE && (
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',
            padding:'10px 16px',borderTop:'1px solid #E3DFDA',background:'#FDFCFE' }}>
            <span style={{ fontSize:12,color:'#828A91' }}>
              Registros {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
            </span>
            <div style={{ display:'flex',alignItems:'center',gap:6 }}>
              <button disabled={safePage === 0} onClick={() => setPage(p => p - 1)}
                style={{ padding:'4px 12px',borderRadius:5,border:'1px solid #E3DFDA',
                  background: safePage === 0 ? '#F7F5F3' : '#fff',
                  color: safePage === 0 ? '#C4B8D0' : '#454247',
                  cursor: safePage === 0 ? 'default' : 'pointer',fontSize:13,fontWeight:600 }}>
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setPage(i)}
                  style={{ padding:'4px 10px',borderRadius:5,border:'1px solid #E3DFDA',
                    background: i === safePage ? '#454247' : '#fff',
                    color: i === safePage ? '#fff' : '#828A91',
                    cursor:'pointer',fontSize:12,fontWeight:600,
                    display: Math.abs(i - safePage) > 2 && i !== 0 && i !== totalPages - 1 ? 'none' : 'block' }}>
                  {i + 1}
                </button>
              ))}
              <button disabled={safePage === totalPages - 1} onClick={() => setPage(p => p + 1)}
                style={{ padding:'4px 12px',borderRadius:5,border:'1px solid #E3DFDA',
                  background: safePage === totalPages - 1 ? '#F7F5F3' : '#fff',
                  color: safePage === totalPages - 1 ? '#C4B8D0' : '#454247',
                  cursor: safePage === totalPages - 1 ? 'default' : 'pointer',fontSize:13,fontWeight:600 }}>
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <RecordForm key={editing?.id ?? 'nuevo'}
          title={editing ? `Editar — ${title}` : `Nuevo — ${title}`}
          schemas={schemas} initial={editing}
          onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null) }}
          saving={saving} />
      )}
      {deleting && <ConfirmDelete onConfirm={handleDelete} onCancel={() => setDeleting(null)} />}
      {duplicado && (
        <div style={{ position:'fixed',inset:0,zIndex:220,display:'flex',alignItems:'center',justifyContent:'center',padding:16,background:'rgba(42,18,57,.55)' }}>
          <div className="ine-card" role="alertdialog" aria-labelledby="dup-titulo" style={{ padding:24,maxWidth:440,width:'100%' }}>
            <p id="dup-titulo" style={{ fontWeight:700,marginBottom:8,color:'#454247' }}>Ya hay un registro con ese expediente</p>
            <p style={{ fontSize:13,color:'#454247',marginBottom:18 }}>
              El expediente <strong>{duplicado.expediente}</strong> ya tiene {UNICO_POR_EXPEDIENTE[section]} registrada. Solo puede haber una por
              expediente. ¿Quieres modificar la que ya existe? (Ahí puedes agregar sus conceptos de condena.)
            </p>
            <div style={{ display:'flex',gap:10,justifyContent:'flex-end',flexWrap:'wrap' }}>
              <button className="btn-outline" onClick={() => setDuplicado(null)}>Seguir editando</button>
              <button className="btn-ine" onClick={() => { setEditing(duplicado); setDuplicado(null); setShowForm(true) }}>Modificar la existente</button>
            </div>
          </div>
        </div>
      )}
      {pila && !showForm && (
        <DetalleRegistro title={title} schemas={schemas} pila={pila} setPila={setPila} canEdit={canEdit}
          onEdit={() => { setEditing(pila[pila.length - 1].row); setPila(null); setShowForm(true) }}
          onClose={() => setPila(null)} />
      )}
    </div>
  )
}

/* ─── COLUMNAS DEL MISMO EXPEDIENTE ──────────────────────────────────────── */
const Pastilla = ({ texto, tono = 'neutro', title, onClick }) => {
  const t = { neutro: ['#F7F5F3', '#454247', '#E3DFDA'], ok: ['#ECFDF5', '#065F46', '#A7F3D0'], pendiente: ['#FFFBEB', '#92400E', '#FCD34D'], vacio: ['transparent', '#B2B2B2', 'transparent'] }[tono]
  const estilo = { display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600,whiteSpace:'nowrap',
    background:t[0],color:t[1],border:`1px solid ${t[2]}` }
  if (!onClick) return <span title={title} style={estilo}>{texto}</span>
  // Clic: abre el registro ligado (sin abrir además el detalle del renglón)
  return (
    <button type="button" title={title} onClick={e => { e.stopPropagation(); onClick() }}
      style={{ ...estilo, cursor:'pointer' }}
      onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
      onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}>{texto}</button>
  )
}
const otrosDe = (rel, row, seccion, propia) => relacionados(rel.idx, row, propia)[seccion] || []
// Abre el ligado: si es uno, su detalle (con el renglón para volver); si son varios, el detalle
// del renglón llevado a esa lista.
const abrirLigados = (abrir, propia, row, seccion, lista) => abrir && (() => abrir(lista.length === 1
  ? [{ section: propia, row }, { section: seccion, row: lista[0] }]
  : [{ section: propia, row, enfocar: seccion }]))

// Emplazamientos / requerimientos → ¿ya hay sentencia?
const colSentencia = (propia) => (row, rel, abrir) => {
  const s = otrosDe(rel, row, 'sentencias', propia)
  if (!s.length) return <Pastilla texto="Pendiente" tono="pendiente" title="Aún no hay sentencia registrada para este expediente" />
  const fechas = s.map(x => x.fechaNotificacion).filter(Boolean).sort()
  const texto = fechas.length ? `✓ ${fmtDate(fechas[fechas.length - 1])}` : '✓ Registrada'
  return <Pastilla texto={s.length > 1 ? `${texto} (${s.length})` : texto} tono="ok"
    title={s.length > 1 ? `Ver las ${s.length} sentencias` : 'Ver la sentencia'} onClick={abrirLigados(abrir, propia, row, 'sentencias', s)} />
}
// Emplazamientos → requerimientos (cuántos y cuántos siguen abiertos)
const colRequerims = (row, rel, abrir) => {
  const r = otrosDe(rel, row, 'requerims', 'emplaz')
  if (!r.length) return <Pastilla texto="—" tono="vacio" />
  const abiertos = r.filter(x => estatusLitigio('requerims', x)?.estatus && !['a_tiempo', 'fuera'].includes(estatusLitigio('requerims', x).estatus)).length
  return <Pastilla texto={abiertos ? `${r.length} · ${abiertos} abierto${abiertos > 1 ? 's' : ''}` : `${r.length} · atendidos`} tono={abiertos ? 'pendiente' : 'ok'}
    title={r.length > 1 ? `Ver los ${r.length} requerimientos` : 'Ver el requerimiento'} onClick={abrirLigados(abrir, 'emplaz', row, 'requerims', r)} />
}
// Sentencias → conceptos de condena / absolución (cuántos y cuántos siguen pendientes)
const colConceptos = (row, rel, abrir) => {
  const c = Array.isArray(row.condenas) ? row.condenas : []
  if (!c.length) return <Pastilla texto="—" tono="vacio" />
  const condenas = c.filter(f => f.sentido !== 'Absolución').length
  const pendientes = c.filter(f => ['vencido', 'urgente', 'proximo', 'en_plazo'].includes(estatusConcepto(f)?.estatus)).length
  const texto = `${c.length} · ${condenas} condena${condenas === 1 ? '' : 's'}${pendientes ? ` · ${pendientes} pendiente${pendientes === 1 ? '' : 's'}` : ''}`
  return <Pastilla texto={texto} tono={pendientes ? 'pendiente' : 'neutro'} title="Ver los conceptos de la sentencia"
    onClick={abrir && (() => abrir([{ section: 'sentencias', row }]))} />
}
// Sentencias → incidentes del expediente
const colIncidentes = (row, rel, abrir) => {
  const i = otrosDe(rel, row, 'incidentes', 'sentencias')
  if (!i.length) return <Pastilla texto="—" tono="vacio" />
  return <Pastilla texto={String(i.length)} tono="neutro" title={i.length > 1 ? `Ver los ${i.length} incidentes` : 'Ver el incidente'}
    onClick={abrirLigados(abrir, 'sentencias', row, 'incidentes', i)} />
}
// Sentencias / requerimientos → ¿tiene emplazamiento registrado?
const colEmplaz = (propia) => (row, rel, abrir) => {
  const e = otrosDe(rel, row, 'emplaz', propia)
  if (!e.length) return <Pastilla texto="Sin registro" tono="vacio" title="No hay emplazamiento registrado para este expediente" />
  const f = e.map(x => x.fechaEmplaz).filter(Boolean).sort()[0]
  return <Pastilla texto={f ? `✓ ${fmtDate(f)}` : '✓ Registrado'} tono="ok" title="Ver el emplazamiento"
    onClick={abrirLigados(abrir, propia, row, 'emplaz', e)} />
}

/* ─── SECTION SCHEMAS ───────────────────────────────────────────────────── */
// entregaBadge marca el campo que da por atendido el plazo (verde a tiempo, rojo fuera de plazo);
// debe coincidir con TIPOS_LITIGIO de tablero/dal.js, que usa los dashboards.
const S_ACTORES = [
  { key:'expediente',    label:'Expediente',    required:true },
  { key:'actor',         label:'Actor',         required:true },
  { key:'cargo',         label:'Cargo' },
  { key:'adscripcion',   label:'Área de adscripción' },
  { key:'representante', label:'Abogado o representante legal' },
  { key:'ano',           label:'Año',           type:'select', options:ANOS },
  { key:'observaciones', label:'Observaciones', type:'textarea', wide:true },
]
const S_EMPLAZ = [
  { key:'expediente',      label:'Expediente',      required:true },
  { key:'fechaEmplaz',     label:'Fecha Emplazamiento', type:'date' },
  { key:'abogado',         label:'Abogado',         type:'select', catalogo:true, multiple:true },
  { key:'entregaFicha',    label:'Entrega Ficha',   type:'date' },
  { key:'revision',        label:'Revisión',        type:'date' },
  { key:'vencimiento',     label:'Vencimiento',     type:'date' },
  { key:'entregaTribunal', label:'Entrega Tribunal', type:'date', entregaBadge:'vencimiento' },
  { key:'medioEntrega',    label:'Medio Entrega',   type:'select',
    options:['','Física','Paquetería DHL','Auxilio Jurisdiccional'] },
  { key:'actoImpugnado',   label:'Acto Impugnado',  wide:true },
  { key:'_sentencia',      label:'Sentencia',       tableOnly:true, calc: colSentencia('emplaz') },
  { key:'_requerims',      label:'Requerimientos',  tableOnly:true, calc: colRequerims },
]
const S_NOEMPLAZ = [
  { key:'expediente',    label:'Expediente',  required:true },
  { key:'sentido',       label:'Sentido' },
  { key:'actor',         label:'Actor' },
  { key:'estatus',       label:'Estatus',     type:'select',
    options:['','EMPLAZADO','EMPLAZAMIENTO PENDIENTE','SE DESECHA'] },
  { key:'observaciones', label:'OBS / Notas', type:'textarea', wide:true },
]
const S_SENTENCIAS = [
  { key:'expediente',        label:'Expediente',       required:true },
  { key:'fechaNotificacion', label:'Fecha Notificación', type:'date' },
  { key:'plazo',             label:'Plazo (días)',      type:'number' },
  { key:'fechaVencimiento',  label:'Fecha Vencimiento', type:'date' },
  { key:'abogado',           label:'Abogado',          type:'select', catalogo:true, multiple:true },
  { key:'fechaEntregaTEPJF', label:'Entrega TEPJF',    type:'date', entregaBadge:'fechaVencimiento' },
  { key:'condenas',          label:'Conceptos de condena o absolución', type:'lista', wide:true, formOnly:true,
    venceDesde:'fechaNotificacion', renglon:'Concepto', agregar:'Agregar concepto', nuevo:{ sentido:'Condena' },
    ayuda:'Cada prestación con su sentido y su plazo; el vencimiento se calcula desde la notificación (se puede corregir).',
    columnas:[
      { key:'concepto',     label:'Concepto (prestación)', wide:true },
      { key:'sentido',      label:'Sentido', type:'select', options:['Condena', 'Absolución'] },
      { key:'plazo',        label:'Plazo (días)', type:'number' },
      { key:'vencimiento',  label:'Vencimiento', type:'date' },
      { key:'cumplimiento', label:'Cumplimiento', type:'date' },
    ] },
  { key:'_conceptos',        label:'Conceptos',        tableOnly:true, calc: colConceptos },
  { key:'_incidentes',       label:'Incidentes',       tableOnly:true, calc: colIncidentes },
  { key:'_emplaz',           label:'Emplazamiento',    tableOnly:true, calc: colEmplaz('sentencias') },
]
const S_REQUERIMS = [
  { key:'expediente',        label:'Expediente',        required:true },
  { key:'plazo',             label:'Plazo (días)',       type:'number' },
  { key:'fechaVencimiento',  label:'Fecha Vencimiento',  type:'date' },
  { key:'fechaNotificacion', label:'Fecha Notificación', type:'date' },
  { key:'abogado',           label:'Abogado',           type:'select', catalogo:true, multiple:true },
  { key:'fechaEntregaTEPJF', label:'Entrega TEPJF',     type:'date', entregaBadge:'fechaVencimiento' },
  { key:'observaciones',     label:'Observaciones',     type:'textarea', wide:true },
  { key:'_sentencia',        label:'Sentencia',         tableOnly:true, calc: colSentencia('requerims') },
  { key:'_emplaz',           label:'Emplazamiento',     tableOnly:true, calc: colEmplaz('requerims') },
]
const S_CUMPLIMS = [
  { key:'expediente',             label:'Expediente',            required:true },
  { key:'actor',                  label:'Actor' },
  { key:'sentencia',              label:'Fecha Sentencia',       type:'date' },
  { key:'condena',                label:'Condena',               type:'textarea', wide:true },
  { key:'prestacionesPagadas',    label:'Prestaciones Pagadas',  type:'textarea', wide:true },
  { key:'prestacionesPorCumplir', label:'Prestaciones por Cumplir', type:'textarea', wide:true },
  { key:'abogado',                label:'Abogado',               type:'select', catalogo:true, multiple:true },
  { key:'returno',                label:'Returno' },
  { key:'notificaciones',         label:'Notificaciones',        type:'textarea', wide:true },
  { key:'fechaEntrega',           label:'Fecha de Entrega',      type:'date' },
  { key:'estatus',                label:'Estatus',               type:'select',
    options:['','PRESENTADA','FORMALMENTE CONCLUIDO'] },
]
const S_INCIDENTES = [
  { key:'expediente',        label:'Expediente',        required:true },
  { key:'fechaVencimiento',  label:'Fecha Vencimiento',  type:'date' },
  { key:'plazo',             label:'Plazo (días)',       type:'number' },
  { key:'fechaNotificacion', label:'Fecha Notificación', type:'date', entregaBadge:'fechaVencimiento' },
  { key:'abogado',           label:'Abogado',           type:'select', catalogo:true, multiple:true },
]
const S_AMPAROS = [
  { key:'expediente',        label:'Expediente',        required:true },
  { key:'actor',             label:'Actor' },
  { key:'plazo',             label:'Plazo (días)',       type:'number' },
  { key:'fechaVencimiento',  label:'Fecha Vencimiento',  type:'date' },
  { key:'fechaNotificacion', label:'Fecha Notificación', type:'date' },
  { key:'abogado',           label:'Abogado',           type:'select', catalogo:true, multiple:true },
  { key:'tribunal',          label:'Tribunal' },
  { key:'fechaCumplimiento', label:'Fecha Cumplimiento', type:'date', entregaBadge:'fechaVencimiento' },
]
const S_CONCILIACION = [
  { key:'expediente',        label:'Expediente',        required:true },
  { key:'actor',             label:'Actor' },
  { key:'fechaNotificacion', label:'Fecha Notificación', type:'date' },
  { key:'fechaAudiencia',    label:'Fecha Audiencia',   type:'date', isVenc:true },
  { key:'ubicacion',         label:'Ubicación Audiencia' },
  { key:'abogado',           label:'Abogado',           type:'select', catalogo:true, multiple:true },
]
const S_OIC = [
  { key:'expediente',        label:'Expediente',        required:true },
  { key:'fechaNotificacion', label:'Fecha Notificación', type:'date' },
  { key:'numeroOficio',      label:'Número de Oficio' },
  { key:'responsable',       label:'Responsable' },
]
const S_REENCAUZ = [
  { key:'expediente',        label:'Expediente',        required:true },
  { key:'fechaNotificacion', label:'Fecha Notificación', type:'date' },
  { key:'actor',             label:'Actor' },
  { key:'abogado',           label:'Abogado',           type:'select', catalogo:true, multiple:true },
  { key:'notas',             label:'Notas',             type:'textarea', wide:true },
]

const SCHEMAS = { actores:S_ACTORES, emplaz:S_EMPLAZ, noemplaz:S_NOEMPLAZ, sentencias:S_SENTENCIAS,
  requerims:S_REQUERIMS, cumplims:S_CUMPLIMS, incidentes:S_INCIDENTES, amparos:S_AMPAROS,
  conciliacion:S_CONCILIACION, oic:S_OIC, reencauz:S_REENCAUZ }

/* ─── SVG ICONS ─────────────────────────────────────────────────────────── */
const ICONS = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  actores: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  emplaz: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  ),
  noemplaz: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <line x1="10" y1="12" x2="14" y2="16"/><line x1="14" y1="12" x2="10" y2="16"/>
    </svg>
  ),
  sentencias: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18"/><path d="M5.5 8l6.5-5 6.5 5"/>
      <path d="M3 11l2.5 6h-5L3 11z"/><path d="M21 11l-2.5 6h5L21 11z"/>
      <line x1="3" y1="20" x2="21" y2="20"/>
    </svg>
  ),
  requerims: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
    </svg>
  ),
  cumplims: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  incidentes: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  amparos: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  conciliacion: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  oic: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  reencauz: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
    </svg>
  ),
}

/* ─── NAV CONFIG ────────────────────────────────────────────────────────── */
const NAV = [
  { key:'actores',     label:'Actores'           },
  { key:'emplaz',      label:'Emplazamientos'    },
  { key:'noemplaz',    label:'No Emplazamientos' },
  { key:'sentencias',  label:'Sentencias'        },
  { key:'requerims',   label:'Requerimientos'    },
  { key:'cumplims',    label:'Cumplimientos'     },
  { key:'incidentes',  label:'Incidentes'        },
  { key:'amparos',     label:'Amparos'           },
  { key:'conciliacion',label:'Conciliación'      },
  { key:'oic',         label:'OIC'               },
  { key:'reencauz',    label:'Reencauzamiento'   },
]

const SECTION_TITLES = {
  actores:'Actores', emplaz:'Emplazamientos', noemplaz:'No-Emplazamientos',
  sentencias:'Sentencias', requerims:'Requerimientos', cumplims:'Cumplimientos',
  incidentes:'Incidentes', amparos:'Amparos', conciliacion:'Conciliación',
  oic:'OIC', reencauz:'Reencauzamiento',
}

/* ─── MAIN VIEW ─────────────────────────────────────────────────────────── */
export default function DALView({ user, onDashboard }) {
  // Se abre en la primera sección; el dashboard de la subdirección se abre desde la franja
  // de alertas (tablero/DashboardSubdireccion.jsx).
  const [active, setActive] = useState('actores')
  const [store, setStore] = useState(() =>
    Object.fromEntries(SECTIONS.map(s => [s, []]))
  )
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState('')

  // Catálogo de abogados de Litigio: solo los activos se ofrecen para asignar
  const [catalogo, setCatalogo] = useState([])
  const [verAbogados, setVerAbogados] = useState(false)
  const cargarCatalogo = useCallback(() => getAbogados('litigio').then(setCatalogo).catch(() => {}), [])
  useEffect(() => { cargarCatalogo() }, [cargarCatalogo])
  const abogados = useMemo(() => catalogo.filter(a => a.activo).map(a => a.nombre), [catalogo])

  const loadAll = useCallback(async () => {
    setLoading(true); setLoadError('')
    try {
      const results = await Promise.all(SECTIONS.map(s => getDalSection(s)))
      setStore(Object.fromEntries(SECTIONS.map((s, i) => [s, results[i]])))
    } catch {
      setLoadError('Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])
  const cambioCatalogo = () => { cargarCatalogo(); loadAll() }

  const handleUpdate = useCallback((section, records) => {
    setStore(s => ({ ...s, [section]: records }))
  }, [])

  // Registros unidos por expediente; se recalcula con cada captura
  const relaciones = useMemo(() => loading ? null : {
    actualizar: (section, guardado) => setStore(st => ({ ...st, [section]: st[section].map(r => r.id === guardado.id ? guardado : r) })),
    idx: indiceExpedientes(store),
    expedientes: [...new Set(SECTIONS.flatMap(s => (store[s] || []).map(r => (r.expediente || '').trim()).filter(Boolean)))].sort(),
  }, [store, loading])

  // Se recalcula con cada captura, así que la franja refleja lo recién registrado
  const alertas = useMemo(() => loading ? null : contarAlertas(asuntosLitigio(store)), [store, loading, loadError])

  return (
    <AbogadosCtx.Provider value={{ abogados }}>
    <RelacionesCtx.Provider value={relaciones}>
    <div style={{ display:'flex',flexDirection:'column',gap:12,height:'100%' }}>
    {!loadError && (
      <FranjaAlertas vencidos={alertas ? alertas.vencidos : null} porVencer={alertas?.porVencer}
        umbral={UMBRAL_DIAS} onAbrir={onDashboard} />
    )}
    <div style={{ display:'flex',flexDirection:'column',overflow:'hidden',
      flex:1,minHeight:420,borderRadius:10,border:'1px solid #E3DFDA',
      boxShadow:'0 2px 8px rgba(0,0,0,.07)' }}>

      {/* Top tab bar */}
      {<nav style={{ background:'#fff',flexShrink:0,display:'flex',alignItems:'center',
        gap:2,padding:'6px 12px',borderBottom:'1px solid #E3DFDA',overflowX:'auto',
        scrollbarWidth:'none' }}>

        {NAV.map(n => {
          const isActive = active === n.key
          return (
            <button key={n.key} onClick={() => setActive(n.key)} title={n.label}
              aria-label={n.label} aria-current={isActive ? 'page' : undefined}
              style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                padding:'7px 10px',borderRadius:6,border:'none',cursor:'pointer',
                flexShrink:0,fontSize:12,fontWeight:isActive ? 700 : 500,whiteSpace:'nowrap',
                color: isActive ? '#fff' : '#828A91',
                background: isActive ? '#454247' : 'transparent',
                transition:'all .15s' }}>
              <span style={{ display:'flex',alignItems:'center',width:18,height:18,color:'inherit' }}>
                {ICONS[n.key]}
              </span>
              {/* La pestaña activa siempre muestra su nombre; las demás, en pantallas anchas. */}
              <span className={isActive ? '' : 'hidden xl:inline'}>{n.label}</span>
            </button>
          )
        })}
        <button type="button" onClick={() => setVerAbogados(v => !v)} className="btn-outline"
          style={{ marginLeft:'auto',flexShrink:0,fontSize:12,padding:'6px 12px' }}>Abogados</button>

      </nav>}

      {/* Content */}
      <div style={{ flex:1,overflowY:'auto',padding:'24px 28px',background:'#F7F5F3' }}>
        {verAbogados && (
          <div style={{ marginBottom:20 }}>
            <Abogados subdireccion="litigio" abogados={catalogo} puedeEditar={user?.role === 'admin'}
              onCambio={cambioCatalogo} onCerrar={() => setVerAbogados(false)} />
          </div>
        )}
        {loading ? (
          <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:200 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ width:36,height:36,border:'4px solid #E3DFDA',
                borderTopColor:'#454247',borderRadius:'50%',
                animation:'spin 0.8s linear infinite',margin:'0 auto 12px' }} />
              <p style={{ fontSize:13,color:'#828A91' }}>Cargando datos…</p>
            </div>
          </div>
        ) : loadError ? (
          <div className="ine-card" style={{ padding:24,textAlign:'center',color:'#DC2626' }}>
            {loadError}
          </div>
        ) : (
          <SectionView
            key={active}
            title={SECTION_TITLES[active]}
            section={active}
            schemas={SCHEMAS[active]}
            records={store[active] || []}
            onUpdate={(records) => handleUpdate(active, records)}
            user={user}
          />
        )}
      </div>
    </div>
    </div>
    </RelacionesCtx.Provider>
    </AbogadosCtx.Provider>
  )
}
