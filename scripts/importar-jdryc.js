// Importa a RI-Consultas (tabla ric_registros) el Excel "JDRYC" de la Subdirección de Recursos
// y Consultas: una sección por hoja. Se corre una sola vez; después se captura en el sistema.
//
// Limpia al importar: fechas en cualquier formato → AAAA-MM-DD, oficio y fecha que venían en
// la misma celda, estatus (Concluida / CONCLUIDO → CONCLUIDO) y nombres de abogados escritos
// distinto ("Jarin" / "Jarín"). Lo que no se pudo leer NO se pierde: queda, con el texto
// original, en el campo "Notas de la importación" del registro.
//
// El Excel se abre solo para leer. Si ya hay registros de RI-Consultas, se detiene (usa
// --forzar para reemplazarlos).
//
// Uso:
//   node scripts/importar-jdryc.js "EXCEL JDRYC.xlsx" --simular   # solo muestra qué haría
//   node scripts/importar-jdryc.js "EXCEL JDRYC.xlsx" [--forzar]
import { createRequire } from 'module'
import { existsSync } from 'fs'
import { resolve } from 'path'
import * as J from './jdryc.js'
import { SECCIONES_RI } from '../src/recursos/riCampos.js'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const args = process.argv.slice(2)
const forzar = args.includes('--forzar')
const simular = args.includes('--simular')
const ruta = args.find(a => !a.startsWith('--'))
if (!ruta || !existsSync(resolve(ruta))) {
  console.error('✗ Indica la ruta del Excel: node scripts/importar-jdryc.js "EXCEL JDRYC.xlsx" [--simular] [--forzar]')
  process.exit(1)
}
const ANIO = 2026   // año que se asume cuando una fecha viene sin año ("5 demarzo")

