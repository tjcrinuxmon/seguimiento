import React, { useState, useEffect, useMemo, useRef } from 'react'
import { getConvenios, createConvenio, updateConvenio, deleteConvenio, getUsers } from '../api.js'
import * as XLSX from 'xlsx'

const TIPOS = [
  'Acuerdo General de Cooperación',
  'Adenda',
  'Ampliación',
  'Anexo Técnico',
  'Convenio de Apoyo y Colaboración',
  'Convenio de Colaboración',
  'Convenio Específico',
  'Convenio Marco',
  'Convenio Marco y Específico',
  'Validación',
]

const ESTATUS = [
  { value: 'revision',         label: 'Revisión',                  color: '#B45309', bg: '#FEF3C7' },
  { value: 'revision_interna', label: 'Rev. Interna Subdirección', color: '#7C3AED', bg: '#EDE9FE' },
  { value: 'validacion',       label: 'Validación',                color: '#1D4ED8', bg: '#DBEAFE' },
  { value: 'liberado',         label: 'Liberado',                  color: '#059669', bg: '#D1FAE5' },
  { value: 'no_liberado',      label: 'No Liberado',               color: '#DC2626', bg: '#FEE2E2' },
  { value: 'cancelado',        label: 'Cancelado',                 color: '#6B7280', bg: '#F3F4F6' },
]

const EMPTY = {
  tipo_convenio: '', tercero: '', oficio_solicitud: '', fecha_oficio: '', fecha_asignacion: '',
  id_sai: '', tema: '',
  oficio_primera_revision: '', fecha_primera_revision: '', atencion_obs_ur: '', fecha_atencion_obs_ur: '',
  oficio_segunda_revision: '', fecha_segunda_revision: '', segunda_atencion_obs_ur: '',
  oficio_validacion_juridica: '', fecha_validacion_juridica: '',
  oficio_validacion_preliminar: '', fecha_validacion_preliminar: '',
  numero_convenio: '', estatus: 'revision', fecha_vencimiento: '', observaciones: '', responsable: '',
}

