import React, { useState, useEffect, useMemo } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import { getConvenios } from '../api.js'

const ESTATUS = [
  { value: 'revision',         label: 'Revisión',                  color: '#B45309', bg: '#FEF3C7' },
  { value: 'revision_interna', label: 'Rev. Interna Subdirección', color: '#7C3AED', bg: '#EDE9FE' },
  { value: 'validacion',       label: 'Validación',                color: '#1D4ED8', bg: '#DBEAFE' },
  { value: 'liberado',         label: 'Liberado',                  color: '#059669', bg: '#D1FAE5' },
  { value: 'no_liberado',      label: 'No Liberado',               color: '#DC2626', bg: '#FEE2E2' },
  { value: 'cancelado',        label: 'Cancelado',                 color: '#6B7280', bg: '#F3F4F6' },
]

function getVencimiento(fecha) {
  if (!fecha) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const vence = new Date(fecha + 'T00:00:00'); vence.setHours(0, 0, 0, 0)
  const diff = Math.round((vence - today) / 86400000)
  if (diff < 0)   return { diff, level: 'vencido', color: '#7F1D1D', bg: '#FEE2E2', dot: '#DC2626', label: `Vencido hace ${Math.abs(diff)}d` }
  if (diff === 0) return { diff, level: 'hoy',     color: '#991B1B', bg: '#FEE2E2', dot: '#EF4444', label: 'Vence hoy' }
  if (diff === 1) return { diff, level: 'rojo',    color: '#DC2626', bg: '#FEF2F2', dot: '#EF4444', label: 'Vence mañana' }
  if (diff <= 5)  return { diff, level: 'amarillo',color: '#92400E', bg: '#FFFBEB', dot: '#F59E0B', label: `${diff} días` }
  return             { diff, level: 'verde',     color: '#065F46', bg: '#ECFDF5', dot: '#10B981', label: `${diff} días` }
}

const FUNNEL_STAGES = [
  { label: 'Recibidos',      field: 'oficio_solicitud',             color: '#7C3AED' },
  { label: '1ª Revisión',    field: 'oficio_primera_revision',      color: '#2563EB' },
  { label: '2ª Revisión',    field: 'oficio_segunda_revision',      color: '#0891B2' },
  { label: 'Val. Jurídica',  field: 'oficio_validacion_juridica',   color: '#059669' },
  { label: 'Val. Preliminar',field: 'oficio_validacion_preliminar', color: '#D97706' },
  { label: 'Liberados',      field: null,                           color: '#16A34A' },
]

const PURPLE = '#454247'