// Hoja → sección. `fila`: índice del encabezado. Cada columna: [índice, palabra que debe
// traer su encabezado (para no importar columnas corridas), campo, tipo].
//   tipo: texto | fecha | oficioFecha:<campoOficio>,<campoFecha> | fechaNota:<campoNota>
//         | abogado | estatus | parte | serieTexto (fecha como texto, para el histórico)
const HOJAS = [
  { hoja: '1. CONSULTAS JURÍDICO-LABORAL', seccion: 'juridico', fila: 1, cols: [
    [0, 'número', 'numero'], [1, 'sai', 'idSai'], [2, 'asunto', 'asunto'], [3, 'medio', 'medio'],
    [4, 'abogado', 'abogado', 'abogado'], [5, 'oficio', 'oficioAtencion'], [6, 'fecha', 'fechaAtencion', 'fecha'],
    [7, 'estatus', 'estatus', 'estatus'], [8, 'observaciones', 'observaciones'],
  ] },
  { hoja: '2. CONSULTAS DE RESCISIONES', seccion: 'rescisiones', fila: 1, cols: [
    [1, 'número', 'numero'], [2, 'sai', 'idSai'], [3, 'asunto', 'asunto'], [4, 'recepción', 'fechaRecepcion', 'fecha'],
    [5, 'medio', 'medio'], [6, 'oficio', 'oficioRespuesta'], [7, 'desahogo', 'fechaDesahogo', 'fecha'],
    [8, 'abogado', 'abogado', 'abogado'], [9, 'estatus', 'estatus', 'estatus'],
  ] },
  { hoja: '3. CONSULTAS TRANSPARENCIA', seccion: 'transparencia', fila: 1, cols: [
    [1, 'número', 'numero'], [2, 'abogado', 'abogado', 'abogado'], [3, 'información', 'informacion'],
    [4, 'recepción', 'fechaRecepcion', 'fecha'], [5, 'vencimiento', 'fechaVencimiento', 'fecha'],
    [6, 'atención', 'fechaAtencion', 'fecha'], [7, 'oficio', 'oficioRespuesta'], [8, 'estatus', 'estatus', 'estatus'],
  ] },
  { hoja: '4. CONSULTAS CTRL', seccion: 'ctrl', fila: 1, cols: [
    [1, 'sai', 'idSai'], [2, 'oficio', 'oficioConsulta'], [3, 'personas', 'numeroPersonas'], [4, 'nombres', 'nombres'],
    [5, 'abogado', 'abogado', 'abogado'], [6, 'recepción', 'fechaRecepcion', 'fecha'],
    [7, 'vencimiento', 'fechaVencimiento', 'fecha'], [8, 'atención', null, 'oficioFecha:oficioAtencion,fechaAtencion'],
    [9, 'estatus', 'estatus', 'estatus'],
  ] },
  { hoja: '5. REQUERIMIENTOS', seccion: 'requerimientos', fila: 1, cols: [
    [1, 'expediente', 'expediente'], [2, 'requerimiento', 'requerimiento'], [3, 'notificación', 'fechaNotificacion', 'fecha'],
    [4, 'plazo', 'plazoTexto'], [5, 'vencimiento', 'fechaVencimiento', 'fecha'], [6, 'abogado', 'abogado', 'abogado'],
    [7, 'atención', null, 'oficioFecha:oficioAtencion,fechaAtencion'], [8, 'estatus', 'estatus', 'estatus'],
  ] },
  { hoja: 'TURNO RI 2026', seccion: 'turno_ri', fila: 1, cols: [
    [0, 'expediente', 'expediente'], [1, 'abogado', 'abogado', 'abogado'], [2, 'recurrente', 'recurrente'],
    [3, 'notificación', 'notificacionPersonal', 'fecha'], [4, 'denunciante', 'parte', 'parte'],
    [5, 'presentación', 'presentacionRecurso', 'fechaNota:presentacionNota'], [6, 'acto', 'actoControvertido'],
    [7, 'conducta', 'observacionesConducta'], [8, 'acuerdo', 'acuerdoJge'], [9, 'dirección', 'direccionDesignada'],
    [10, 'remisión', 'fechaRemisionTurno', 'fecha'], [11, 'cerrar instrucción', 'venceInstruccion', 'fecha'],
    [12, 'aprobación', 'venceAprobacionJge', 'fecha'], [13, 'resolución de recurso', 'fechaResolucion', 'fechaNota:resolucionNota'],
    [14, 'sentido', 'sentido'], [15, 'observaciones', 'observaciones'], [16, 'solicitud de opinión', 'solicitudOpinion', 'fecha'],
    [17, 'vencimiento', 'venceOpinion', 'fecha'], [18, 'opinión jurídica', 'opinionJuridica'], [19, 'criterio', 'criterio'],
  ] },
  { hoja: 'PROTOCOLO', seccion: 'protocolo', fila: 0, cols: [
    [0, 'expediente', 'expediente'], [1, 'nombre', 'personas'], [2, 'régimen', 'regimen'],
    [3, 'conducta', 'fechaConducta', 'serieTexto'], [4, 'opinión', 'opinion'], [5, 'fecha de opinión', 'fechaOpinion', 'serieTexto'],
    [6, 'cantidad', 'cantidadPersonas'], [7, 'nota', 'nota'], [8, 'dictamen', 'fechaDictamen', 'serieTexto'], [10, '', 'nota'],
  ] },
]

const etiquetas = Object.fromEntries(SECCIONES_RI.map(s => [s.key, Object.fromEntries(s.campos.map(c => [c.key, c.label]))]))
const SIN_FECHA = /^(n\/?a|en tr[aá]mite|-+|s\/n)$/i
const fmtMx = (isoF) => { const [a, m, d] = isoF.split('-'); return `${d}/${m}/${a}` }

