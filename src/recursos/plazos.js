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
// Sustanciación (solo con «Inicio del procedimiento»; DAL, 2026-10). "Desde el día siguiente"
// = n días hábiles sin contar el día del acto:
// - Contestar y ofrecer pruebas: 10 días desde la notificación del acuerdo de inicio (partes).
// - Formular alegatos: 5 días desde la notificación del acuerdo de alegatos (partes).
// - Proyecto de resolución: 25 días desde la emisión del acuerdo de cierre de instrucción.
// - Envío de la resolución a la SE: 10 días después de que vencen esos 25.
// - Notificación de la resolución: 10 días desde su firma.
// En cada uno se captura la fecha en que realmente se hizo (`cuando`).
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
// Cada plazo: { clave, etapa, label, fecha, quien: 'deaj' | 'partes', hecho, cuando, nota }
//   - cuando: fecha en que se cumplió (para saber si fue a tiempo), si está hecho.
//   - 'deaj': algo que nos toca hacer; vence si pasa la fecha y no está hecho.
//   - 'partes': un plazo que corre para las partes; solo informa cuándo termina.
export function calcularPlazos(e, inhabiles = new Set()) {
  const p = []
  const add = (x) => { if (x.fecha) p.push(x) }
  const notificado = !!e.fecha_notificacion_determinacion

  const termino = sumarMeses(e.fecha_recepcion_deaj, 6)
  if (termino) {
    add({ clave: 'acuerdo_listo', etapa: 'determinacion', label: 'Acuerdo de inicio / no inicio listo (5º mes)',
      fecha: sumarMeses(termino, -1), quien: 'deaj', hecho: !!e.fecha_acuerdo_determinacion || notificado,
      cuando: e.fecha_acuerdo_determinacion || e.fecha_notificacion_determinacion || null })
    add({ clave: 'revision', etapa: 'determinacion', label: 'Revisión del acuerdo terminada',
      fecha: sumarDias(termino, -15), quien: 'deaj', hecho: !!e.fecha_acuerdo_determinacion || notificado,
      cuando: e.fecha_acuerdo_determinacion || e.fecha_notificacion_determinacion || null })
    add({ clave: 'termino', etapa: 'determinacion', label: 'Término: notificar acuerdo de inicio / no inicio',
      fecha: termino, quien: 'deaj', hecho: notificado, cuando: e.fecha_notificacion_determinacion || null,
      nota: esHabil(termino, inhabiles) ? null : 'El término cae en día inhábil.' })
  }

  if (notificado) {
    add({ clave: 'recurso', etapa: 'determinacion', label: 'Plazo para interponer recurso de inconformidad',
      fecha: sumarHabiles(e.fecha_notificacion_determinacion, 10, inhabiles), quien: 'partes' })
  }

  // Sustanciación: solo si se determinó iniciar el procedimiento
  if (e.determinacion === 'inicio') {
    if (notificado) {
      add({ clave: 'contestacion', etapa: 'sustanciacion', label: 'Contestar y ofrecer pruebas (10 días)',
        fecha: sumarHabiles(e.fecha_notificacion_determinacion, 10, inhabiles), quien: 'partes',
        hecho: !!e.fecha_contestacion, cuando: e.fecha_contestacion || null })
    }
    if (e.fecha_notificacion_alegatos) {
      add({ clave: 'alegatos', etapa: 'sustanciacion', label: 'Formular alegatos (5 días)',
        fecha: sumarHabiles(e.fecha_notificacion_alegatos, 5, inhabiles), quien: 'partes',
        hecho: !!e.fecha_alegatos, cuando: e.fecha_alegatos || null })
    }
    if (e.fecha_cierre_instruccion) {
      const proyecto = sumarHabiles(e.fecha_cierre_instruccion, 25, inhabiles)
      add({ clave: 'proyecto', etapa: 'sustanciacion', label: 'Elaborar el proyecto de resolución (25 días)',
        fecha: proyecto, quien: 'deaj', hecho: !!e.fecha_acuerdo_resolucion, cuando: e.fecha_acuerdo_resolucion || null })
      add({ clave: 'envio_se', etapa: 'sustanciacion', label: 'Enviar la resolución a la Secretaría Ejecutiva (10 días)',
        fecha: sumarHabiles(proyecto, 10, inhabiles), quien: 'deaj', hecho: !!e.fecha_envio_se, cuando: e.fecha_envio_se || null })
    }
    if (e.fecha_aprobacion_se) {
      add({ clave: 'notificacion_resolucion', etapa: 'sustanciacion', label: 'Notificar la resolución (10 días)',
        fecha: sumarHabiles(e.fecha_aprobacion_se, 10, inhabiles), quien: 'deaj',
        hecho: !!e.fecha_notificacion_resolucion, cuando: e.fecha_notificacion_resolucion || null })
    }
  }

  const hoy = hoyISO()
  return p.map(x => {
    const dias = diasEntre(hoy, x.fecha)
    let estado
    if (x.hecho) estado = 'cumplido'
    else if (x.quien === 'partes') estado = dias < 0 ? 'concluido' : 'en_curso'
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
  { clave: 'sustanciacion',  label: 'Sustanciación', soloInicio: true },
]

// Pasos de la sustanciación, para decir en cuál va ("Sustanciación: alegatos")
const PASOS_SUSTANCIACION = [
  { label: 'contestación y pruebas', tiene: e => e.fecha_contestacion || e.fecha_emision_admision || e.fecha_notificacion_admision ||
      e.requerimientos_sustanciacion?.length || e.desahogos_pruebas?.length },
  { label: 'alegatos',               tiene: e => e.fecha_acuerdo_alegatos || e.fecha_notificacion_alegatos || e.fecha_alegatos },
  { label: 'revisión exhaustiva',    tiene: e => e.fecha_acuerdo_exhaustiva || e.fecha_notificacion_exhaustiva },
  { label: 'cierre de instrucción',  tiene: e => e.fecha_cierre_instruccion || e.fecha_notificacion_cierre },
  { label: 'resolución',             tiene: e => e.fecha_acuerdo_resolucion || e.fecha_envio_se || e.fecha_aprobacion_se },
]

// Etapa en la que va el expediente: la más avanzada con algún dato capturado.
export function etapaActual(e) {
  const tiene = {
    recepcion:     e.fecha_recepcion_deaj || e.fecha_recepcion_dal,
    radicacion:    e.fecha_acuerdo_radicacion || e.fecha_notificacion_radicacion || e.oficio_notificacion_radicacion,
    investigacion: e.fecha_acuerdo_investigacion || e.requerimientos?.length,
    determinacion: e.determinacion || e.fecha_acuerdo_determinacion,
    sustanciacion: PASOS_SUSTANCIACION.some(p => p.tiene(e)),
  }
  let actual = ETAPAS[0]
  for (const et of ETAPAS) if (tiene[et.clave]) actual = et
  if (e.determinacion && e.determinacion !== 'inicio' && e.fecha_notificacion_determinacion) {
    const motivo = { extincion: 'extinción', sobreseimiento: 'sobreseimiento', archivo: 'archivo', no_inicio: 'no inicio' }[e.determinacion] || e.determinacion
    return { ...actual, label: `Concluido (${motivo})`, concluido: true }
  }
  if (e.fecha_notificacion_resolucion || e.notificaciones_resolucion?.length) {
    return { ...actual, label: 'Resuelto y notificado', concluido: true }
  }
  if (actual.clave === 'sustanciacion') {
    const paso = [...PASOS_SUSTANCIACION].reverse().find(p => p.tiene(e))
    if (paso) return { ...actual, label: `Sustanciación: ${paso.label}` }
  }
  return actual
}

export const expedienteClave = (e) => (e?.numero && e?.anio ? `INE/DEAJ/ALI/${e.numero}/${e.anio}` : 'Expediente nuevo')
