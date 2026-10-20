// Catálogo de abogados de RI-Consultas (tabla abogados, subdireccion = 'ri') ↔ los nombres
// que traen los registros (el Excel los traía cortos: "Jocelyn", "América/Nicolás").
//
// sincronizarAbogadosRi(db):
//   - Un nombre corto que coincide con una sola palabra de un nombre del catálogo se cambia
//     por el nombre completo en los registros ("Saile" → "Airamse Saile Domínguez Javier").
//   - Un nombre que no está en el catálogo se agrega como INACTIVO: sigue en sus asuntos, pero
//     no se ofrece para asignar nuevos. Nunca se borran asuntos ni abogados.
//
// Lo usa importar-jdryc.js después de importar; también se puede correr solo:
//   node scripts/abogados-ri.js
import { fileURLToPath } from 'url'
import { resolve } from 'path'
import { claveNombre } from './jdryc.js'

const separar = (s) => String(s || '').split('/').map(x => x.trim()).filter(Boolean)

export function sincronizarAbogadosRi(db) {
  const catalogo = () => db.prepare("SELECT id, nombre, activo FROM abogados WHERE subdireccion = 'ri'").all()
  // Nombre corto → nombre completo, solo si coincide con una sola persona del catálogo
  const completo = (corto) => {
    const k = claveNombre(corto)
    const exacto = catalogo().find(a => claveNombre(a.nombre) === k)
    if (exacto) return exacto.nombre
    const porPalabra = catalogo().filter(a => claveNombre(a.nombre).split(' ').includes(k))
    return porPalabra.length === 1 ? porPalabra[0].nombre : corto
  }

  const filas = db.prepare('SELECT id, data FROM ric_registros').all()
  const upd = db.prepare('UPDATE ric_registros SET data = ? WHERE id = ?')
  const insAbogado = db.prepare("INSERT INTO abogados (subdireccion, nombre, activo) VALUES ('ri', ?, 0)")
  let renombrados = 0
  const agregados = []
  db.transaction(() => {
    for (const r of filas) {
      const d = JSON.parse(r.data)
      if (!d.abogado) continue
      const nuevo = [...new Set(separar(d.abogado).map(completo))].join('/')
      if (nuevo !== d.abogado) { d.abogado = nuevo; upd.run(JSON.stringify(d), r.id); renombrados++ }
    }
    const enCatalogo = new Set(catalogo().map(a => claveNombre(a.nombre)))
    for (const r of db.prepare('SELECT data FROM ric_registros').all()) {
      for (const n of separar(JSON.parse(r.data).abogado)) {
        if (!enCatalogo.has(claveNombre(n))) { insAbogado.run(n); enCatalogo.add(claveNombre(n)); agregados.push(n) }
      }
    }
  })()
  return { renombrados, agregados }
}

// Uso directo
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const { default: db } = await import('../db.js')
  const { renombrados, agregados } = sincronizarAbogadosRi(db)
  console.log(`Registros con nombre completo: ${renombrados}. Agregados al catálogo como inactivos: ${agregados.length ? agregados.join(', ') : 'ninguno'}.`)
}
