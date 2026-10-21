// Catálogo de abogados (tabla abogados) ↔ los nombres que traen los registros de una
// subdirección que guarda el nombre y no el id: Litigio (dal_records) y RI-Consultas
// (ric_registros). Un registro puede tener varios abogados ("JC/Absalón").
//
// sincronizarAbogados(db, subdireccion):
//   - Aplica los cambios de nombre acordados (RENOMBRES: "JC" → "Juan Carlos").
//   - Un nombre corto que coincide con una sola palabra de un nombre del catálogo se cambia
//     por el nombre completo ("Saile" → "Airamse Saile Domínguez Javier").
//   - Un nombre que no está en el catálogo se agrega como INACTIVO: sigue en sus asuntos, pero
//     no se ofrece para asignar nuevos. Nunca se borran asuntos.
//
// Uso:  node scripts/abogados.js litigio | ri
import { fileURLToPath } from 'url'
import { resolve } from 'path'
import { claveNombre } from './jdryc.js'

export const TABLAS = { litigio: 'dal_records', ri: 'ric_registros' }
const RENOMBRES = { litigio: { JC: 'Juan Carlos' } }

const separar = (s) => String(s || '').split('/').map(x => x.trim()).filter(Boolean)

export function sincronizarAbogados(db, subdireccion) {
  const tabla = TABLAS[subdireccion]
  if (!tabla) throw new Error(`Subdirección sin catálogo por nombre: ${subdireccion}`)
  const renombres = Object.fromEntries(Object.entries(RENOMBRES[subdireccion] || {}).map(([k, v]) => [claveNombre(k), v]))
  const catalogo = () => db.prepare('SELECT id, nombre, activo FROM abogados WHERE subdireccion = ?').all(subdireccion)
  const completo = (corto) => {
    const k = claveNombre(corto)
    if (renombres[k]) return renombres[k]
    const exacto = catalogo().find(a => claveNombre(a.nombre) === k)
    if (exacto) return exacto.nombre
    const porPalabra = catalogo().filter(a => claveNombre(a.nombre).split(' ').includes(k))
    return porPalabra.length === 1 ? porPalabra[0].nombre : corto
  }

  const upd = db.prepare(`UPDATE ${tabla} SET data = ? WHERE id = ?`)
  const insAbogado = db.prepare('INSERT INTO abogados (subdireccion, nombre, activo) VALUES (?, ?, 0)')
  let renombrados = 0
  const agregados = []
  db.transaction(() => {
    for (const r of db.prepare(`SELECT id, data FROM ${tabla}`).all()) {
      const d = JSON.parse(r.data)
      if (!d.abogado) continue
      const nuevo = [...new Set(separar(d.abogado).map(completo))].join('/')
      if (nuevo !== d.abogado) { d.abogado = nuevo; upd.run(JSON.stringify(d), r.id); renombrados++ }
    }
    const enCatalogo = new Set(catalogo().map(a => claveNombre(a.nombre)))
    for (const r of db.prepare(`SELECT data FROM ${tabla}`).all()) {
      for (const n of separar(JSON.parse(r.data).abogado)) {
        if (!enCatalogo.has(claveNombre(n))) { insAbogado.run(subdireccion, n); enCatalogo.add(claveNombre(n)); agregados.push(n) }
      }
    }
  })()
  return { renombrados, agregados }
}

// Cambia un nombre en los registros de la subdirección (también en los compartidos "A/B")
export function renombrarEnRegistros(db, subdireccion, viejo, nuevo) {
  const tabla = TABLAS[subdireccion]
  if (!tabla) return 0
  const upd = db.prepare(`UPDATE ${tabla} SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
  let n = 0
  db.transaction(() => {
    for (const r of db.prepare(`SELECT id, data FROM ${tabla}`).all()) {
      const d = JSON.parse(r.data)
      const nombres = separar(d.abogado)
      if (!nombres.includes(viejo)) continue
      d.abogado = [...new Set(nombres.map(x => (x === viejo ? nuevo : x)))].join('/')
      upd.run(JSON.stringify(d), r.id); n++
    }
  })()
  return n
}

// Uso directo
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const sub = process.argv[2]
  if (!TABLAS[sub]) { console.error('Uso: node scripts/abogados.js litigio | ri'); process.exit(1) }
  const { default: db } = await import('../db.js')
  const { renombrados, agregados } = sincronizarAbogados(db, sub)
  console.log(`${sub}: ${renombrados} registros con el nombre del catálogo; agregados como inactivos: ${agregados.length ? agregados.join(', ') : 'ninguno'}.`)
}
