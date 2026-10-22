import React from 'react'
import { COLORES } from '../semaforo.js'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// 2026-09-14 → "14 sep 2026"
export function fmtFecha(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MESES[m - 1]} ${y}`
}

const ESTILOS = {
  // Semáforo: verde (en tiempo), ámbar (por vencer), rojo (vence hoy / vencido)
  vencido:    { ...COLORES.vencido, icono: '⚠' },
  hoy:        { ...COLORES.hoy, icono: '⚠' },
  por_vencer: { ...COLORES.ambar, icono: '⏱' },
  pendiente:  { ...COLORES.verde, icono: '' },
  en_curso:   { texto: '#454247', fondo: '#EFF1F2', borde: '#DCE0E3', icono: '⏳' },
  cumplido:   { texto: '#454247', fondo: '#FFFFFF', borde: '#E3DFDA', icono: '✓' },
  concluido:  { texto: '#828A91', fondo: '#FFFFFF', borde: '#EDEAE6', icono: '✓' },
}

// Etiqueta del estado de un plazo calculado (ver plazos.js)
export function EstadoPlazo({ plazo, conFecha = false }) {
  if (!plazo) return <span className="text-xs text-ine-muted">—</span>
  const e = ESTILOS[plazo.estado] || ESTILOS.pendiente
  const d = plazo.dias
  const texto = {
    vencido:    `Vencido hace ${-d} d`,
    hoy:        'Vence hoy',
    por_vencer: d === 1 ? 'Vence mañana' : `Vence en ${d} días`,
    pendiente:  `En tiempo · ${d} días`,
    en_curso:   d === 0 ? 'Corre hasta hoy' : `Corre ${d} días más`,
    cumplido:   'Cumplido',
    concluido:  'Plazo concluido',
  }[plazo.estado]
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: e.fondo, color: e.texto, border: `1px solid ${e.borde}` }}>
      {e.icono && <span aria-hidden="true">{e.icono}</span>}
      {texto}{conFecha && <span className="font-normal">· {fmtFecha(plazo.fecha)}</span>}
    </span>
  )
}
