// Plazos del procedimiento de la Subdirección de Recursos y Consultas.
//
// Reglas (definidas con la DAL, 2026-10):
// - Término para iniciar: 6 meses desde la recepción de la denuncia en la DEAJ, el mismo
//   número de día (14 de marzo → 14 de septiembre). Si ese día no existe en el mes
//   (31 → septiembre), es el último día del mes.
// - Hitos dentro de esos 6 meses: acuerdo listo al cumplir el 5º mes (1 mes antes del
//   término); revisión terminada 15 días antes del término; notificación del acuerdo de
//   inicio/no inicio a más tardar en el término.
// - Días hábiles: lunes a viernes, menos los días inhábiles capturados.
// - Recurso de inconformidad: 10 días hábiles desde la notificación del acuerdo.
// - Acuerdo de admisión de pruebas: 8 días hábiles después de la contestación.
// - Admisión de pruebas: a más tardar 5 días hábiles después de emitir ese acuerdo.
// - Alegatos: 5 días hábiles desde el último oficio de notificación enviado.
// - Resolución: 25 días hábiles después del acuerdo de cierre de instrucción; entonces se
//   envía a la SE.
//
// Funciones puras (sin React) para poder probarlas por separado.

export const UMBRAL_DIAS = 7   // "por vencer": vence en esta cantidad de días naturales o menos

// ─── Fechas (siempre AAAA-MM-DD, en hora local) ───────────────────────────────
const pad = (n) => String(n).padStart(2, '0')
export const aISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const deISO = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const hoyISO = () => aISO(new Date())

export function sumarDias(iso, n) {
  const d = deISO(iso); if (!d) return null
  d.setDate(d.getDate() + n)
  return aISO(d)
}

// Mismo número de día n meses después; si no existe, el último día de ese mes.
export function sumarMeses(iso, n) {
  const d = deISO(iso); if (!d) return null
  const dia = d.getDate()
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const ultimo = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()
  r.setDate(Math.min(dia, ultimo))
  return aISO(r)
}

export const esHabil = (iso, inhabiles) => {
  const d = deISO(iso); if (!d) return false
  const dow = d.getDay()
  return dow !== 0 && dow !== 6 && !inhabiles.has(iso)
}

// n días hábiles después de `iso` (sin contar ese día).
export function sumarHabiles(iso, n, inhabiles) {
  let actual = iso
  if (!deISO(actual)) return null
  let cuenta = 0
  while (cuenta < n) {
    actual = sumarDias(actual, 1)
    if (esHabil(actual, inhabiles)) cuenta++
  }
  return actual
}

export function diasEntre(desdeIso, hastaIso) {
  const a = deISO(desdeIso), b = deISO(hastaIso)
  if (!a || !b) return null
  return Math.round((b - a) / 86400000)
}

// ─── Plazos de un expediente ──────────────────────────────────────────────────
// Cada plazo: { clave, etapa, label, fecha, quien: 'deaj' | 'partes', hecho, nota }
//   - 'deaj': algo que nos toca hacer; vence si pasa la fecha y no está hecho.
//   - 'partes': un plazo que corre para las partes; solo informa cuándo termina.
const ultimaFecha = (lista, campo) =>
  (lista || []).map(x => x?.[campo]).filter(f => deISO(f)).sort().pop() || null

