// Limpieza de los valores del Excel "JDRYC" para importarlos a RI-Consultas (ver
// importar-jdryc.js). Funciones puras, con pruebas en test/jdryc.test.mjs.

const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 }
const MESES_EN = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }

const pad = (n) => String(n).padStart(2, '0')
const sinAcentos = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')

// Texto limpio: saltos de línea normales, sin espacios sobrantes ni renglones vacíos de más.
export function limpiar(v) {
  if (v === null || v === undefined) return ''
  return String(v).replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/[ \t ]+/g, ' ').trim())
    .join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function iso(a, m, d) {
  if (a < 100) a += 2000
  if (m < 1 || m > 12 || d < 1 || d > 31 || a < 2000 || a > 2100) return null
  const f = new Date(Date.UTC(a, m - 1, d))
  return f.getUTCMonth() === m - 1 ? `${a}-${pad(m)}-${pad(d)}` : null
}

// Número de serie de Excel (días desde 1899-12-30) → AAAA-MM-DD
export function deSerie(n) {
  const f = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000)
  return `${f.getUTCFullYear()}-${pad(f.getUTCMonth() + 1)}-${pad(f.getUTCDate())}`
}

// Primera fecha que aparece en un valor del Excel. Devuelve { fecha, exacta, sinAnio } o null:
//   - exacta: el valor era solo la fecha (sin texto alrededor)
//   - sinAnio: el texto no traía año y se usó `anio`
// Acepta números de serie, d/m/aaaa (el formato de México; m/d solo si el día pasa de 12),
// d-m-aaaa, "7 de enero de 2026", "5 demarzo", "23-Sep-26" y "1-Apr".
export function fechaDe(v, { anio = null } = {}) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return v > 30000 && v < 60000 ? { fecha: deSerie(v), exacta: true, sinAnio: false } : null
  const t = limpiar(v)
  if (/^\d{5}(\.\d+)?$/.test(t)) return fechaDe(Number(t))
  let m, f

  // d/m/aaaa o d-m-aaaa (también con año de 2 dígitos)
  // Un año de 3 dígitos "20X" es un 202X al que le faltó un dígito ("05/06/206" → 2026).
  if ((m = t.match(/(?<!\d)(\d{1,2})[/-](\d{1,2})[/-](\d{4}|20\d|\d{2})(?!\d)/))) {
    let [, a, b, y] = m.map(Number)
    if (m[3].length === 3) y = 2020 + (y % 10)
    f = b > 12 && a <= 12 ? iso(y, a, b) : iso(y, b, a)
    if (f) return { fecha: f, exacta: m[0] === t, sinAnio: false }
  }
  // "7 de enero de 2026", "20 DE MARZO DE 2026", "12 de mayo 2026", "5 demarzo"
  const nombres = Object.keys(MESES).join('|')
  if ((m = sinAcentos(t).toLowerCase().match(new RegExp(`(?<!\\d)(\\d{1,2})\\s*(?:de)?\\s*(${nombres})(?:\\s*(?:de|del)?\\s*(\\d{4}))?`)))) {
    const y = m[3] ? Number(m[3]) : anio
    f = y && iso(y, MESES[m[2]], Number(m[1]))
    if (f) return { fecha: f, exacta: m[0].length >= sinAcentos(t).trim().length - 1, sinAnio: !m[3] }
  }
  // "23-Sep-26", "1-Apr"
  if ((m = t.toLowerCase().match(/(?<!\d)(\d{1,2})-([a-z]{3})(?:-(\d{2,4}))?(?![a-z])/)) && MESES_EN[m[2]]) {
    const y = m[3] ? Number(m[3]) : anio
    f = y && iso(y, MESES_EN[m[2]], Number(m[1]))
    if (f) return { fecha: f, exacta: m[0] === t.toLowerCase(), sinAnio: !m[3] }
  }
  return null
}

// "INE/DEAJ/1018/2026 \n de 16/01/2026" → { oficio: 'INE/DEAJ/1018/2026', fecha: '2026-01-16' }
export function oficioYFecha(v, opciones) {
  const t = limpiar(v)
  if (!t) return { oficio: '', fecha: null, sinAnio: false }
  const f = fechaDe(v, opciones)
  if (!f) return { oficio: t, fecha: null, sinAnio: false }
  if (f.exacta) return { oficio: '', fecha: f.fecha, sinAnio: f.sinAnio }
  return { oficio: t, fecha: f.fecha, sinAnio: f.sinAnio }
}

export function estatusDe(v) {
  const t = sinAcentos(limpiar(v)).toLowerCase()
  if (!t) return ''
  if (t.includes('conclu')) return 'CONCLUIDO'
  if (t.includes('tramite')) return 'EN TRÁMITE'
  return null
}

export function parteDe(v) {
  const t = sinAcentos(limpiar(v)).toLowerCase()
  if (!t) return ''
  const den = t.includes('denunciante'), inf = t.includes('infract')
  if (den && inf) return 'Denunciante / Infractor'
  if (den) return 'Denunciante'
  if (inf) return 'Infractor'
  if (t === 'n/a') return 'N/A'
  return null
}

// Abogados de una celda: "Gibrán \n Irene", "América-Nicolás", "América y Nicolás", "Luis
// Carlos/Irene F" → ['Gibrán', 'Irene'] … La "F" final del turno RI se quita y se avisa.
export function abogadosDe(v) {
  const t = limpiar(v)
  if (!t) return { nombres: [], conF: false }
  let conF = false
  const nombres = t.split(/\n|\/|,|-| y /).map(s => s.trim()).filter(Boolean).map(s => {
    if (/\s+f$/i.test(s)) { conF = true; s = s.replace(/\s+f$/i, '') }
    return s
  }).filter(Boolean)
  return { nombres, conF }
}

// Clave para reconocer el mismo nombre escrito distinto: "AMÉRICA" = "America" = "América"
export const claveNombre = (s) => sinAcentos(s).toLowerCase().replace(/\s+/g, ' ').trim()

// De las variantes de un mismo nombre, la mejor: con acentos y en tipo título, la más usada.
export function nombreCanonico(variantes) {
  const titulo = (s) => s.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())
  const puntos = (s) => (s !== sinAcentos(s) ? 2 : 0) + (s === titulo(s) ? 1 : 0)
  const [mejor] = [...variantes.entries()].sort((a, b) => puntos(b[0]) - puntos(a[0]) || b[1] - a[1])
  return titulo(mejor[0])
}