function getVencimiento(fecha) {
  if (!fecha) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const vence = new Date(fecha + 'T00:00:00'); vence.setHours(0, 0, 0, 0)
  const diff = Math.round((vence - today) / 86400000)
  if (diff < 0)  return { diff, label: `Vencido hace ${Math.abs(diff)} día${Math.abs(diff)!==1?'s':''}`, color: '#7F1D1D', bg: '#FEE2E2', border: '#FECACA', dot: '#DC2626', level: 'vencido' }
  if (diff === 0) return { diff, label: 'Vence hoy',                color: '#991B1B', bg: '#FEE2E2', border: '#FCA5A5', dot: '#EF4444', level: 'hoy' }
  if (diff === 1) return { diff, label: 'Vence mañana',             color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5', dot: '#EF4444', level: 'rojo' }
  if (diff <= 4)  return { diff, label: `${diff} días`,             color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B', level: 'amarillo' }
  return           { diff, label: `${diff} días`,                   color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', dot: '#10B981', level: 'verde' }
}

export default function ConveniosView({ user }) {
  const [convenios, setConvenios] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [filterEstatus, setFilterEstatus] = useState('')
  const [filterTipo, setFilterTipo]       = useState('')
  const [search, setSearch]               = useState('')
  const [deleteId, setDeleteId]           = useState(null)
  const [loadError, setLoadError]         = useState('')
  const [users, setUsers]                 = useState([])
  const [detail, setDetail]               = useState(null)

  const canEdit = user?.role === 'admin' || user?.direccion === 'contratos_convenios'

  useEffect(() => {
    load()
    getUsers().then(setUsers).catch(() => {})
  }, [])

  async function load() {
    setLoading(true)
    setLoadError('')
    try { setConvenios(await getConvenios()) }
    catch (err) { setLoadError(err.response?.data?.error || 'Error al cargar convenios') }
    finally { setLoading(false) }
  }

  function openNew()  { setEditing(null); setForm(EMPTY); setError(''); setShowForm(true) }
  function openEdit(c) {
    setEditing(c)
    setForm(Object.fromEntries(Object.keys(EMPTY).map(k => [k, c[k] ?? ''])))
    setError(''); setShowForm(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.tercero.trim()) { setError('El campo Tercero es requerido'); return }
    setSaving(true); setError('')
    try {
      editing ? await updateConvenio(editing.id, form) : await createConvenio(form)
      await load(); setShowForm(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar')
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    try { await deleteConvenio(deleteId); await load() } catch {}
    setDeleteId(null)
  }

  const SEARCH_FIELDS = ['tipo_convenio','tercero','oficio_solicitud','id_sai','tema','responsable',
    'oficio_primera_revision','atencion_obs_ur','oficio_segunda_revision','segunda_atencion_obs_ur',
    'oficio_validacion_juridica','oficio_validacion_preliminar','numero_convenio','observaciones']

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return convenios.filter(c => {
      if (filterEstatus && c.estatus !== filterEstatus) return false
      if (filterTipo    && c.tipo_convenio !== filterTipo) return false
      if (q && !SEARCH_FIELDS.some(f => (c[f] || '').toLowerCase().includes(q))) return false
      return true
    })
  }, [convenios, filterEstatus, filterTipo, search])

  const hasFilters = filterEstatus || filterTipo || search.trim()

  const PAGE_SIZE = 10
  const [page, setPage] = useState(1)
  // Reset to page 1 whenever filters change
  React.useEffect(() => { setPage(1) }, [filterEstatus, filterTipo, search])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const alerts = useMemo(() => convenios
    .filter(c => c.fecha_vencimiento)
    .map(c => ({ ...c, venc: getVencimiento(c.fecha_vencimiento) }))
    .filter(c => c.venc && c.venc.diff <= 5)
    .sort((a, b) => a.venc.diff - b.venc.diff),
    [convenios]
  )

  function exportExcel() {
    const ESTATUS_LABEL = Object.fromEntries(ESTATUS.map(o => [o.value, o.label]))
    const rows = filtered.map(c => ({
      'Núm. Convenio':              c.numero_convenio        || '',
      'Tipo de Convenio':           c.tipo_convenio          || '',
      'Tercero':                    c.tercero                || '',
      'Oficio Solicitud':           c.oficio_solicitud       || '',
      'Fecha Oficio':               c.fecha_oficio           || '',
      'Fecha Asignación':           c.fecha_asignacion       || '',
      'ID SAI':                     c.id_sai                 || '',
      'Tema':                       c.tema                   || '',
      'Of. 1ª Revisión':            c.oficio_primera_revision    || '',
      'Fecha 1ª Revisión':          c.fecha_primera_revision     || '',
      'Atención Obs. UR':           c.atencion_obs_ur            || '',
      'Fecha Atención Obs. UR':     c.fecha_atencion_obs_ur      || '',
      'Of. 2ª Revisión':            c.oficio_segunda_revision    || '',
      'Fecha 2ª Revisión':          c.fecha_segunda_revision     || '',
      '2ª Atención Obs. UR':        c.segunda_atencion_obs_ur    || '',
      'Of. Val. Jurídica':          c.oficio_validacion_juridica    || '',
      'Fecha Val. Jurídica':        c.fecha_validacion_juridica     || '',
      'Of. Val. Preliminar':        c.oficio_validacion_preliminar  || '',
      'Fecha Val. Preliminar':      c.fecha_validacion_preliminar   || '',
      'Estatus':                    ESTATUS_LABEL[c.estatus] || c.estatus || '',
      'Fecha Vencimiento':          c.fecha_vencimiento      || '',
      'Responsable':                c.responsable            || '',
      'Observaciones':              c.observaciones          || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    // Auto column width
    const colWidths = Object.keys(rows[0] || {}).map(k => ({
      wch: Math.max(k.length, ...rows.map(r => String(r[k]).length)) + 2
    }))
    ws['!cols'] = colWidths
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Convenios')
    XLSX.writeFile(wb, `Convenios_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#000000' }}>Seguimiento de Convenios 2026</h1>
          <p style={{ fontSize: 13, color: '#828A91', marginTop: 2 }}>Dirección de Contratos y Convenios</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportExcel} className="btn-outline" title="Descargar Excel con los registros actuales">
            <svg width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            Exportar Excel
          </button>
          {canEdit && (
            <button onClick={openNew} className="btn-ine">
              <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Nuevo Convenio
            </button>
          )}
        </div>
      </div>

      {/* Filter toolbar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <svg width={14} height={14} fill="none" stroke="#9CA3AF" viewBox="0 0 24 24"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar en todos los campos…"
            className="ine-input"
            style={{ paddingLeft: 30, fontSize: 13 }}
          />
        </div>

        {/* Tipo de convenio */}
        <select
          value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
          className="ine-input" style={{ flex: '0 0 auto', width: 'auto', padding: '8px 12px', fontSize: 13 }}
        >
          <option value="">Todos los tipos</option>
          {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Estatus */}
        <select
          value={filterEstatus} onChange={e => setFilterEstatus(e.target.value)}
          className="ine-input" style={{ flex: '0 0 auto', width: 'auto', padding: '8px 12px', fontSize: 13 }}
        >
          <option value="">Todos los estatus</option>
          {ESTATUS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterTipo(''); setFilterEstatus('') }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E3DFDA', background: 'white', color: '#828A91', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#DC2626'; e.currentTarget.style.color = '#DC2626' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E3DFDA'; e.currentTarget.style.color = '#828A91' }}
          >
            <svg width={13} height={13} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Alert banner */}
      {alerts.length > 0 && (
        <div style={{ borderRadius: 10, border: '1.5px solid #FCA5A5', background: '#FFF5F5', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <svg width={16} height={16} fill="none" stroke="#DC2626" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#991B1B' }}>
              {alerts.length} convenio{alerts.length !== 1 ? 's' : ''} con vencimiento próximo
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {alerts.map(c => {
              const v = c.venc
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.dot, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: '#000000' }}>{c.tercero}</span>
                  {c.numero_convenio && <span style={{ color: '#828A91' }}>({c.numero_convenio})</span>}
                  <span style={{ color: v.color, fontWeight: 600, marginLeft: 'auto', flexShrink: 0 }}>
                    {v.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Status chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {ESTATUS.map(o => {
          const cnt = convenios.filter(c => c.estatus === o.value).length
          if (!cnt) return null
          return (
            <button key={o.value} onClick={() => setFilterEstatus(f => f === o.value ? '' : o.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
                borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1.5px solid ${o.color}40`,
                background: filterEstatus === o.value ? o.color : o.bg,
                color: filterEstatus === o.value ? 'white' : o.color,
                transition: 'all .15s',
              }}
            >
              {o.label} <strong>{cnt}</strong>
            </button>
          )
        })}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9CA3AF', alignSelf: 'center' }}>
          {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="ine-card" style={{ overflow: 'hidden' }}>
        <div className="table-hscroll" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 2820, fontSize: 12, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: '#F7F5F3', borderBottom: '2px solid #E3DFDA' }}>
                {[
                  { label: 'Núm. Convenio',          w: 125 },
                  { label: 'Tipo de Convenio',      w: 160 },
                  { label: 'Tercero',                w: 180 },
                  { label: 'Oficio Solicitud',       w: 150 },
                  { label: 'Fecha Oficio',           w: 105 },
                  { label: 'Fecha Asignación',       w: 115 },
                  { label: 'ID SAI',                 w:  95 },
                  { label: 'Tema',                   w: 160 },
                  { label: 'Of. 1ª Revisión',        w: 145 },
                  { label: 'Fecha 1ª Revisión',      w: 115 },
                  { label: 'Atención Obs. UR',       w: 135 },
                  { label: 'Of. 2ª Revisión',        w: 145 },
                  { label: '2ª Atención Obs. UR',    w: 145 },
                  { label: 'Of. Val. Jurídica',      w: 145 },
                  { label: 'Fecha Val. Jurídica',    w: 115 },
                  { label: 'Of. Val. Preliminar',    w: 145 },
                  { label: 'Estatus',                w: 125 },
                  { label: 'Vencimiento',            w: 120 },
                  { label: 'Responsable',            w: 150 },
                  { label: 'Observaciones',          w: 160 },
                  ...(canEdit ? [{ label: '', w: 72 }] : []),
                ].map((h, i) => (
                  <th key={i} style={{ width: h.w, padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#828A91', whiteSpace: 'nowrap', fontSize: 11, overflow: 'hidden' }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={20} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Cargando...</td></tr>
              )}
              {!loading && loadError && (
                <tr><td colSpan={20} style={{ padding: 32, textAlign: 'center', color: '#DC2626' }}>{loadError}</td></tr>
              )}
              {!loading && !loadError && filtered.length === 0 && (
                <tr><td colSpan={20} style={{ padding: 48, textAlign: 'center', color: '#9CA3AF' }}>
                  {filterEstatus ? 'Sin registros con ese estatus' : 'Sin convenios registrados'}
                </td></tr>
              )}
              {paginated.map((c, i) => {
                const est  = ESTATUS.find(o => o.value === c.estatus) || ESTATUS[0]
                const venc = getVencimiento(c.fecha_vencimiento)
                const rowBg = venc && venc.level !== 'verde'
                  ? (venc.level === 'vencido' || venc.level === 'hoy' || venc.level === 'rojo'
                      ? (i % 2 === 0 ? '#FFF5F5' : '#FFF0F0')
                      : (i % 2 === 0 ? '#FFFDF0' : '#FFFBEB'))
                  : (i % 2 === 0 ? 'white' : '#FAFAFA')
                return (
                  <tr key={c.id}
                    onClick={() => setDetail(c)}
                    style={{ background: rowBg, borderBottom: '1px solid #F0EBF8', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.97)' }}
                    onMouseLeave={e => { e.currentTarget.style.filter = '' }}
                  >
                    <Td mono bold>{c.numero_convenio}</Td>
                    <Td>{c.tipo_convenio}</Td>
                    <Td bold>{c.tercero}</Td>
                    <Td mono>{c.oficio_solicitud}</Td>
                    <Td>{c.fecha_oficio}</Td>
                    <Td>{c.fecha_asignacion}</Td>
                    <Td mono>{c.id_sai}</Td>
                    <Td clip>{c.tema}</Td>
                    <Td mono>{c.oficio_primera_revision}</Td>
                    <Td>{c.fecha_primera_revision}</Td>
                    <Td mono>{c.atencion_obs_ur}</Td>
                    <Td mono>{c.oficio_segunda_revision}</Td>
                    <Td mono>{c.segunda_atencion_obs_ur}</Td>
                    <Td mono>{c.oficio_validacion_juridica}</Td>
                    <Td>{c.fecha_validacion_juridica}</Td>
                    <Td mono>{c.oficio_validacion_preliminar}</Td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: est.bg, color: est.color }}>
                        {est.label}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                      {venc ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                          background: venc.bg, color: venc.color, border: `1px solid ${venc.border}`,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: venc.dot, flexShrink: 0 }} />
                          {venc.label}
                        </span>
                      ) : (
                        <span style={{ color: '#D1D5DB' }}>—</span>
                      )}
                    </td>
                    <Td bold>{c.responsable}</Td>
                    <Td clip>{c.observaciones}</Td>
                    {canEdit && (
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <IconBtn onClick={() => openEdit(c)} title="Editar" hoverBg="#F3F0F8" hoverColor="#454247">
                            <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </IconBtn>
                          <IconBtn onClick={() => setDeleteId(c.id)} title="Eliminar" hoverBg="#FEF2F2" hoverColor="#DC2626">
                            <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </IconBtn>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px' }}>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>
            Página {page} de {totalPages} · {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <PagBtn onClick={() => setPage(1)}       disabled={page === 1}          title="Primera">«</PagBtn>
            <PagBtn onClick={() => setPage(p => p - 1)} disabled={page === 1}       title="Anterior">‹</PagBtn>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…')
                acc.push(p); return acc
              }, [])
              .map((p, i) => p === '…'
                ? <span key={`e${i}`} style={{ padding: '4px 2px', fontSize: 13, color: '#9CA3AF' }}>…</span>
                : <PagBtn key={p} onClick={() => setPage(p)} active={page === p}>{p}</PagBtn>
              )
            }
            <PagBtn onClick={() => setPage(p => p + 1)} disabled={page === totalPages} title="Siguiente">›</PagBtn>
            <PagBtn onClick={() => setPage(totalPages)} disabled={page === totalPages} title="Última">»</PagBtn>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="ine-card" style={{ padding: 24, width: 320 }}>
            <p style={{ fontWeight: 700, color: '#000000', marginBottom: 8 }}>¿Eliminar registro?</p>
            <p style={{ fontSize: 13, color: '#828A91', marginBottom: 20 }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteId(null)} className="btn-outline" style={{ flex: 1, padding: '10px 0' }}>Cancelar</button>
              <button onClick={handleDelete} style={{ flex: 1, padding: '10px 0', background: '#DC2626', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <ConvenioDetail
          convenio={detail}
          onClose={() => setDetail(null)}
          onEdit={canEdit ? (c) => { setDetail(null); openEdit(c) } : null}
          onDelete={canEdit ? (id) => { setDetail(null); setDeleteId(id) } : null}
        />
      )}

      {showForm && (
        <ConvenioForm
          form={form} setForm={setForm}
          onSave={handleSave} onClose={() => setShowForm(false)}
          saving={saving} error={error} isEdit={!!editing}
          users={users}
        />
      )}
    </div>
  )
}

function Td({ children, bold, mono, clip }) {
  return (
    <td style={{
      padding: '8px 12px',
      color: bold ? '#000000' : '#828A91',
      fontWeight: bold ? 600 : 400,
      fontFamily: mono ? 'monospace' : 'inherit',
      fontSize: mono ? 11 : 12,
      overflow: 'hidden',
    }}>
      {clip
        ? <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'normal' }}>{children || '—'}</div>
        : <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={typeof children === 'string' ? children : undefined}>{children || '—'}</div>
      }
    </td>
  )
}

function IconBtn({ onClick, title, hoverBg, hoverColor, children }) {
  return (
    <button onClick={onClick} title={title}
      style={{ padding: 5, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', transition: 'all .12s' }}
      onMouseEnter={e => { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = hoverColor }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9CA3AF' }}
    >
      {children}
    </button>
  )
}

function ConvenioForm({ form, setForm, onSave, onClose, saving, error, isEdit, users }) {
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '100%', maxWidth: 960, background: 'white', display: 'flex', flexDirection: 'column', boxShadow: '-6px 0 32px rgba(0,0,0,.18)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid #E3DFDA' }}>
          <h2 style={{ fontWeight: 800, fontSize: 17, color: '#000000' }}>{isEdit ? 'Editar Convenio' : 'Nuevo Convenio'}</h2>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
            <svg width={20} height={20} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
          {error && (
            <div style={{ padding: '10px 14px', background: '#FEE2E2', color: '#DC2626', borderRadius: 8, fontSize: 13, marginBottom: 20 }}>{error}</div>
          )}

          <FSec title="Identificación">
            <FRow cols={3}>
              <FField label="Tipo de Convenio" span={2}>
                <select value={form.tipo_convenio} onChange={set('tipo_convenio')} className="ine-input">
                  <option value="">— Seleccionar —</option>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </FField>
              <FField label="Estatus">
                <select value={form.estatus} onChange={set('estatus')} className="ine-input">
                  {ESTATUS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </FField>
            </FRow>
            <FRow cols={2}>
              <FField label="Responsable">
                <UserCombobox
                  value={form.responsable}
                  onChange={v => setForm(f => ({ ...f, responsable: v }))}
                  users={users}
                />
              </FField>
              <FField label="Número de Convenio">
                <input value={form.numero_convenio} onChange={set('numero_convenio')} className="ine-input" placeholder="INE/DEAJ/XX/2026" />
              </FField>
            </FRow>
            <FRow cols={1}>
              <FField label="Tercero *">
                <input value={form.tercero} onChange={set('tercero')} className="ine-input" placeholder="Nombre de la organización o institución" required />
              </FField>
            </FRow>
          </FSec>

          <FSec title="Solicitud de Revisión">
            <FRow cols={3}>
              <FField label="Oficio de Solicitud de Revisión" span={2}>
                <input value={form.oficio_solicitud} onChange={set('oficio_solicitud')} className="ine-input" placeholder="INE/DERFE/STN/XXXXX/2026" />
              </FField>
              <FField label="ID SAI">
                <input value={form.id_sai} onChange={set('id_sai')} className="ine-input" placeholder="2XXXXXXXXX" />
              </FField>
            </FRow>
            <FRow cols={3}>
              <FField label="Fecha de Oficio">
                <input type="date" value={form.fecha_oficio} onChange={set('fecha_oficio')} className="ine-input" />
              </FField>
              <FField label="Fecha de Asignación">
                <input type="date" value={form.fecha_asignacion} onChange={set('fecha_asignacion')} className="ine-input" />
              </FField>
              <FField label="Fecha de Vencimiento">
                <input type="date" value={form.fecha_vencimiento} onChange={set('fecha_vencimiento')} className="ine-input" />
              </FField>
            </FRow>
            <FField label="Tema">
              <textarea value={form.tema} onChange={set('tema')} rows={3} className="ine-input" style={{ resize: 'none' }} placeholder="Descripción del objeto del convenio..." />
            </FField>
          </FSec>

          <FSec title="Proceso de Revisión">
            <FRow cols={3}>
              <FField label="Oficio de 1ª Revisión" span={2}>
                <input value={form.oficio_primera_revision} onChange={set('oficio_primera_revision')} className="ine-input" placeholder="INE/DEAJ/XXXX/2026" />
              </FField>
              <FField label="Fecha 1ª Revisión">
                <input type="date" value={form.fecha_primera_revision} onChange={set('fecha_primera_revision')} className="ine-input" />
              </FField>
            </FRow>
            <FRow cols={3}>
              <FField label="Atención de Obs. UR" span={2}>
                <input value={form.atencion_obs_ur} onChange={set('atencion_obs_ur')} className="ine-input" placeholder="Oficio o referencia" />
              </FField>
              <FField label="Fecha Atención Obs. UR">
                <input type="date" value={form.fecha_atencion_obs_ur} onChange={set('fecha_atencion_obs_ur')} className="ine-input" />
              </FField>
            </FRow>
            <FRow cols={3}>
              <FField label="Oficio de 2ª Revisión" span={2}>
                <input value={form.oficio_segunda_revision} onChange={set('oficio_segunda_revision')} className="ine-input" placeholder="INE/DEAJ/XXXX/2026" />
              </FField>
              <FField label="Fecha 2ª Revisión">
                <input type="date" value={form.fecha_segunda_revision} onChange={set('fecha_segunda_revision')} className="ine-input" />
              </FField>
            </FRow>
            <FRow cols={1}>
              <FField label="2ª Atención de Obs. UR">
                <input value={form.segunda_atencion_obs_ur} onChange={set('segunda_atencion_obs_ur')} className="ine-input" placeholder="Oficio o referencia" />
              </FField>
            </FRow>
          </FSec>

          <FSec title="Validación">
            <FRow cols={3}>
              <FField label="Oficio de Validación Jurídica" span={2}>
                <input value={form.oficio_validacion_juridica} onChange={set('oficio_validacion_juridica')} className="ine-input" placeholder="INE/DEAJ/XXXX/2026" />
              </FField>
              <FField label="Fecha Val. Jurídica">
                <input type="date" value={form.fecha_validacion_juridica} onChange={set('fecha_validacion_juridica')} className="ine-input" />
              </FField>
            </FRow>
            <FRow cols={3}>
              <FField label="Oficio de Validación Preliminar" span={2}>
                <input value={form.oficio_validacion_preliminar} onChange={set('oficio_validacion_preliminar')} className="ine-input" placeholder="INE/DEAJ/XXXX/2026" />
              </FField>
              <FField label="Fecha Val. Preliminar">
                <input type="date" value={form.fecha_validacion_preliminar} onChange={set('fecha_validacion_preliminar')} className="ine-input" />
              </FField>
            </FRow>
          </FSec>

          <FSec title="Observaciones" last>
            <FField label="Notas y Observaciones">
              <textarea value={form.observaciones} onChange={set('observaciones')} rows={4} className="ine-input" style={{ resize: 'none' }} placeholder="Observaciones, notas de seguimiento, instrucciones especiales..." />
            </FField>
          </FSec>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '14px 28px', borderTop: '1px solid #E3DFDA' }}>
          <button type="button" onClick={onClose} className="btn-outline">Cancelar</button>
          <button onClick={onSave} disabled={saving} className="btn-ine">
            {saving ? 'Guardando...' : (isEdit ? 'Guardar Cambios' : 'Crear Convenio')}
          </button>
        </div>
      </div>
    </div>
  )
}

