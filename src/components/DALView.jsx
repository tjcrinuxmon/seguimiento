import React, { useState, useCallback, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
         ResponsiveContainer, CartesianGrid } from 'recharts'
import { getDalSection, createDalRecord, updateDalRecord, deleteDalRecord } from '../api.js'

/* ─── CONSTANTS ─────────────────────────────────────────────────────────── */
const BASE_ABOGADOS = ['','JC','Luis Carlos','Eduardo','Edgar','Jessica','Guadalupe',
  'Alejandra','Anay','Laura','Luisa','Christian','Aníbal','Absalón','Jorge','Zeferino']
const ANOS = ['','2022','2023','2024','2025','2026']

const AbogadosCtx = React.createContext(null)
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

function FieldInput({ schema, value, onChange }) {
  const { label, type, options, required, rows } = schema
  const abogadosCtx = React.useContext(AbogadosCtx)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const labelEl = (
    <label style={{ fontSize: 12, fontWeight: 700, color: '#454247', display: 'block', marginBottom: 5 }}>
      {label}{required && <span style={{ color: '#B91C1C', marginLeft: 2 }}>*</span>}
    </label>
  )

  const handleAdd = () => {
    const name = newName.trim()
    if (!name) return
    if (abogadosCtx.abogados.some(a => a.toLowerCase() === name.toLowerCase())) {
      alert(`"${name}" ya está en la lista`)
      return
    }
    abogadosCtx.addAbogado(name)
    onChange(name)
    setAdding(false)
    setNewName('')
  }

  if (type === 'checkbox') return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', paddingTop: 22 }}>
      <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)}
        style={{ width: 16, height: 16, accentColor: '#454247' }} />
      <span style={{ fontSize: 13 }}>{label}</span>
    </label>
  )
  if (type === 'select') {
    const opts = (schema.allowAdd && abogadosCtx) ? abogadosCtx.abogados : (options || [])
    if (adding) return (
      <div>
        {labelEl}
        <div style={{ display:'flex', gap:6 }}>
          <input className="ine-input" style={{ flex:1 }} value={newName} autoFocus
            placeholder="Nombre del abogado"
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
              if (e.key === 'Escape') { setAdding(false); setNewName('') }
            }} />
          <button className="btn-ine" style={{ padding:'7px 12px', fontSize:12, whiteSpace:'nowrap' }}
            onClick={handleAdd}>Agregar</button>
          <button className="btn-outline" style={{ padding:'7px 10px', fontSize:13 }}
            onClick={() => { setAdding(false); setNewName('') }}>✕</button>
        </div>
      </div>
    )
    return (
      <div>
        {labelEl}
        <select className="ine-input" value={value ?? ''} onChange={e => {
          if (e.target.value === '__add__') { setAdding(true); return }
          onChange(e.target.value)
        }}>
          {opts.map(o => <option key={o} value={o}>{o || '— Seleccionar —'}</option>)}
          {schema.allowAdd && <option value="__add__">+ Agregar abogado…</option>}
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
  return (
    <div>
      {labelEl}
      <input type={type||'text'} className="ine-input" value={value??''} onChange={e => onChange(e.target.value)} />
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
    schemas.forEach(s => { d[s.key] = initial?.[s.key] ?? (s.type === 'checkbox' ? false : '') })
    return d
  })
  const set = (key, val) => setForm(f => {
    const n = { ...f, [key]: val }
    if ((key === 'plazo' || key === 'fechaNotificacion') && n.plazo && n.fechaNotificacion)
      n.fechaVencimiento = addDays(n.fechaNotificacion, n.plazo)
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
            <FieldInput schema={s} value={form[s.key]} onChange={v => set(s.key, v)} />
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

function DataTable({ schemas, rows, onEdit, onDelete, canEdit, canDelete }) {
  const cols = schemas.filter(s => !s.formOnly)
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
            <tr key={row.id||i} style={{ borderBottom:'1px solid #EDEAE6' }}
              onMouseEnter={e => e.currentTarget.style.background='#F7F5F3'}
              onMouseLeave={e => e.currentTarget.style.background=''}>
              {cols.map(c => (
                <td key={c.key} style={{ padding:'10px 12px',whiteSpace:'nowrap',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis' }}>
                  {c.entregaBadge
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
              <td style={{ padding:'10px 12px' }}>
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

function SectionView({ title, section, schemas, records, onUpdate, user }) {
  const [showForm,   setShowForm]   = useState(false)
  const [editing,    setEditing]    = useState(null)
  const [deleting,   setDeleting]   = useState(null)
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
    return result.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)))
  }, [records, search, anoFilter, hasAnoField])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages - 1)
  const paginated  = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  const handleSearch = (val) => { setSearch(val); setPage(0) }

  const exportExcel = () => {
    const cols = schemas.filter(s => !s.formOnly)
    const data = filtered.map(row => {
      const obj = {}
      cols.forEach(c => { obj[c.label] = row[c.key] ?? '' })
      return obj
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31))
    XLSX.writeFile(wb, `${section}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const handleSave = async (form) => {
    setSaving(true)
    try {
      if (editing) {
        const saved = await updateDalRecord(section, editing.id, form)
        onUpdate(records.map(r => r.id === editing.id ? saved : r))
      } else {
        const created = await createDalRecord(section, form)
        onUpdate([...records, created])
      }
      setShowForm(false); setEditing(null)
    } catch { alert('Error al guardar el registro') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try {
      await deleteDalRecord(section, deleting.id)
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
        <DataTable schemas={schemas} rows={paginated}
          onEdit={r => { setEditing(r); setShowForm(true) }}
          onDelete={r => setDeleting(r)}
          canEdit={canEdit} canDelete={canDelete} />
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
        <RecordForm
          title={editing ? `Editar — ${title}` : `Nuevo — ${title}`}
          schemas={schemas} initial={editing}
          onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null) }}
          saving={saving} />
      )}
      {deleting && <ConfirmDelete onConfirm={handleDelete} onCancel={() => setDeleting(null)} />}
    </div>
  )
}

/* ─── SECTION SCHEMAS ───────────────────────────────────────────────────── */
const S_ACTORES = [
  { key:'expediente',    label:'Expediente',    required:true },
  { key:'actor',         label:'Actor',         required:true },
  { key:'ano',           label:'Año',           type:'select', options:ANOS },
  { key:'observaciones', label:'Observaciones', type:'textarea', wide:true },
]
const S_EMPLAZ = [
  { key:'expediente',      label:'Expediente',      required:true },
  { key:'fechaEmplaz',     label:'Fecha Emplazamiento', type:'date' },
  { key:'abogado',         label:'Abogado',         type:'select', options:BASE_ABOGADOS, allowAdd:true },
  { key:'entregaFicha',    label:'Entrega Ficha',   type:'date' },
  { key:'revision',        label:'Revisión',        type:'date' },
  { key:'vencimiento',     label:'Vencimiento',     type:'date' },
  { key:'entregaTribunal', label:'Entrega Tribunal', type:'date', entregaBadge:'vencimiento' },
  { key:'medioEntrega',    label:'Medio Entrega',   type:'select',
    options:['','Física','Paquetería DHL','Auxilio Jurisdiccional'] },
  { key:'actoImpugnado',   label:'Acto Impugnado',  wide:true },
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
  { key:'abogado',           label:'Abogado',          type:'select', options:BASE_ABOGADOS, allowAdd:true },
  { key:'fechaEntregaTEPJF', label:'Entrega TEPJF',    type:'date', entregaBadge:'fechaVencimiento' },
]
const S_REQUERIMS = [
  { key:'expediente',        label:'Expediente',        required:true },
  { key:'plazo',             label:'Plazo (días)',       type:'number' },
  { key:'fechaVencimiento',  label:'Fecha Vencimiento',  type:'date' },
  { key:'fechaNotificacion', label:'Fecha Notificación', type:'date', entregaBadge:'fechaVencimiento' },
  { key:'abogado',           label:'Abogado',           type:'select', options:BASE_ABOGADOS, allowAdd:true },
  { key:'fechaEntregaTEPJF', label:'Entrega TEPJF',     type:'date' },
  { key:'observaciones',     label:'Observaciones',     type:'textarea', wide:true },
]
const S_CUMPLIMS = [
  { key:'expediente',             label:'Expediente',            required:true },
  { key:'actor',                  label:'Actor' },
  { key:'sentencia',              label:'Fecha Sentencia',       type:'date' },
  { key:'condena',                label:'Condena',               type:'textarea', wide:true },
  { key:'prestacionesPagadas',    label:'Prestaciones Pagadas',  type:'textarea', wide:true },
  { key:'prestacionesPorCumplir', label:'Prestaciones por Cumplir', type:'textarea', wide:true },
  { key:'abogado',                label:'Abogado',               type:'select', options:BASE_ABOGADOS, allowAdd:true },
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
  { key:'abogado',           label:'Abogado',           type:'select', options:BASE_ABOGADOS, allowAdd:true },
]
const S_AMPAROS = [
  { key:'expediente',        label:'Expediente',        required:true },
  { key:'actor',             label:'Actor' },
  { key:'plazo',             label:'Plazo (días)',       type:'number' },
  { key:'fechaVencimiento',  label:'Fecha Vencimiento',  type:'date' },
  { key:'fechaNotificacion', label:'Fecha Notificación', type:'date', entregaBadge:'fechaVencimiento' },
  { key:'abogado',           label:'Abogado',           type:'select', options:BASE_ABOGADOS, allowAdd:true },
  { key:'tribunal',          label:'Tribunal' },
  { key:'fechaCumplimiento', label:'Fecha Cumplimiento', type:'date' },
]
const S_CONCILIACION = [
  { key:'expediente',        label:'Expediente',        required:true },
  { key:'actor',             label:'Actor' },
  { key:'fechaNotificacion', label:'Fecha Notificación', type:'date' },
  { key:'fechaAudiencia',    label:'Fecha Audiencia',   type:'date', isVenc:true },
  { key:'ubicacion',         label:'Ubicación Audiencia' },
  { key:'abogado',           label:'Abogado',           type:'select', options:BASE_ABOGADOS, allowAdd:true },
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
  { key:'abogado',           label:'Abogado',           type:'select', options:BASE_ABOGADOS, allowAdd:true },
  { key:'notas',             label:'Notas',             type:'textarea', wide:true },
]

const SCHEMAS = { actores:S_ACTORES, emplaz:S_EMPLAZ, noemplaz:S_NOEMPLAZ, sentencias:S_SENTENCIAS,
  requerims:S_REQUERIMS, cumplims:S_CUMPLIMS, incidentes:S_INCIDENTES, amparos:S_AMPAROS,
  conciliacion:S_CONCILIACION, oic:S_OIC, reencauz:S_REENCAUZ }

/* ─── DASHBOARD ─────────────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, color }) {
  return (
    <div className="ine-card" style={{ padding:20 }}>
      <p style={{ fontSize:11,fontWeight:700,color:'#828A91',textTransform:'uppercase',
        letterSpacing:'0.06em',marginBottom:6 }}>{label}</p>
      <p style={{ fontSize:30,fontWeight:900,color,marginBottom:2 }}>{value}</p>
      {sub && <p style={{ fontSize:12,color:'#B2B2B2' }}>{sub}</p>}
    </div>
  )
}

function StatBar({ label, value, total, color }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:3 }}>
        <span style={{ fontSize:12,color:'#828A91' }}>{label}</span>
        <span style={{ fontSize:12,fontWeight:700,color }}>{value}{total !== undefined ? `/${total}` : ''}</span>
      </div>
      <div style={{ background:'#EDEAE6',borderRadius:4,height:6 }}>
        <div style={{ width:`${pct}%`,height:6,background:color,borderRadius:4,transition:'width .4s ease' }} />
      </div>
    </div>
  )
}

function Dashboard({ store }) {
  const { actores,emplaz,sentencias,requerims,cumplims,incidentes,amparos,conciliacion,oic,reencauz,noemplaz } = store
  const today = new Date(); today.setHours(0,0,0,0)
  const isUrgent  = ds => { if (!ds) return false; const d = daysUntil(ds); return d !== null && d >= 0 && d <= 7 }
  const isVencido = ds => { if (!ds) return false; return new Date(ds + 'T00:00:00') < today }

  const vencidos = [
    ...sentencias.filter(r => isVencido(r.fechaVencimiento) && !r.fechaEntregaTEPJF),
    ...requerims.filter(r  => isVencido(r.fechaVencimiento) && !r.fechaEntregaTEPJF),
    ...incidentes.filter(r => isVencido(r.fechaVencimiento)),
    ...amparos.filter(r    => isVencido(r.fechaVencimiento) && !r.fechaCumplimiento),
  ]
  const urgentes = [
    ...sentencias.filter(r => isUrgent(r.fechaVencimiento) && !r.fechaEntregaTEPJF),
    ...requerims.filter(r  => isUrgent(r.fechaVencimiento) && !r.fechaEntregaTEPJF),
    ...incidentes.filter(r => isUrgent(r.fechaVencimiento)),
    ...amparos.filter(r    => isUrgent(r.fechaVencimiento) && !r.fechaCumplimiento),
  ]

  /* ── chart data ── */
  const actoresPorAno = ANOS.filter(a => a).map(a => ({
    name: a,
    Actores: actores.filter(r => r.ano === a).length,
  }))

  const byAbogado = {}
  ;[...sentencias,...requerims,...incidentes,...amparos,...emplaz,...conciliacion].forEach(r => {
    if (r.abogado) byAbogado[r.abogado] = (byAbogado[r.abogado] || 0) + 1
  })
  const abogadoData = Object.entries(byAbogado)
    .sort((a,b) => b[1]-a[1]).slice(0,8)
    .map(([name, value]) => ({ name, value }))

  const cumplimData = [
    { name:'Presentada', value:cumplims.filter(r=>r.estatus==='PRESENTADA').length,           color:'#F59E0B' },
    { name:'Concluido',  value:cumplims.filter(r=>r.estatus==='FORMALMENTE CONCLUIDO').length, color:'#10B981' },
    { name:'Sin estatus',value:cumplims.filter(r=>!r.estatus).length,                          color:'#C4B8D0' },
  ].filter(d => d.value > 0)

  const in30 = ds => { if (!ds) return false; const d = daysUntil(ds); return d !== null && d >= 0 && d <= 30 }
  const proximos = [
    ...sentencias.filter(r => in30(r.fechaVencimiento) && !r.fechaEntregaTEPJF)
      .map(r => ({ exp:r.expediente, tipo:'Sentencia', d:daysUntil(r.fechaVencimiento) })),
    ...requerims.filter(r => in30(r.fechaVencimiento) && !r.fechaEntregaTEPJF)
      .map(r => ({ exp:r.expediente, tipo:'Requerim.', d:daysUntil(r.fechaVencimiento) })),
    ...incidentes.filter(r => in30(r.fechaVencimiento))
      .map(r => ({ exp:r.expediente, tipo:'Incidente', d:daysUntil(r.fechaVencimiento) })),
    ...amparos.filter(r => in30(r.fechaVencimiento) && !r.fechaCumplimiento)
      .map(r => ({ exp:r.expediente, tipo:'Amparo',    d:daysUntil(r.fechaVencimiento) })),
  ].sort((a,b) => a.d - b.d)

  const sentPend = sentencias.filter(r => !r.fechaEntregaTEPJF).length
  const reqPend  = requerims.filter(r => !r.fechaEntregaTEPJF).length

  const tooltipStyle = { fontSize:12,borderRadius:8,border:'1px solid #E3DFDA',boxShadow:'0 4px 12px rgba(0,0,0,.08)' }
  const axTick = { fontSize:11,fill:'#828A91' }

  return (
    <div className="fade-in" style={{ display:'flex',flexDirection:'column',gap:18 }}>

      {/* Header */}
      <div>
        <h2 style={{ fontSize:18,fontWeight:700,color:'#454247',margin:0 }}>Dashboard — Asuntos Laborales</h2>
        <p style={{ color:'#828A91',fontSize:13,marginTop:4 }}>Por ahora con datos de la Subdirección de Litigio · INE DEAJ</p>
      </div>

      {/* Alertas */}
      {vencidos.length > 0 && (
        <div className="ine-card" style={{ padding:'12px 18px',borderLeft:'4px solid #EF4444',background:'#FEF2F2' }}>
          <p style={{ fontWeight:700,color:'#B91C1C',fontSize:13,margin:0 }}>
            ⚠ {vencidos.length} plazo{vencidos.length!==1?'s':''} vencido{vencidos.length!==1?'s':''} sin entrega registrada
          </p>
          <p style={{ color:'#DC2626',fontSize:12,marginTop:2,marginBottom:0 }}>Revisar sentencias, requerimientos, incidentes y amparos.</p>
        </div>
      )}
      {urgentes.length > 0 && (
        <div className="ine-card" style={{ padding:'12px 18px',borderLeft:'4px solid #F59E0B',background:'#FFFBEB' }}>
          <p style={{ fontWeight:700,color:'#92400E',fontSize:13,margin:0 }}>
            🔔 {urgentes.length} vencimiento{urgentes.length!==1?'s':''} en los próximos 7 días
          </p>
        </div>
      )}

      {/* KPI grid */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12 }}>
        <KpiCard label="Actores / Expedientes" value={actores.length}      color="#454247" />
        <KpiCard label="Emplazamientos"         value={emplaz.length}      color="#3B82F6" />
        <KpiCard label="Sentencias"             value={sentencias.length}  color="#10B981" />
        <KpiCard label="Requerimientos"         value={requerims.length}   color="#F59E0B" />
        <KpiCard label="Cumplimientos" value={cumplims.length}
          sub={`${cumplims.filter(r=>r.estatus==='FORMALMENTE CONCLUIDO').length} concluidos`} color="#8B5CF6" />
        <KpiCard label="Incidentes"   value={incidentes.length}   color="#EF4444" />
        <KpiCard label="Amparos"      value={amparos.length}      color="#14B8A6" />
        <KpiCard label="Conciliación" value={conciliacion.length} color="#C5A989" />
      </div>

      {/* Charts row 1 */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>

        {/* Actores por año */}
        <div className="ine-card" style={{ padding:20 }}>
          <p style={{ fontWeight:700,color:'#454247',fontSize:13,marginBottom:16 }}>Actores por Año</p>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={actoresPorAno} margin={{ top:4,right:8,left:-20,bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDEAE6" vertical={false} />
              <XAxis dataKey="name" tick={axTick} axisLine={false} tickLine={false} />
              <YAxis tick={{ ...axTick,fill:'#B2B2B2' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill:'#EDEAE6' }} />
              <Bar dataKey="Actores" fill="#454247" radius={[4,4,0,0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Carga por abogado */}
        <div className="ine-card" style={{ padding:20 }}>
          <p style={{ fontWeight:700,color:'#454247',fontSize:13,marginBottom:16 }}>Carga por Abogado</p>
          {abogadoData.length === 0
            ? <p style={{ color:'#B2B2B2',fontSize:13 }}>Sin datos</p>
            : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={abogadoData} layout="vertical" margin={{ top:0,right:8,left:0,bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDEAE6" horizontal={false} />
                  <XAxis type="number" tick={{ ...axTick,fill:'#B2B2B2' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={76} tick={axTick} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill:'#EDEAE6' }} />
                  <Bar dataKey="value" name="Asuntos" fill="#3B82F6" radius={[0,4,4,0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>

      {/* Charts row 2 */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>

        {/* Cumplimientos donut */}
        <div className="ine-card" style={{ padding:20 }}>
          <p style={{ fontWeight:700,color:'#454247',fontSize:13,marginBottom:12 }}>Cumplimientos por Estatus</p>
          {cumplimData.length === 0
            ? <p style={{ color:'#B2B2B2',fontSize:13 }}>Sin datos</p>
            : (
              <div style={{ display:'flex',alignItems:'center',gap:20 }}>
                <ResponsiveContainer width={150} height={150}>
                  <PieChart>
                    <Pie data={cumplimData} dataKey="value" cx="50%" cy="50%"
                      innerRadius={42} outerRadius={66} paddingAngle={3}>
                      {cumplimData.map((e,i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex:1,display:'flex',flexDirection:'column',gap:8 }}>
                  {cumplimData.map(d => (
                    <div key={d.name} style={{ display:'flex',alignItems:'center',gap:8 }}>
                      <div style={{ width:10,height:10,borderRadius:2,background:d.color,flexShrink:0 }} />
                      <span style={{ fontSize:12,color:'#828A91',flex:1 }}>{d.name}</span>
                      <span style={{ fontSize:13,fontWeight:700,color:d.color }}>{d.value}</span>
                    </div>
                  ))}
                  <div style={{ borderTop:'1px solid #EDEAE6',paddingTop:8,
                    display:'flex',justifyContent:'space-between' }}>
                    <span style={{ fontSize:12,color:'#828A91' }}>Total</span>
                    <span style={{ fontSize:13,fontWeight:700,color:'#454247' }}>{cumplims.length}</span>
                  </div>
                </div>
              </div>
            )
          }
        </div>

        {/* Próximos vencimientos */}
        <div className="ine-card" style={{ padding:20 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:12 }}>
            <p style={{ fontWeight:700,color:'#454247',fontSize:13,margin:0 }}>Vencimientos — próximos 30 días</p>
            {proximos.length > 0 && (
              <span style={{ background:'#FEE2E2',color:'#B91C1C',fontSize:11,fontWeight:700,
                padding:'2px 7px',borderRadius:20 }}>{proximos.length}</span>
            )}
          </div>
          {proximos.length === 0
            ? <p style={{ color:'#10B981',fontSize:13,textAlign:'center',paddingTop:28 }}>✓ Sin vencimientos próximos</p>
            : (
              <div style={{ display:'flex',flexDirection:'column',gap:5,maxHeight:200,overflowY:'auto' }}>
                {proximos.map((p,i) => {
                  const hot = p.d <= 3
                  return (
                    <div key={i} style={{ display:'flex',alignItems:'center',gap:8,padding:'5px 8px',
                      borderRadius:6,background:hot?'#FEF2F2':'#F7F5F3',
                      border:`1px solid ${hot?'#FECACA':'#E3DFDA'}` }}>
                      <span style={{ fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:4,
                        background:hot?'#EF4444':'#E3DFDA',color:hot?'#fff':'#828A91',whiteSpace:'nowrap' }}>
                        {p.tipo}
                      </span>
                      <span style={{ fontSize:12,fontWeight:600,color:'#454247',flex:1,
                        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{p.exp}</span>
                      <span style={{ fontSize:11,fontWeight:700,color:hot?'#B91C1C':'#828A91',whiteSpace:'nowrap' }}>
                        {p.d === 0 ? 'Hoy' : `${p.d}d`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          }
        </div>
      </div>

      {/* Row 3 */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>

        {/* Estado de seguimiento */}
        <div className="ine-card" style={{ padding:20 }}>
          <p style={{ fontWeight:700,color:'#454247',fontSize:13,marginBottom:16 }}>Estado de Seguimiento</p>
          <StatBar label="Sentencias — pendientes TEPJF" value={sentPend}
            total={sentencias.length} color="#EF4444" />
          <StatBar label="Sentencias — entregadas" value={sentencias.length - sentPend}
            total={sentencias.length} color="#10B981" />
          <div style={{ borderTop:'1px solid #EDEAE6',margin:'12px 0' }} />
          <StatBar label="Requerimientos — pendientes" value={reqPend}
            total={requerims.length} color="#F59E0B" />
          <StatBar label="Requerimientos — entregados" value={requerims.length - reqPend}
            total={requerims.length} color="#10B981" />
          <div style={{ borderTop:'1px solid #EDEAE6',margin:'12px 0' }} />
          <StatBar label="Amparos — pendientes" value={amparos.filter(r=>!r.fechaCumplimiento).length}
            total={amparos.length} color="#14B8A6" />
        </div>

        {/* No-emplazamientos + otros */}
        <div className="ine-card" style={{ padding:20 }}>
          <p style={{ fontWeight:700,color:'#454247',fontSize:13,marginBottom:12 }}>No-Emplazamientos por Estatus</p>
          {[
            { k:'EMPLAZADO',               c:'#10B981' },
            { k:'EMPLAZAMIENTO PENDIENTE', c:'#F59E0B' },
            { k:'SE DESECHA',              c:'#EF4444' },
          ].map(({ k, c }) => (
            <StatBar key={k} label={k}
              value={noemplaz.filter(r=>r.estatus===k).length}
              total={noemplaz.length} color={c} />
          ))}
          <div style={{ borderTop:'1px solid #EDEAE6',margin:'12px 0' }} />
          <div style={{ display:'flex',gap:24 }}>
            {[
              { l:'OIC',            v:oic.length,      c:'#8B5CF6' },
              { l:'Reencauzamiento',v:reencauz.length, c:'#14B8A6' },
              { l:'No-Emplaz.',     v:noemplaz.length, c:'#EF4444' },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ textAlign:'center',flex:1 }}>
                <p style={{ fontSize:24,fontWeight:900,color:c,margin:0 }}>{v}</p>
                <p style={{ fontSize:11,color:'#828A91',marginTop:2 }}>{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}

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
  { key:'dashboard',   label:'Dashboard'         },
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
export default function DALView({ user, dashboardOnly = false }) {
  // El dashboard ahora es de la dirección (vista propia); aquí se abre directo en la primera sección.
  const [active, setActive] = useState(dashboardOnly ? 'dashboard' : 'actores')
  const [store, setStore] = useState(() =>
    Object.fromEntries(SECTIONS.map(s => [s, []]))
  )
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState('')

  const [abogados, setAbogados] = useState(() => {
    try {
      const extra = JSON.parse(localStorage.getItem('dal_abogados_extra') || '[]')
      return [...BASE_ABOGADOS, ...extra.filter(a => !BASE_ABOGADOS.includes(a))]
    } catch { return BASE_ABOGADOS }
  })

  const addAbogado = useCallback((name) => {
    setAbogados(prev => {
      const next = [...prev, name]
      try {
        const extra = next.filter(a => !BASE_ABOGADOS.includes(a))
        localStorage.setItem('dal_abogados_extra', JSON.stringify(extra))
      } catch {}
      return next
    })
  }, [])

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

  const handleUpdate = useCallback((section, records) => {
    setStore(s => ({ ...s, [section]: records }))
  }, [])

  return (
    <AbogadosCtx.Provider value={{ abogados, addAbogado }}>
    <div style={{ display:'flex',flexDirection:'column',overflow:'hidden',
      height:'calc(100vh - 120px)',borderRadius:10,border:'1px solid #E3DFDA',
      boxShadow:'0 2px 8px rgba(0,0,0,.07)' }}>

      {/* Top tab bar */}
      {!dashboardOnly && <nav style={{ background:'#fff',flexShrink:0,display:'flex',alignItems:'center',
        gap:2,padding:'0 12px',borderBottom:'1px solid #E3DFDA',overflowX:'auto',
        scrollbarWidth:'none' }}>

        {NAV.filter(n => n.key !== 'dashboard').map(n => {
          const isActive = active === n.key
          return (
            <button key={n.key} onClick={() => setActive(n.key)} title={n.label}
              style={{ display:'flex',alignItems:'center',justifyContent:'center',
                padding:'7px 10px',borderRadius:6,border:'none',cursor:'pointer',
                flexShrink:0,
                color: isActive ? '#fff' : '#828A91',
                background: isActive ? '#454247' : 'transparent',
                transition:'all .15s' }}>
              <span style={{ display:'flex',alignItems:'center',width:18,height:18,color:'inherit' }}>
                {ICONS[n.key]}
              </span>
            </button>
          )
        })}

      </nav>}

      {/* Content */}
      <div style={{ flex:1,overflowY:'auto',padding:'24px 28px',background:'#F7F5F3' }}>
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
        ) : active === 'dashboard' ? (
          <Dashboard store={store} />
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
    </AbogadosCtx.Provider>
  )
}