export default function ConveniosReport() {
  const [convenios, setConvenios] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    getConvenios().then(d => { setConvenios(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const stats = useMemo(() => {
    const total    = convenios.length
    const liberados = convenios.filter(c => c.estatus === 'liberado').length
    const enProceso = convenios.filter(c => ['revision','revision_interna','validacion'].includes(c.estatus)).length
    const noLiberado = convenios.filter(c => c.estatus === 'no_liberado').length
    const cancelado  = convenios.filter(c => c.estatus === 'cancelado').length

    const vencidos   = convenios.filter(c => { const v = getVencimiento(c.fecha_vencimiento); return v && v.diff < 0 }).length
    const porVencer  = convenios.filter(c => { const v = getVencimiento(c.fecha_vencimiento); return v && v.diff >= 0 && v.diff <= 5 }).length

    // By estatus for donut
    const byEstatus = ESTATUS.map(e => ({
      name: e.label, value: convenios.filter(c => c.estatus === e.value).length,
      color: e.color, bg: e.bg,
    })).filter(e => e.value > 0)

    // By tipo
    const tipoMap = {}
    convenios.forEach(c => { if (c.tipo_convenio) tipoMap[c.tipo_convenio] = (tipoMap[c.tipo_convenio] || 0) + 1 })
    const byTipo = Object.entries(tipoMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))

    // By responsable
    const respMap = {}
    convenios.forEach(c => { if (c.responsable) respMap[c.responsable] = (respMap[c.responsable] || 0) + 1 })
    const byResponsable = Object.entries(respMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name: name.split(' ').slice(0, 2).join(' '), value }))

    // Funnel
    const funnel = FUNNEL_STAGES.map(s => ({
      ...s,
      count: s.field ? convenios.filter(c => c[s.field]).length : liberados,
    }))

    // Próximos a vencer
    const proximos = convenios
      .filter(c => c.fecha_vencimiento)
      .map(c => ({ ...c, venc: getVencimiento(c.fecha_vencimiento) }))
      .filter(c => c.venc)
      .sort((a, b) => a.venc.diff - b.venc.diff)
      .slice(0, 10)

    // Sin avance (en revisión sin 1ª revisión)
    const sinAvance = convenios
      .filter(c => (c.estatus === 'revision' || c.estatus === 'revision_interna') && !c.oficio_primera_revision)
      .slice(0, 10)

    return { total, liberados, enProceso, noLiberado, cancelado, vencidos, porVencer, byEstatus, byTipo, byResponsable, funnel, proximos, sinAvance }
  }, [convenios])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#9CA3AF' }}>Cargando reportes…</div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#000000' }}>Reportes · Convenios 2026</h1>
        <p style={{ fontSize: 13, color: '#828A91', marginTop: 2 }}>{stats.total} convenios registrados en total</p>
      </div>

      {/* ── KPI CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
        <KpiCard label="Total"        value={stats.total}     color={PURPLE}    icon="📋" />
        <KpiCard label="Liberados"    value={stats.liberados}  color="#059669"   icon="✅" />
        <KpiCard label="En proceso"   value={stats.enProceso}  color="#2563EB"   icon="🔄" />
        <KpiCard label="No liberados" value={stats.noLiberado} color="#DC2626"   icon="🚫" />
        <KpiCard label="Por vencer"   value={stats.porVencer}  color="#D97706"   icon="⚠️" sub="≤ 5 días" />
        <KpiCard label="Vencidos"     value={stats.vencidos}   color="#7F1D1D"   icon="🔴" />
      </div>

      {/* ── GRÁFICAS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1.2fr', gap: 16 }}>

        {/* Donut — por estatus */}
        <div className="ine-card" style={{ padding: '20px 16px' }}>
          <ChartTitle>Distribución por Estatus</ChartTitle>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={stats.byEstatus} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={2}>
                {stats.byEstatus.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
            {stats.byEstatus.map(e => (
              <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: e.color, flexShrink: 0 }} />
                <span style={{ flex: 1, color: '#828A91' }}>{e.name}</span>
                <span style={{ fontWeight: 700, color: '#000000' }}>{e.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Barras horizontales — por tipo */}
        <div className="ine-card" style={{ padding: '20px 16px' }}>
          <ChartTitle>Convenios por Tipo</ChartTitle>
          <ResponsiveContainer width="100%" height={stats.byTipo.length * 32 + 20} minHeight={180}>
            <BarChart data={stats.byTipo} layout="vertical" margin={{ left: 8, right: 36, top: 4, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: '#828A91' }} tickLine={false} axisLine={false} />
              <Bar dataKey="value" fill={PURPLE} radius={[0, 4, 4, 0]} maxBarSize={18}>
                <LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 700, fill: '#000000' }} />
              </Bar>
              <Tooltip cursor={{ fill: '#F7F5F3' }} contentStyle={{ fontSize: 12 }} formatter={v => [v, 'Convenios']} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Barras verticales — por responsable */}
        <div className="ine-card" style={{ padding: '20px 16px' }}>
          <ChartTitle>Carga por Responsable</ChartTitle>
          {stats.byResponsable.length === 0
            ? <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 40 }}>Sin responsables asignados</p>
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.byResponsable} margin={{ top: 16, right: 8, left: 0, bottom: 40 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#828A91' }} tickLine={false} axisLine={false} angle={-30} textAnchor="end" interval={0} />
                  <YAxis hide />
                  <Bar dataKey="value" fill="#454247" radius={[4, 4, 0, 0]} maxBarSize={32}>
                    <LabelList dataKey="value" position="top" style={{ fontSize: 11, fontWeight: 700, fill: '#000000' }} />
                  </Bar>
                  <Tooltip cursor={{ fill: '#FFF0F8' }} contentStyle={{ fontSize: 12 }} formatter={v => [v, 'Convenios']} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>

      {/* ── EMBUDO DE PROCESO ── */}
      <div className="ine-card" style={{ padding: '20px 24px' }}>
        <ChartTitle>Embudo del Proceso de Revisión</ChartTitle>
        <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 20, marginTop: -4 }}>
          Cuántos convenios han alcanzado cada etapa
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${FUNNEL_STAGES.length}, 1fr)`, gap: 0 }}>
          {stats.funnel.map((s, i) => {
            const pct = stats.total > 0 ? Math.round(s.count / stats.total * 100) : 0
            const isLast = i === stats.funnel.length - 1
            return (
              <div key={s.label} style={{ display: 'flex', alignItems: 'stretch' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  {/* Count bubble */}
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: s.color + '18', border: `2px solid ${s.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.count}</span>
                  </div>
                  {/* Bar */}
                  <div style={{ width: '80%', height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: s.color, borderRadius: 4, transition: 'width .6s ease' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#828A91', textAlign: 'center', lineHeight: 1.2 }}>{s.label}</span>
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>{pct}%</span>
                </div>
                {/* Arrow between stages */}
                {!isLast && (
                  <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 48, color: '#D1D5DB', fontSize: 18 }}>›</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── TABLAS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Próximos a vencer */}
        <div className="ine-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E3DFDA', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>⏰</span>
            <ChartTitle style={{ marginBottom: 0 }}>Próximos a Vencer</ChartTitle>
          </div>
          {stats.proximos.length === 0
            ? <p style={{ padding: 24, fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>Sin convenios con fecha de vencimiento próxima</p>
            : (
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F7F5F3' }}>
                    <th style={TH}>Tercero</th>
                    <th style={TH}>Núm.</th>
                    <th style={TH}>Vencimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.proximos.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #F0EBF8', background: i % 2 ? '#FAFAFA' : 'white' }}>
                      <td style={TD}><span style={{ fontWeight: 600, color: '#000000' }}>{c.tercero}</span></td>
                      <td style={{ ...TD, fontFamily: 'monospace', fontSize: 11 }}>{c.numero_convenio || '—'}</td>
                      <td style={TD}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: c.venc.bg, color: c.venc.color }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.venc.dot, flexShrink: 0 }} />
                          {c.venc.label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>

        {/* Sin avance */}
        <div className="ine-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E3DFDA', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🕐</span>
            <ChartTitle style={{ marginBottom: 0 }}>En Revisión sin 1ª Revisión</ChartTitle>
          </div>
          {stats.sinAvance.length === 0
            ? <p style={{ padding: 24, fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>Todos los convenios en revisión tienen 1ª revisión registrada 🎉</p>
            : (
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F7F5F3' }}>
                    <th style={TH}>Tercero</th>
                    <th style={TH}>Estatus</th>
                    <th style={TH}>Responsable</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.sinAvance.map((c, i) => {
                    const est = ESTATUS.find(o => o.value === c.estatus) || ESTATUS[0]
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid #F0EBF8', background: i % 2 ? '#FAFAFA' : 'white' }}>
                        <td style={TD}><span style={{ fontWeight: 600, color: '#000000' }}>{c.tercero}</span></td>
                        <td style={TD}>
                          <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: est.bg, color: est.color }}>{est.label}</span>
                        </td>
                        <td style={{ ...TD, color: '#828A91' }}>{c.responsable || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          }
        </div>
      </div>
    </div>
  )
}

/* ── Helpers ── */

function KpiCard({ label, value, color, icon, sub }) {
  return (
    <div className="ine-card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
      </div>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#828A91', marginTop: 8 }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{sub}</p>}
    </div>
  )
}

function ChartTitle({ children, style }) {
  return <p style={{ fontSize: 13, fontWeight: 700, color: '#000000', marginBottom: 14, ...style }}>{children}</p>
}

const TH = { padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#828A91' }
const TD = { padding: '9px 14px', verticalAlign: 'middle' }
