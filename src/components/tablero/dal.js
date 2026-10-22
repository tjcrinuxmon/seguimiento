import { getDalSection, getExpedientesRc, getInhabiles, getRicSection } from '../../api.js'
import { contar, diasPara } from './Tablero.jsx'
import { ETAPAS, calcularPlazos, etapaActual, expedienteClave } from '../../recursos/plazos.js'
import { DETERMINACIONES } from '../../recursos/campos.js'
import { SECCIONES_RI } from '../../recursos/riCampos.js'
import { venceSentencia } from '../litigio/sentencias.js'

// Cálculos de los dashboards de Asuntos Laborales. Los usan el dashboard de la dirección,
// el de cada subdirección y la franja de alertas de cada vista de captura, para que las
// cifras sean las mismas en todos lados.
//
// Todo sale de una lista de "asuntos": cada cosa con fecha de vencimiento (un emplazamiento,
// una sentencia, un plazo de un expediente de Recursos…) con su estatus. De esa lista se
// arman la matriz de plazos por estatus, la carga por abogado, el detalle filtrado y las alertas.
export const UMBRAL_DIAS = 7          // "por vencer": vence en esta cantidad de días o menos
export const URGENTE_DIAS = 3         // dentro de "por vencer", lo que vence en 3 días o menos
export const SECCIONES = ['actores', 'emplaz', 'noemplaz', 'sentencias', 'requerims', 'cumplims', 'incidentes', 'amparos', 'conciliacion', 'oic', 'reencauz']

// Estatus de un asunto, en el orden de las columnas de la matriz
export const ESTATUS = [
  { clave: 'vencido',   label: 'Vencido',        grupo: 'pendiente' },
  { clave: 'urgente',   label: `Vence ≤${URGENTE_DIAS} días`, grupo: 'pendiente' },
  { clave: 'proximo',   label: `${URGENTE_DIAS + 1}–${UMBRAL_DIAS} días`, grupo: 'pendiente' },
  { clave: 'en_plazo',  label: 'En plazo',       grupo: 'pendiente' },
  { clave: 'a_tiempo',  label: 'A tiempo',       grupo: 'atendido' },
  { clave: 'fuera',     label: 'Fuera de plazo', grupo: 'atendido' },
  { clave: 'sin_fecha', label: 'Sin fecha',      grupo: 'sin_fecha' },
]
// Filtros de estatus que agrupan varios (para clics en totales y en la carga por abogado)
export const GRUPOS = {
  pendiente: { label: 'Pendientes',  estatus: ['vencido', 'urgente', 'proximo', 'en_plazo'] },
  por_vencer:{ label: `Por vencer (≤${UMBRAL_DIAS} días)`, estatus: ['urgente', 'proximo'] },
  atendido:  { label: 'Atendidos',   estatus: ['a_tiempo', 'fuera'] },
}
export const etiquetaEstatus = (f) => GRUPOS[f]?.label || ESTATUS.find(e => e.clave === f)?.label || f
export const cumpleEstatus = (a, f) => !f || a.estatus === f || !!GRUPOS[f]?.estatus.includes(a.estatus)

// "JC/Absalón" → ['JC', 'Absalón']: un asunto compartido cuenta en la carga de cada quien
export const separarAbogados = (s) => String(s || '').split('/').map(x => x.trim()).filter(Boolean)

const diasEntre = (desde, hasta) => Math.round((new Date(hasta + 'T00:00:00') - new Date(desde + 'T00:00:00')) / 86400000)

// Estatus de un asunto según su vencimiento y la fecha en que se atendió (si ya se atendió).
export function clasificar(vence, cierre, cerrado = !!cierre) {
  const dias = diasPara(vence)
  if (dias === null) return { estatus: 'sin_fecha', dias: null, retraso: null }
  if (cerrado) {
    const retraso = cierre ? diasEntre(vence, cierre) : 0
    return { estatus: retraso > 0 ? 'fuera' : 'a_tiempo', dias, retraso }
  }
  const estatus = dias < 0 ? 'vencido' : dias <= URGENTE_DIAS ? 'urgente' : dias <= UMBRAL_DIAS ? 'proximo' : 'en_plazo'
  return { estatus, dias, retraso: null }
}

// ── Litigio ─────────────────────────────────────────────────────────────────
// Qué fecha vence y con qué campos se da por atendido cada tipo (si son varios, se necesitan
// todos y cuenta el más tardío). Conciliación no entra: es una audiencia, no un plazo.
export const TIPOS_LITIGIO = [
  { clave: 'emplaz',     label: 'Emplazamientos', vence: 'vencimiento',      cierre: ['entregaTribunal'] },
  // Sentencias: el vencimiento sale de sus conceptos de condena (el más próximo sin cumplir)
  { clave: 'sentencias', label: 'Sentencias',     vence: 'fechaVencimiento', venceDe: venceSentencia, cierre: ['fechaEntregaTEPJF'] },
  { clave: 'requerims',  label: 'Requerimientos', vence: 'fechaVencimiento', cierre: ['fechaNotificacion', 'fechaEntregaTEPJF'] },
  { clave: 'incidentes', label: 'Incidentes',     vence: 'fechaVencimiento', cierre: ['fechaNotificacion'] },
  { clave: 'amparos',    label: 'Amparos',        vence: 'fechaVencimiento', cierre: ['fechaCumplimiento'] },
]

