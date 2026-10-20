import { getDalSection, getExpedientesRc, getInhabiles } from '../../api.js'
import { contar, diasPara } from './Tablero.jsx'
import { ETAPAS, calcularPlazos, etapaActual, expedienteClave } from '../../recursos/plazos.js'
import { DETERMINACIONES } from '../../recursos/campos.js'

// Cálculos de los dashboards de Asuntos Laborales. Los usan el dashboard de la dirección,
// el de cada subdirección y la franja de alertas de cada vista de captura, para que las
// cifras sean las mismas en todos lados.
export const UMBRAL_DIAS = 7          // "por vencer": plazos que vencen en esta cantidad de días o menos
export const HORIZONTE_DIAS = 30      // las tablas de plazos muestran hasta este plazo (y todos los vencidos)
export const SECCIONES = ['actores', 'emplaz', 'noemplaz', 'sentencias', 'requerims', 'cumplims', 'incidentes', 'amparos', 'conciliacion', 'oic', 'reencauz']

// Litigio: plazos que cuentan como pendientes mientras no se registre su entrega/cumplimiento
const PLAZOS_LITIGIO = [
  { seccion: 'sentencias', tipo: 'Sentencia',     pendiente: r => !r.fechaEntregaTEPJF },
  { seccion: 'requerims',  tipo: 'Requerimiento', pendiente: r => !r.fechaEntregaTEPJF },
  { seccion: 'incidentes', tipo: 'Incidente',     pendiente: () => true },
  { seccion: 'amparos',    tipo: 'Amparo',        pendiente: r => !r.fechaCumplimiento },
]

export async function cargarLitigio() {
  const secciones = await Promise.all(SECCIONES.map(s => getDalSection(s)))
  return Object.fromEntries(SECCIONES.map((s, i) => [s, secciones[i]]))
}

export async function cargarRecursos() {
  const [expedientes, inhabiles] = await Promise.all([getExpedientesRc(), getInhabiles()])
  return { expedientes, inhabiles: new Set(inhabiles.map(d => d.fecha)) }
}

// Solo los plazos pendientes de Litigio (para la franja de alertas, sin el resto del cálculo)
export function plazosLitigio(d) {
  return PLAZOS_LITIGIO.flatMap(p => (d[p.seccion] || [])
    .filter(r => p.pendiente(r))
    .map(r => ({ id: `${p.seccion}-${r.id}`, expediente: r.expediente, tipo: p.tipo, abogado: r.abogado, dias: diasPara(r.fechaVencimiento) }))
    .filter(r => r.dias !== null))
}

export const alertasLitigio = (d) => {
  const plazos = plazosLitigio(d)
  return {
    vencidos: plazos.filter(r => r.dias < 0).length,
    porVencer: plazos.filter(r => r.dias >= 0 && r.dias <= UMBRAL_DIAS).length,
  }
}

export function calcularLitigio(d) {
  const plazos = plazosLitigio(d)

  // Actores por año; si hay muchos años, los más antiguos se agrupan en "Anteriores"
  let porAno = contar(d.actores, r => r.ano).sort((a, b) => a.nombre.localeCompare(b.nombre))
  if (porAno.length > 7) {
    const viejos = porAno.slice(0, porAno.length - 6)
    porAno = [{ nombre: 'Anteriores', valor: viejos.reduce((s, x) => s + x.valor, 0) }, ...porAno.slice(-6)]
  }
  const concluidos = d.cumplims.filter(r => r.estatus === 'FORMALMENTE CONCLUIDO').length

  return {
    ...alertasLitigio(d),
    tablaPlazos: plazos.filter(r => r.dias <= HORIZONTE_DIAS).sort((a, b) => a.dias - b.dias),
    porAno,
    cumplimientos: contar(d.cumplims, r => r.estatus && r.estatus.charAt(0) + r.estatus.slice(1).toLowerCase(), { sinValor: 'Sin estatus' }),
    totalCumplims: d.cumplims.length,
    carga: contar([...d.sentencias, ...d.requerims, ...d.incidentes, ...d.amparos, ...d.emplaz, ...d.conciliacion], r => r.abogado, { tope: 8 }),
    cifras: [
      { label: 'Actores / expedientes', valor: d.actores.length },
      { label: 'Emplazamientos', valor: d.emplaz.length },
      { label: 'Sentencias', valor: d.sentencias.length, nota: `${d.sentencias.filter(r => !r.fechaEntregaTEPJF).length} sin entrega` },
      { label: 'Requerimientos', valor: d.requerims.length, nota: `${d.requerims.filter(r => !r.fechaEntregaTEPJF).length} sin entrega` },
      { label: 'Cumplimientos', valor: d.cumplims.length, nota: `${concluidos} concluidos` },
      { label: 'Incidentes', valor: d.incidentes.length },
      { label: 'Amparos', valor: d.amparos.length, nota: `${d.amparos.filter(r => !r.fechaCumplimiento).length} sin cumplimiento` },
      { label: 'Conciliación', valor: d.conciliacion.length },
    ],
  }
}

export function calcularRecursos(expedientes, inhabiles) {
  const filas = expedientes.map(x => ({ ...x, etapa: etapaActual(x), plazos: calcularPlazos(x, inhabiles) }))
  const enTramite = filas.filter(x => !x.etapa.concluido)
  // Solo los plazos que le tocan a la DEAJ y no se han cumplido
  const pendientes = filas.flatMap(x => x.plazos
    .filter(p => p.quien === 'deaj' && ['vencido', 'por_vencer', 'pendiente'].includes(p.estado))
    .map(p => ({ ...p, id: `${x.id}-${p.clave}`, expediente: expedienteClave(x), abogado: x.abogado })))
  const etiquetaDet = Object.fromEntries(DETERMINACIONES.map(d => [d.valor, d.label]))

  return {
    vencidos: pendientes.filter(p => p.estado === 'vencido').length,
    porVencer: pendientes.filter(p => p.estado === 'por_vencer').length,
    tablaPlazos: pendientes.filter(p => p.dias <= HORIZONTE_DIAS).sort((a, b) => a.dias - b.dias),
    porEtapa: ETAPAS.map(et => ({ nombre: et.label, valor: enTramite.filter(x => x.etapa.clave === et.clave).length })).filter(x => x.valor),
    determinaciones: contar(filas, x => etiquetaDet[x.determinacion], { sinValor: 'Sin determinar' }),
    carga: contar(enTramite, x => x.abogado, { tope: 8, sinValor: 'Sin abogado' }),
    total: filas.length,
    enTramite: enTramite.length,
    cifras: [
      { label: 'Expedientes', valor: filas.length },
      { label: 'En trámite', valor: enTramite.length },
      { label: 'Concluidos', valor: filas.length - enTramite.length },
      { label: 'Con plazo vencido', valor: new Set(pendientes.filter(p => p.estado === 'vencido').map(p => p.expediente)).size },
    ],
  }
}