function FSec({ title, children, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 28 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #F0EBF8' }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  )
}

function FRow({ cols = 2, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14 }}>
      {React.Children.map(children, child =>
        child?.props?.span > 1
          ? React.cloneElement(child, { style: { gridColumn: `span ${child.props.span}` } })
          : child
      )}
    </div>
  )
}

function FField({ label, children, style }) {
  return (
    <div style={style}>
      <label className="ine-label">{label}</label>
      {children}
    </div>
  )
}

function ConvenioDetail({ convenio: c, onClose, onEdit, onDelete }) {
  const est  = ESTATUS.find(o => o.value === c.estatus) || ESTATUS[0]
  const venc = getVencimiento(c.fecha_vencimiento)

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.50)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="ine-card fade-in" style={{ width: '100%', maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 24px', borderBottom: '1px solid #E3DFDA' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {c.numero_convenio && (
                <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#454247', background: '#EFEBE7', padding: '2px 8px', borderRadius: 4 }}>
                  {c.numero_convenio}
                </span>
              )}
              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: est.bg, color: est.color }}>
                {est.label}
              </span>
              {venc && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: venc.bg, color: venc.color, border: `1px solid ${venc.border}` }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: venc.dot, flexShrink: 0 }} />
                  {venc.label}
                </span>
              )}
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#000000', marginTop: 6, lineHeight: 1.3 }}>{c.tercero || '—'}</h2>
            {c.tipo_convenio && <p style={{ fontSize: 12, color: '#828A91', marginTop: 2 }}>{c.tipo_convenio}</p>}
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', flexShrink: 0 }}>
            <svg width={20} height={20} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Solicitud */}
          <DSec title="Solicitud de Revisión">
            <DGrid>
              <DField label="Oficio de Solicitud"       value={c.oficio_solicitud}   mono />
              <DField label="ID SAI"                    value={c.id_sai}             mono />
              <DField label="Fecha de Oficio"           value={c.fecha_oficio} />
              <DField label="Fecha de Asignación"       value={c.fecha_asignacion} />
              <DField label="Fecha de Vencimiento"      value={c.fecha_vencimiento} />
              <DField label="Responsable"               value={c.responsable} />
            </DGrid>
            {c.tema && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Tema</p>
                <p style={{ fontSize: 13, color: '#000000', lineHeight: 1.6 }}>{c.tema}</p>
              </div>
            )}
          </DSec>

          {/* Proceso de revisión */}
          <DSec title="Proceso de Revisión">
            <DGrid>
              <DField label="Oficio 1ª Revisión"        value={c.oficio_primera_revision}    mono />
              <DField label="Fecha 1ª Revisión"         value={c.fecha_primera_revision} />
              <DField label="Atención Obs. UR"          value={c.atencion_obs_ur}            mono />
              <DField label="Fecha Atención Obs. UR"   value={c.fecha_atencion_obs_ur} />
              <DField label="Oficio 2ª Revisión"        value={c.oficio_segunda_revision}    mono />
              <DField label="Fecha 2ª Revisión"         value={c.fecha_segunda_revision} />
              <DField label="2ª Atención Obs. UR"       value={c.segunda_atencion_obs_ur}    mono />
            </DGrid>
          </DSec>

          {/* Validación */}
          <DSec title="Validación">
            <DGrid>
              <DField label="Of. Validación Jurídica"   value={c.oficio_validacion_juridica}   mono />
              <DField label="Fecha Val. Jurídica"       value={c.fecha_validacion_juridica} />
              <DField label="Of. Validación Preliminar" value={c.oficio_validacion_preliminar} mono />
              <DField label="Fecha Val. Preliminar"     value={c.fecha_validacion_preliminar} />
            </DGrid>
          </DSec>

          {/* Observaciones */}
          {c.observaciones && (
            <DSec title="Observaciones">
              <p style={{ fontSize: 13, color: '#000000', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{c.observaciones}</p>
            </DSec>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '14px 24px', borderTop: '1px solid #E3DFDA' }}>
          {onDelete && (
            <button
              onClick={() => onDelete(c.id)}
              style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: '1.5px solid #FECACA', background: 'white', color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'white' }}
            >
              <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Eliminar
            </button>
          )}
          <button onClick={onClose} className="btn-outline" style={{ padding: '9px 20px' }}>Cerrar</button>
          {onEdit && (
            <button onClick={() => onEdit(c)} className="btn-ine" style={{ padding: '9px 20px' }}>
              <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function DSec({ title, children }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #F0EBF8' }}>{title}</p>
      {children}
    </div>
  )
}

function DGrid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px 20px' }}>{children}</div>
}