// ── Leer el Excel ──
const wb = XLSX.readFile(resolve(ruta))
const tablas = HOJAS.map(h => {
  const ws = wb.Sheets[h.hoja]
  if (!ws) { console.error(`✗ No existe la hoja "${h.hoja}" en el Excel.`); process.exit(1) }
  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true })
  const enc = filas[h.fila].map(x => J.limpiar(x).toLowerCase())
  for (const [i, palabra] of h.cols) {
    if (palabra && !enc[i]?.includes(palabra)) {
      console.error(`✗ Hoja "${h.hoja}": la columna ${i + 1} dice "${enc[i]}" y se esperaba "${palabra}". ¿Cambió el Excel?`)
      process.exit(1)
    }
  }
  const datos = filas.slice(h.fila + 1).filter(r => r.some(c => J.limpiar(c)))
  return { ...h, datos }
})

// ── Abogados: la misma persona escrita de varias formas → un solo nombre ──
const variantes = new Map()
for (const t of tablas) for (const [i, , , tipo] of t.cols) if (tipo === 'abogado') {
  for (const r of t.datos) for (const n of J.abogadosDe(r[i]).nombres) {
    const k = J.claveNombre(n)
    if (!variantes.has(k)) variantes.set(k, new Map())
    variantes.get(k).set(n, (variantes.get(k).get(n) || 0) + 1)
  }
}
const canonico = new Map([...variantes].map(([k, v]) => [k, J.nombreCanonico(v)]))

// ── Convertir cada renglón ──
const avisos = { fechasNoLeidas: [], sinAnio: 0, conF: 0, estatusRaro: [], parteRara: [] }
const registros = tablas.map(t => {
  const lab = etiquetas[t.seccion]
  return { seccion: t.seccion, hoja: t.hoja, filas: t.datos.map(r => {
    const d = {}
    const notas = []
    const nota = (campo, texto) => notas.push(`${lab[campo] || campo}: ${texto}`)
    const agregar = (campo, valor) => { if (!valor) return; d[campo] = d[campo] ? `${d[campo]}\n${valor}` : valor }

    for (const [i, , campo, tipo = 'texto'] of t.cols) {
      const v = r[i]
      const texto = typeof v === 'number' && tipo === 'texto' ? String(v) : J.limpiar(v)
      if (!texto && v !== 0) continue
      const [clase, extra] = tipo.split(':')
      // "N/A" o "EN TRÁMITE" en una columna de fecha: no hay fecha (el estatus ya lo dice)
      if (['fecha', 'fechaNota'].includes(clase) && SIN_FECHA.test(texto)) continue

      if (clase === 'texto') agregar(campo, texto)
      else if (clase === 'serieTexto') agregar(campo, typeof v === 'number' && J.fechaDe(v) ? fmtMx(J.fechaDe(v).fecha) : texto)
      else if (clase === 'fecha' || clase === 'fechaNota') {
        const f = J.fechaDe(v, { anio: ANIO })
        if (f) {
          d[campo] = f.fecha
          if (f.sinAnio) { avisos.sinAnio++; nota(campo, `"${texto}" (no traía año; se tomó ${ANIO})`) }
          if (!f.exacta) clase === 'fechaNota' ? agregar(extra, texto) : nota(campo, `texto original "${texto}"`)
        } else if (clase === 'fechaNota') agregar(extra, texto)
        else { avisos.fechasNoLeidas.push(`${t.seccion}.${campo}: ${texto.slice(0, 60)}`); nota(campo, `"${texto}" (no se reconoció como fecha)`) }
      } else if (clase === 'oficioFecha') {
        const [cOficio, cFecha] = extra.split(',')
        const { oficio, fecha, sinAnio } = J.oficioYFecha(v, { anio: ANIO })
        if (oficio && !SIN_FECHA.test(oficio)) d[cOficio] = oficio
        if (fecha) d[cFecha] = fecha
        if (sinAnio) { avisos.sinAnio++; nota(cFecha, `"${texto}" (no traía año; se tomó ${ANIO})`) }
      } else if (clase === 'abogado') {
        const { nombres, conF } = J.abogadosDe(v)
        d[campo] = [...new Set(nombres.map(n => canonico.get(J.claveNombre(n))))].join('/')
        if (conF) { avisos.conF++; nota(campo, `en el Excel decía "${texto}"`) }
      } else if (clase === 'estatus') {
        const e = J.estatusDe(v)
        if (e === null) { avisos.estatusRaro.push(texto); nota(campo, `"${texto}"`) } else d[campo] = e
      } else if (clase === 'parte') {
        const p = J.parteDe(v)
        if (p === null) { avisos.parteRara.push(texto); nota(campo, `"${texto}"`) } else d[campo] = p
      }
    }
    // Turno RI: "Se liberó el 30 de marzo" en la opinión jurídica → fecha en que se liberó
    if (t.seccion === 'turno_ri' && !d.fechaOpinion) {
      const m = (d.opinionJuridica || '').match(/liber[oó]\s+el\s+(.{4,40})/i)
      const f = m && J.fechaDe(m[1], { anio: ANIO })
      if (f) d.fechaOpinion = f.fecha
    }
    if (notas.length) d.notasImportacion = notas.join('\n')
    return d
  }) }
})