export async function cargarLitigio() {
  const secciones = await Promise.all(SECCIONES.map(s => getDalSection(s)))
  return Object.fromEntries(SECCIONES.map((s, i) => [s, secciones[i]]))
}

// Estatus de un registro de Litigio de una sección con plazo (null si la sección no tiene)
export function estatusLitigio(seccion, r) {
  const t = TIPOS_LITIGIO.find(x => x.clave === seccion)
  if (!t) return null
  const fechas = t.cierre.map(c => r[c])
  const cerrado = fechas.every(Boolean)
  const cierre = cerrado ? [...fechas].sort().pop() : null
  const vence = t.venceDe ? t.venceDe(r) : r[t.vence]
  return { vence: vence || null, cierre, ...clasificar(vence, cierre, cerrado) }
}

export function asuntosLitigio(d) {
  return TIPOS_LITIGIO.flatMap(t => (d[t.clave] || []).map(r => ({
    id: `${t.clave}-${r.id}`, tipo: t.clave, tipoLabel: t.label, expediente: r.expediente || '—',
    abogado: r.abogado || '', abogados: separarAbogados(r.abogado), ...estatusLitigio(t.clave, r),
  })))
}

// ── Recursos y Consultas ────────────────────────────────────────────────────
// Solo los plazos que le tocan a la DEAJ (los de las partes solo informan).
export const TIPOS_RECURSOS = [
  { clave: 'acuerdo_listo',           label: 'Acuerdo listo (5º mes)' },
  { clave: 'revision',                label: 'Revisión del acuerdo' },
  { clave: 'termino',                 label: 'Término: notificar acuerdo' },
  { clave: 'proyecto',                label: 'Proyecto de resolución (25 días)' },
  { clave: 'envio_se',                label: 'Envío de la resolución a la SE' },
  { clave: 'notificacion_resolucion', label: 'Notificación de la resolución' },
]
const etiquetaRc = Object.fromEntries(TIPOS_RECURSOS.map(t => [t.clave, t.label]))

export async function cargarRecursos() {
  const [expedientes, inhabiles] = await Promise.all([getExpedientesRc(), getInhabiles()])
  return { expedientes, inhabiles: new Set(inhabiles.map(d => d.fecha)) }
}

export function asuntosRecursos(expedientes, inhabiles) {
  return expedientes.flatMap(x => calcularPlazos(x, inhabiles)
    .filter(p => p.quien === 'deaj')
    .map(p => ({
      id: `${x.id}-${p.clave}`, tipo: p.clave, tipoLabel: etiquetaRc[p.clave] || p.label, expediente: expedienteClave(x),
      abogado: x.abogado || '', abogados: separarAbogados(x.abogado), vence: p.fecha, cierre: p.cuando || null, ...clasificar(p.fecha, p.cuando, p.hecho),
    })))
}

// Etapas y determinaciones de los expedientes (no tienen fecha, pero dicen cómo va cada uno)
export function expedientesRecursos(expedientes) {
  const filas = expedientes.map(x => ({ ...x, etapa: etapaActual(x) }))
  const enTramite = filas.filter(x => !x.etapa.concluido)
  const etiquetaDet = Object.fromEntries(DETERMINACIONES.map(d => [d.valor, d.label]))
  return {
    total: filas.length,
    enTramite: enTramite.length,
    porEtapa: ETAPAS.map(et => ({ nombre: et.label, valor: enTramite.filter(x => x.etapa.clave === et.clave).length })).filter(x => x.valor),
    determinaciones: contar(filas, x => etiquetaDet[x.determinacion], { sinValor: 'Sin determinar' }),
  }
}

// ── Recursos y Consultas → RI-Consultas ─────────────────────────────────────
// Catálogos con plazo. Se da por atendido con la fecha de cierre o, si no la tiene, con el
// estatus CONCLUIDO (o la resolución, en el turno RI); en ese caso cuenta como "a tiempo".
// `aplica`: si el renglón tiene ese plazo (la opinión jurídica solo si se solicitó).
export const TIPOS_RI = [
  { clave: 'ri_transparencia', label: 'Transparencia', seccion: 'transparencia', vence: 'fechaVencimiento', cierre: 'fechaAtencion' },
  { clave: 'ri_ctrl', label: 'CTRL', seccion: 'ctrl', vence: 'fechaVencimiento', cierre: 'fechaAtencion' },
  { clave: 'ri_requerimientos', label: 'Requerimientos TEPJF y OIC', seccion: 'requerimientos', vence: 'fechaVencimiento', cierre: 'fechaAtencion' },
  { clave: 'ri_instruccion', label: 'Turno RI: cerrar instrucción', seccion: 'turno_ri', vence: 'venceInstruccion', cierre: 'fechaProyecto', cerradoCon: 'fechaResolucion' },
  { clave: 'ri_jge', label: 'Turno RI: aprobación JGE', seccion: 'turno_ri', vence: 'venceAprobacionJge', cierre: 'fechaResolucion' },
  { clave: 'ri_opinion', label: 'Turno RI: opinión jurídica', seccion: 'turno_ri', vence: 'venceOpinion', cierre: 'fechaOpinion',
    aplica: r => r.solicitudOpinion || r.venceOpinion || r.fechaOpinion },
]