export function calcularPlazos(e, inhabiles = new Set()) {
  const p = []
  const add = (x) => { if (x.fecha) p.push(x) }
  const notificado = !!e.fecha_notificacion_determinacion

  const termino = sumarMeses(e.fecha_recepcion_deaj, 6)
  if (termino) {
    add({ clave: 'acuerdo_listo', etapa: 'determinacion', label: 'Acuerdo de inicio / no inicio listo (5º mes)',
      fecha: sumarMeses(termino, -1), quien: 'deaj', hecho: !!e.fecha_acuerdo_determinacion || notificado })
    add({ clave: 'revision', etapa: 'determinacion', label: 'Revisión del acuerdo terminada',
      fecha: sumarDias(termino, -15), quien: 'deaj', hecho: !!e.fecha_acuerdo_determinacion || notificado })
    add({ clave: 'termino', etapa: 'determinacion', label: 'Término: notificar acuerdo de inicio / no inicio',
      fecha: termino, quien: 'deaj', hecho: notificado,
      nota: esHabil(termino, inhabiles) ? null : 'El término cae en día inhábil.' })
  }

  if (notificado) {
    add({ clave: 'recurso', etapa: 'determinacion', label: 'Plazo para interponer recurso de inconformidad',
      fecha: sumarHabiles(e.fecha_notificacion_determinacion, 10, inhabiles), quien: 'partes' })
  }

  // Solo si se determinó iniciar el procedimiento
  if (e.determinacion === 'inicio') {
    if (e.fecha_contestacion) {
      add({ clave: 'acuerdo_admision', etapa: 'pruebas', label: 'Emitir acuerdo de admisión de pruebas',
        fecha: sumarHabiles(e.fecha_contestacion, 8, inhabiles), quien: 'deaj', hecho: !!e.fecha_emision_admision })
    }
    if (e.fecha_emision_admision) {
      add({ clave: 'admision', etapa: 'pruebas', label: 'Admisión de pruebas',
        fecha: sumarHabiles(e.fecha_emision_admision, 5, inhabiles), quien: 'deaj', hecho: !!e.fecha_admision_pruebas })
    }
    const envioAlegatos = ultimaFecha(e.oficios_alegatos, 'fecha_envio')
    if (envioAlegatos) {
      add({ clave: 'alegatos', etapa: 'alegatos', label: 'Plazo para presentar alegatos',
        fecha: sumarHabiles(envioAlegatos, 5, inhabiles), quien: 'partes' })
    }
    if (e.fecha_cierre_instruccion) {
      add({ clave: 'resolucion', etapa: 'resolucion', label: 'Acuerdo de resolución y envío a la SE',
        fecha: sumarHabiles(e.fecha_cierre_instruccion, 25, inhabiles), quien: 'deaj', hecho: !!e.fecha_envio_se })
    }
  }

  const hoy = hoyISO()
  return p.map(x => {
    const dias = diasEntre(hoy, x.fecha)
    let estado
    if (x.quien === 'partes') estado = dias < 0 ? 'concluido' : 'en_curso'
    else if (x.hecho) estado = 'cumplido'
    else if (dias < 0) estado = 'vencido'
    else if (dias <= UMBRAL_DIAS) estado = 'por_vencer'
    else estado = 'pendiente'
    return { ...x, dias, estado }
  })
}

// El plazo abierto más urgente (lo que hay que vigilar primero).
export function proximoPlazo(plazos) {
  const abiertos = plazos.filter(x => ['vencido', 'por_vencer', 'pendiente', 'en_curso'].includes(x.estado))
  return abiertos.sort((a, b) => a.dias - b.dias)[0] || null
}

// ─── Etapas ───────────────────────────────────────────────────────────────────
export const ETAPAS = [
  { clave: 'recepcion',      label: 'Recepción' },
  { clave: 'radicacion',     label: 'Radicación' },
  { clave: 'investigacion',  label: 'Investigación preliminar' },
  { clave: 'determinacion',  label: 'Determinación' },
  { clave: 'pruebas',        label: 'Contestación y pruebas', soloInicio: true },
  { clave: 'alegatos',       label: 'Alegatos', soloInicio: true },
  { clave: 'exhaustiva',     label: 'Revisión exhaustiva', soloInicio: true },
  { clave: 'resolucion',     label: 'Cierre y resolución', soloInicio: true },
]

// Etapa en la que va el expediente: la más avanzada con algún dato capturado.
export function etapaActual(e) {
  const tiene = {
    recepcion:     e.fecha_recepcion_deaj || e.fecha_recepcion_dal,
    radicacion:    e.fecha_acuerdo_radicacion || e.oficio_notificacion_radicacion,
    investigacion: e.fecha_acuerdo_investigacion || e.requerimientos?.length,
    determinacion: e.determinacion || e.fecha_acuerdo_determinacion,
    pruebas:       e.fecha_contestacion || e.fecha_emision_admision,
    alegatos:      e.fecha_acuerdo_alegatos || e.oficios_alegatos?.length,
    exhaustiva:    e.fecha_acuerdo_exhaustiva || e.oficios_exhaustiva?.length,
    resolucion:    e.fecha_cierre_instruccion || e.fecha_envio_se,
  }
  let actual = ETAPAS[0]
  for (const et of ETAPAS) if (tiene[et.clave]) actual = et
  if (e.determinacion && e.determinacion !== 'inicio' && e.fecha_notificacion_determinacion) {
    const motivo = { extincion: 'extinción', sobreseimiento: 'sobreseimiento', no_inicio: 'no inicio' }[e.determinacion] || e.determinacion
    return { ...actual, label: `Concluido (${motivo})`, concluido: true }
  }
  if (e.fecha_notificacion_resolucion || e.notificaciones_resolucion?.length) {
    return { ...actual, label: 'Resuelto y notificado', concluido: true }
  }
  return actual
}

export const expedienteClave = (e) => (e?.numero && e?.anio ? `INE/DEAJ/ALI/${e.numero}/${e.anio}` : 'Expediente nuevo')