// ── Reporte ──
console.log(`Excel: ${resolve(ruta)} (solo lectura)\n`)
for (const s of registros) {
  const conNotas = s.filas.filter(f => f.notasImportacion).length
  console.log(`  ${s.hoja.padEnd(32)} → ${s.seccion.padEnd(15)} ${String(s.filas.length).padStart(4)} registros${conNotas ? `, ${conNotas} con notas de importación` : ''}`)
}
const unidos = [...variantes].filter(([, v]) => v.size > 1).map(([k, v]) => `${[...v.keys()].join(' / ')} → ${canonico.get(k)}`)
console.log(`\nAbogados (${canonico.size}): ${[...new Set(canonico.values())].sort().join(', ')}`)
if (unidos.length) console.log(`  Unificados: ${unidos.join(' · ')}`)
if (avisos.conF) console.log(`  ${avisos.conF} celdas con "F" al final del nombre (se quitó; el original quedó en las notas)`)
if (avisos.sinAnio) console.log(`  ${avisos.sinAnio} fechas sin año: se tomó ${ANIO} (anotado en cada registro)`)
if (avisos.fechasNoLeidas.length) console.log(`  ${avisos.fechasNoLeidas.length} fechas no reconocidas (el texto quedó en las notas):\n    - ${avisos.fechasNoLeidas.join('\n    - ')}`)
if (avisos.estatusRaro.length) console.log(`  Estatus no reconocidos: ${avisos.estatusRaro.join(', ')}`)
if (avisos.parteRara.length) console.log(`  Parte no reconocida: ${avisos.parteRara.join(', ')}`)

if (simular) { console.log('\n(simulación: no se escribió nada)'); process.exit(0) }

// ── Guardar ──
const { default: db } = await import('../db.js')
const yaHay = db.prepare('SELECT COUNT(*) AS n FROM ric_registros').get().n
if (yaHay && !forzar) {
  console.error(`\n✗ Ya hay ${yaHay} registros de RI-Consultas. Usa --forzar para reemplazarlos.`)
  process.exit(1)
}
const insertar = db.prepare('INSERT INTO ric_registros (section, data) VALUES (?, ?)')
db.transaction(() => {
  db.prepare('DELETE FROM ric_registros').run()
  for (const s of registros) for (const f of s.filas) insertar.run(s.seccion, JSON.stringify(f))
})()

let bien = true
for (const s of registros) {
  const n = db.prepare('SELECT COUNT(*) AS n FROM ric_registros WHERE section = ?').get(s.seccion).n
  if (n !== s.filas.length) { bien = false; console.error(`✗ ${s.seccion}: se esperaban ${s.filas.length} y hay ${n}`) }
}
console.log(bien ? `\n✅ Importados ${registros.reduce((t, s) => t + s.filas.length, 0)} registros a RI-Consultas.` : '\n✗ Los conteos no cuadran; revisa.')
process.exit(bien ? 0 : 1)
