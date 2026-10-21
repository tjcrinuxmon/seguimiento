// Litigio: une los registros de las distintas secciones (actor, emplazamiento, sentencias,
// requerimientos, cumplimiento, incidentes, amparos…) por su número de expediente.
//
// El número se captura a mano, así que se compara "limpio": sin espacios ni diferencias de
// mayúsculas, sin el sufijo de incidente ("INC1", "INC 3", "INCIDENTE-2") y corrigiendo
// guiones de más ("SM-JLI-71-/2025"). Una celda con varios expedientes ("SCM-JLI-4/2026
// SCM-JLI-6/2026 y SCM-JLI-7/2026") cuenta para cada uno.

const EXPEDIENTE = /[A-Z]+(?:-[A-Z]+)*-\d+\/\d{4}/g

// Claves limpias de lo capturado en "Expediente" (puede traer más de uno)
export function clavesExpediente(texto) {
  const t = String(texto || '').toUpperCase()
    .replace(/[–—]/g, '-')
    .replace(/\s*-\s*/g, '-')          // "SM - JLI - 5" → "SM-JLI-5"
    .replace(/-+\//g, '/')             // "SM-JLI-71-/2025" → "SM-JLI-71/2025"
    .replace(/\s*\/\s*/g, '/')
  const encontrados = t.match(EXPEDIENTE)
  if (encontrados) return [...new Set(encontrados.map(e => e.replace(/-0+(\d)/g, '-$1')))]
  // Otros formatos ("221/2022", "200/24-2025/JL-I"): el texto sin espacios ni sufijo de incidente
  const otro = t.replace(/[-\s]*INC(IDENTE)?[-\s]*\d*\s*$/, '').replace(/\s+/g, '')
  return otro ? [otro] : []
}

// Secciones que se relacionan por expediente, en el orden en que se muestran
export const SECCIONES_RELACION = ['actores', 'emplaz', 'noemplaz', 'sentencias', 'requerims', 'cumplims', 'incidentes', 'amparos', 'conciliacion', 'oic', 'reencauz']

// Índice: clave → { seccion: [registros] }. `store` = { seccion: [registros] }
export function indiceExpedientes(store) {
  const idx = new Map()
  for (const seccion of SECCIONES_RELACION) {
    for (const r of store[seccion] || []) {
      for (const k of clavesExpediente(r.expediente)) {
        if (!idx.has(k)) idx.set(k, {})
        const grupo = idx.get(k)
        ;(grupo[seccion] = grupo[seccion] || []).push(r)
      }
    }
  }
  return idx
}

// Registros del mismo expediente que `row` (de todas las secciones), sin incluir a `row`
// (que es de la sección `propia`; se compara por id porque puede ser una copia)
export function relacionados(idx, row, propia) {
  const out = {}
  for (const k of clavesExpediente(row?.expediente)) {
    for (const [seccion, lista] of Object.entries(idx.get(k) || {})) {
      for (const r of lista) {
        if (r === row || (seccion === propia && r.id === row.id)) continue
        out[seccion] = out[seccion] || []
        if (!out[seccion].includes(r)) out[seccion].push(r)
      }
    }
  }
  return out
}