export async function cargarRi() {
  const listas = await Promise.all(SECCIONES_RI.map(s => getRicSection(s.key)))
  return Object.fromEntries(SECCIONES_RI.map((s, i) => [s.key, listas[i]]))
}

export function asuntosRi(store) {
  return TIPOS_RI.flatMap(t => (store[t.seccion] || []).filter(r => !t.aplica || t.aplica(r)).map(r => {
    const cierre = r[t.cierre] || null
    const cerrado = !!cierre || r.estatus === 'CONCLUIDO' || !!(t.cerradoCon && r[t.cerradoCon])
    return {
      id: `${t.clave}-${r.id}`, tipo: t.clave, tipoLabel: t.label,
      expediente: r.expediente || r.numero || r.oficioConsulta || r.idSai || '—',
      abogado: r.abogado || '', abogados: separarAbogados(r.abogado), vence: r[t.vence] || null, cierre,
      ...clasificar(r[t.vence], cierre, cerrado),
    }
  }))
}

// Consultas por catálogo: en trámite y concluidas (incluye las que no tienen plazo)
export const consultasRi = (store) => SECCIONES_RI.filter(s => s.campos.some(c => c.key === 'estatus')).map(s => {
  const l = store[s.key] || []
  return { seccion: s.key, label: s.titulo, total: l.length,
    enTramite: l.filter(r => r.estatus === 'EN TRÁMITE').length, concluidas: l.filter(r => r.estatus === 'CONCLUIDO').length }
})

// ── Resúmenes comunes ───────────────────────────────────────────────────────
export const alertas = (asuntos) => ({
  vencidos: asuntos.filter(a => a.estatus === 'vencido').length,
  porVencer: asuntos.filter(a => cumpleEstatus(a, 'por_vencer')).length,
})

// Matriz tipo × estatus: { filas: [{ tipo, label, cuenta: {estatus: n}, total }], totales: {estatus: n}, total }
export function matriz(asuntos, tipos) {
  const vacia = () => Object.fromEntries(ESTATUS.map(e => [e.clave, 0]))
  const totales = vacia()
  const filas = tipos.map(t => {
    const cuenta = vacia()
    for (const a of asuntos) if (a.tipo === t.clave) { cuenta[a.estatus]++; totales[a.estatus]++ }
    return { tipo: t.clave, label: t.label, cuenta, total: Object.values(cuenta).reduce((s, n) => s + n, 0) }
  })
  return { filas, totales, total: asuntos.length }
}

// Carga por abogado: pendientes, vencidos, por vencer, atendidos y fuera de plazo. Un asunto
// compartido ("JC/Absalón") cuenta para cada quien; los asuntos sin fecha no cuentan.
export function cargaAbogados(asuntos) {
  const m = new Map()
  for (const a of asuntos) {
    if (a.estatus === 'sin_fecha') continue
    for (const k of a.abogados.length ? a.abogados : ['']) {
      const r = m.get(k) || { abogado: k, pendiente: 0, vencido: 0, por_vencer: 0, atendido: 0, fuera: 0 }
      if (cumpleEstatus(a, 'pendiente')) r.pendiente++
      if (a.estatus === 'vencido') r.vencido++
      if (cumpleEstatus(a, 'por_vencer')) r.por_vencer++
      if (cumpleEstatus(a, 'atendido')) r.atendido++
      if (a.estatus === 'fuera') r.fuera++
      m.set(k, r)
    }
  }
  return [...m.values()].sort((a, b) => b.vencido - a.vencido || b.pendiente - a.pendiente || b.atendido - a.atendido)
}

// Asuntos que cumplen el filtro { tipo, estatus, abogado }; lo pendiente primero, del más urgente.
export function filtrar(asuntos, f = {}) {
  const orden = (a) => (cumpleEstatus(a, 'pendiente') ? 0 : 1)
  return asuntos
    .filter(a => (!f.tipo || a.tipo === f.tipo) && cumpleEstatus(a, f.estatus) && (f.abogado === undefined || (f.abogado ? a.abogados.includes(f.abogado) : !a.abogados.length)))
    .sort((a, b) => orden(a) - orden(b) || (orden(a) === 0 ? a.dias - b.dias : (b.vence || '').localeCompare(a.vence || '')))
}

// Filtro del detalle ↔ dirección: {tipo:'emplaz', estatus:'vencido'} ↔ "tipo=emplaz&estatus=vencido".
// null = detalle cerrado (sin "?"); {} = detalle abierto sin filtro ("todo=1").
export function filtroAQuery(f) {
  if (!f) return ''
  const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== undefined && v !== null)).toString()
  return q || 'todo=1'
}
export function queryAFiltro(q) {
  if (q === undefined) return null
  const f = Object.fromEntries(new URLSearchParams(q))
  delete f.todo
  return f
}
