// Carga 20 expedientes DE EJEMPLO en Recursos y Consultas, en distintas etapas y con
// plazos vencidos, por vencer y en tiempo, para ver cómo se ve el módulo.
// Las personas son ficticias. Cada expediente lleva `_ejemplo: true` para poder quitarlos.
//
// Uso:
//   node scripts/ejemplos-recursos.js            # crea los 20 (si no hay ejemplos ya)
//   node scripts/ejemplos-recursos.js --borrar   # quita todos los expedientes de ejemplo
//
// Solo para staging o desarrollo: NO correr en producción.
import db from '../db.js'

const borrar = process.argv.includes('--borrar')
const filtroEjemplo = "json_extract(data, '$._ejemplo') = 1"

if (borrar) {
  const r = db.prepare(`DELETE FROM rc_expedientes WHERE ${filtroEjemplo}`).run()
  console.log(`🗑  ${r.changes} expedientes de ejemplo eliminados.`)
  process.exit(0)
}
const ya = db.prepare(`SELECT COUNT(*) AS n FROM rc_expedientes WHERE ${filtroEjemplo}`).get().n
if (ya) { console.log(`Ya hay ${ya} expedientes de ejemplo. Usa --borrar primero si quieres recrearlos.`); process.exit(0) }

// Fechas relativas a hoy
const pad = (n) => String(n).padStart(2, '0')
const d = (dias) => { const x = new Date(); x.setDate(x.getDate() + dias); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}` }

const abogados = db.prepare("SELECT id FROM abogados WHERE subdireccion = 'recursos' AND activo = 1 ORDER BY id").all().map(a => a.id)
const abg = (i) => abogados[i % abogados.length] || null

const DENUNCIANTES = [
  ['Laura Méndez Ortiz', 'Jefa de Departamento', 'Junta Local Ejecutiva en Puebla'],
  ['Carlos Ruiz Aguilar', 'Vocal Secretario', 'Junta Distrital 05 en Jalisco'],
  ['Mariana Soto Fuentes', 'Técnica Electoral', 'Junta Local Ejecutiva en Oaxaca'],
  ['Jorge Beltrán Ríos', 'Subdirector de Área', 'Dirección Ejecutiva de Administración'],
  ['Ana Lucía Pérez Vega', 'Analista', 'Unidad Técnica de Fiscalización'],
]
const DENUNCIADOS = [
  ['Roberto Salinas Mora', 'Vocal Ejecutivo', 'Junta Distrital 03 en Veracruz'],
  ['Patricia Gómez León', 'Jefa de Oficina', 'Junta Local Ejecutiva en Chiapas'],
  ['Héctor Núñez Cabrera', 'Coordinador Operativo', 'Junta Distrital 12 en Ciudad de México'],
  ['Silvia Ramos Castañeda', 'Subdirectora', 'Dirección Ejecutiva del Registro Federal de Electores'],
  ['Fernando Ibarra Lozano', 'Supervisor', 'Junta Local Ejecutiva en Guerrero'],
  ['Gabriela Ortega Sánchez', 'Enlace Administrativo', 'Junta Distrital 08 en Estado de México'],
]
const CONDUCTAS = [
  'Presunto hostigamiento laboral hacia personal a su cargo.',
  'Probable acoso sexual en el centro de trabajo.',
  'Presunto incumplimiento reiterado de funciones y horarios.',
  'Probable trato discriminatorio y lenguaje ofensivo en reuniones de trabajo.',
  'Presunto uso indebido de recursos materiales de la Junta.',
]
const oficio = (n) => `INE/DEAJ/DAL/${1000 + n}/2026`

// Etapas: cada perfil completa el expediente hasta cierto punto, con fechas relativas a hoy.
function perfil(i) {
  const [dn, dc, da] = DENUNCIANTES[i % DENUNCIANTES.length]
  const [pn, pc, pa] = DENUNCIADOS[i % DENUNCIADOS.length]
  const base = {
    _ejemplo: true, abogado_id: abg(i),
    denunciante_nombre: dn, denunciante_cargo: dc, denunciante_adscripcion: da,
    denunciado_nombre: pn, denunciado_cargo: pc, denunciado_adscripcion: pa,
    conducta: CONDUCTAS[i % CONDUCTAS.length],
    protocolo: i % 3 === 1 ? 'Protocolo para prevenir, atender y sancionar el hostigamiento y acoso sexual' : '',
    medidas_cautelares: i % 4 === 1 ? 'Cambio temporal de adscripción de la persona denunciada.' : '',
  }
  const recepcion = (dias) => ({ fecha_recepcion_deaj: d(dias), fecha_recepcion_dal: d(dias + 2), fecha_acuerdo_radicacion: d(dias + 7), oficio_notificacion_radicacion: oficio(i * 10 + 1) })
  const investigacion = (dias) => ({
    fecha_acuerdo_investigacion: d(dias + 15),
    requerimientos: [
      { oficio: oficio(i * 10 + 2), destinatario: 'Dirección Ejecutiva de Administración', sintesis: 'Se solicita expediente laboral de la persona denunciada.', fecha_envio: d(dias + 18), fecha_desahogo: d(dias + 30), desahogo: 'Remite expediente laboral completo.' },
      { oficio: oficio(i * 10 + 3), destinatario: pa, sintesis: 'Se solicita informe sobre los hechos denunciados.', fecha_envio: d(dias + 18), fecha_desahogo: i % 2 ? d(dias + 35) : '' },
    ],
  })
  const determinar = (dias, det, notifDias) => ({
    determinacion: det, fecha_acuerdo_determinacion: d(dias + 140),
    oficio_notificacion_determinacion: oficio(i * 10 + 4), fecha_notificacion_determinacion: d(notifDias ?? dias + 145),
  })

  switch (i) {
    // Recién recibidos
    case 0: return { ...base, ...recepcion(-6) }
    case 1: return { ...base, ...recepcion(-20) }
    case 2: return { ...base, ...recepcion(-35), fecha_acuerdo_investigacion: d(-20) }
    case 3: return { ...base, fecha_recepcion_deaj: d(-3), fecha_recepcion_dal: d(-1) }
    // Investigación preliminar
    case 4: return { ...base, ...recepcion(-90), ...investigacion(-90) }
    case 5: return { ...base, ...recepcion(-120), ...investigacion(-120) }
    case 6: return { ...base, ...recepcion(-135), ...investigacion(-135) }
    // Cerca del término, sin acuerdo (por vencer) y uno ya vencido
    case 7: return { ...base, ...recepcion(-160), ...investigacion(-160) }
    case 8: return { ...base, ...recepcion(-178), ...investigacion(-178) }
    case 9: return { ...base, ...recepcion(-195), ...investigacion(-195), determinacion: 'inicio', fecha_acuerdo_determinacion: d(-25) }
    // Concluidos sin procedimiento
    case 10: return { ...base, ...recepcion(-170), ...investigacion(-170), ...determinar(-170, 'no_inicio', -20) }
    case 11: return { ...base, ...recepcion(-150), ...investigacion(-150), ...determinar(-150, 'extincion', -4) }
    case 12: return { ...base, ...recepcion(-240), ...investigacion(-240), ...determinar(-240, 'sobreseimiento', -60) }
    // Procedimiento iniciado
    case 13: return { ...base, ...recepcion(-160), ...investigacion(-160), ...determinar(-160, 'inicio', -6) }
    // Sustanciación: contestación en curso (10 días desde la notificación del inicio)
    case 14: return { ...base, ...recepcion(-175), ...investigacion(-175), ...determinar(-175, 'inicio', -8) }
    // Contestó, se admitieron pruebas; requerimientos y desahogo de pruebas
    case 15: return { ...base, ...recepcion(-200), ...investigacion(-200), ...determinar(-200, 'inicio', -50), fecha_contestacion: d(-38),
      fecha_emision_admision: d(-26), fecha_notificacion_admision: d(-24),
      requerimientos_sustanciacion: [{ oficio: oficio(i * 10 + 5), fecha_envio: d(-20), fecha_desahogo: d(-12) }, { oficio: oficio(i * 10 + 6), fecha_envio: d(-15) }],
      desahogos_pruebas: [{ prueba: 'Testimonial: declaración de dos compañeros de trabajo.', fecha: d(-10) }, { prueba: 'Documental: correos electrónicos ofrecidos por la denunciante.', fecha: d(-12) }] }
    // Alegatos en curso (5 días desde la notificación del acuerdo)
    case 16: return { ...base, ...recepcion(-220), ...investigacion(-220), ...determinar(-220, 'inicio', -70), fecha_contestacion: d(-58),
      fecha_emision_admision: d(-46), fecha_notificacion_admision: d(-44), fecha_acuerdo_alegatos: d(-5), fecha_notificacion_alegatos: d(-3) }
    // Alegatos formulados; revisión exhaustiva
    case 17: return { ...base, ...recepcion(-250), ...investigacion(-250), ...determinar(-250, 'inicio', -100), fecha_contestacion: d(-88),
      fecha_emision_admision: d(-76), fecha_notificacion_admision: d(-74), fecha_acuerdo_alegatos: d(-40), fecha_notificacion_alegatos: d(-38),
      fecha_alegatos: d(-33), fecha_acuerdo_exhaustiva: d(-20), fecha_notificacion_exhaustiva: d(-18) }
    // Cierre de instrucción hace 45 días: el proyecto de resolución (25 días) ya venció
    case 18: return { ...base, ...recepcion(-280), ...investigacion(-280), ...determinar(-280, 'inicio', -130), fecha_contestacion: d(-118),
      fecha_emision_admision: d(-106), fecha_notificacion_admision: d(-104), fecha_acuerdo_alegatos: d(-70), fecha_notificacion_alegatos: d(-68),
      fecha_alegatos: d(-62), fecha_acuerdo_exhaustiva: d(-55), fecha_notificacion_exhaustiva: d(-53),
      fecha_cierre_instruccion: d(-45), fecha_notificacion_cierre: d(-43) }
    // Resuelto y notificado
    default: return { ...base, ...recepcion(-320), ...investigacion(-320), ...determinar(-320, 'inicio', -170), fecha_contestacion: d(-158),
      fecha_emision_admision: d(-141), fecha_notificacion_admision: d(-139), fecha_acuerdo_alegatos: d(-100), fecha_notificacion_alegatos: d(-98),
      fecha_alegatos: d(-92), fecha_acuerdo_exhaustiva: d(-80), fecha_notificacion_exhaustiva: d(-78),
      fecha_cierre_instruccion: d(-60), fecha_notificacion_cierre: d(-58), fecha_acuerdo_resolucion: d(-30), fecha_envio_se: d(-28),
      fecha_aprobacion_se: d(-15), fecha_notificacion_resolucion: d(-10) }
  }
}

// Numeración igual que el servidor: año activo y siguiente consecutivo
const anio = Number(db.prepare("SELECT valor FROM rc_config WHERE clave = 'anio_activo'").get()?.valor) || new Date().getFullYear()
const ins = db.prepare('INSERT INTO rc_expedientes (numero, anio, data) VALUES (?, ?, ?)')
db.transaction(() => {
  for (let i = 0; i < 20; i++) {
    const fijado = db.prepare('SELECT siguiente FROM rc_consecutivos WHERE anio = ?').get(anio)?.siguiente || 0
    const ultimo = db.prepare('SELECT COALESCE(MAX(numero), 0) AS n FROM rc_expedientes WHERE anio = ?').get(anio).n
    ins.run(Math.max(fijado, ultimo + 1), anio, JSON.stringify(perfil(i)))
  }
})()
console.log(`✅ 20 expedientes de ejemplo creados en ${anio}. Para quitarlos: node scripts/ejemplos-recursos.js --borrar`)