function DField({ label, value, mono }) {
  if (!value) return null
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 13, color: '#000000', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{value}</p>
    </div>
  )
}

function UserCombobox({ value, onChange, users }) {
  const [query, setQuery]   = useState(value || '')
  const [open, setOpen]     = useState(false)
  const ref                 = useRef(null)

  // Keep local query in sync when form is reset/opened
  useEffect(() => { setQuery(value || '') }, [value])

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(u => u.name.toLowerCase().includes(q))
  }, [query, users])

  function select(name) {
    setQuery(name)
    onChange(name)
    setOpen(false)
  }

  function handleInput(e) {
    setQuery(e.target.value)
    onChange(e.target.value)
    setOpen(true)
  }

  function handleClear() {
    setQuery('')
    onChange('')
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          value={query}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          className="ine-input"
          placeholder="Buscar responsable…"
          style={{ paddingRight: query ? 28 : 10 }}
          autoComplete="off"
        />
        {query && (
          <button
            type="button" onClick={handleClear}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, lineHeight: 1 }}
          >
            <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul style={{
          position: 'absolute', zIndex: 200, top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'white', border: '1.5px solid #E3DFDA', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,.10)', maxHeight: 220, overflowY: 'auto',
          listStyle: 'none', padding: '4px 0', margin: 0,
        }}>
          {suggestions.map(u => (
            <li key={u.id}
              onMouseDown={() => select(u.name)}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: u.name === value ? '#454247' : '#000000', fontWeight: u.name === value ? 700 : 400, display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F7F5F3' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#454247', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {u.name.charAt(0).toUpperCase()}
              </span>
              <span style={{ flex: 1 }}>{u.name}</span>
              {u.name === value && (
                <svg width={14} height={14} fill="none" stroke="#454247" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PagBtn({ onClick, disabled, active, title, children }) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      style={{
        minWidth: 32, height: 32, padding: '0 8px', borderRadius: 6, border: '1.5px solid',
        fontSize: 13, fontWeight: active ? 700 : 500, cursor: disabled ? 'default' : 'pointer',
        borderColor: active ? '#454247' : '#E3DFDA',
        background: active ? '#454247' : 'white',
        color: active ? 'white' : (disabled ? '#D1D5DB' : '#828A91'),
        transition: 'all .12s',
      }}
      onMouseEnter={e => { if (!disabled && !active) { e.currentTarget.style.borderColor = '#454247'; e.currentTarget.style.color = '#454247' } }}
      onMouseLeave={e => { if (!disabled && !active) { e.currentTarget.style.borderColor = '#E3DFDA'; e.currentTarget.style.color = '#828A91' } }}
    >
      {children}
    </button>
  )
}
