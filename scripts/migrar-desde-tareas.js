// Migra a seguimiento.db los datos que siguen en uso desde la base de la etapa "Tareas":
// usuarios, convenios y registros de Asuntos Laborales (Litigio). Conserva los id.
//
// La base de origen se abre SOLO LECTURA: no se modifica ni se borra nada de ella.
// Si seguimiento.db ya tiene convenios o registros de Litigio, se detiene (usa --forzar
// para vaciar esas tablas y migrar de nuevo).
//
// Uso:
//   node scripts/migrar-desde-tareas.js [ruta/a/tareas.db] [--forzar]
//   (por defecto ../tareas/tareas.db, junto a esta carpeta)
import Database from 'better-sqlite3'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import db from '../db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const forzar = args.includes('--forzar')
const origenPath = resolve(args.find(a => !a.startsWith('--')) || join(__dirname, '..', '..', 'tareas', 'tareas.db'))

if (!existsSync(origenPath)) {
  console.error(`✗ No existe la base de origen: ${origenPath}`)
  process.exit(1)
}
const origen = new Database(origenPath, { readonly: true, fileMustExist: true })
console.log(`Origen:  ${origenPath} (solo lectura)`)

const cuenta = (base, tabla) => base.prepare(`SELECT COUNT(*) AS n FROM ${tabla}`).get().n
const columnas = (base, tabla) => base.prepare(`PRAGMA table_info(${tabla})`).all().map(c => c.name)

const yaHay = cuenta(db, 'convenios') + cuenta(db, 'dal_records')
if (yaHay && !forzar) {
  console.error(`✗ seguimiento.db ya tiene ${yaHay} registros de convenios/litigio. Usa --forzar para reemplazarlos.`)
  process.exit(1)
}

// Copia las columnas que existen en ambas tablas (el origen tiene columnas históricas de más).
function copiar(tabla, transformar = (r) => r) {
  const comunes = columnas(db, tabla).filter(c => columnas(origen, tabla).includes(c))
  const filas = origen.prepare(`SELECT ${comunes.join(', ')} FROM ${tabla} ORDER BY id`).all().map(transformar)
  const insert = db.prepare(`INSERT INTO ${tabla} (${comunes.join(', ')}) VALUES (${comunes.map(c => '@' + c).join(', ')})`)
  for (const f of filas) insert.run(f)
  return filas.length
}

const resumen = {}
db.pragma('foreign_keys = OFF')
db.transaction(() => {
  if (forzar) {
    db.exec('DELETE FROM dal_records; DELETE FROM convenios;')
  }
  // Usuarios: se reemplaza el espejo completo para conservar los id que usan los convenios.
  // No se copian contraseñas: el acceso es solo por el portal.
  db.exec('DELETE FROM users')
  resumen.users = copiar('users', (u) => ({ ...u, password_hash: 'sso_user', username: u.username || u.email }))
  resumen.convenios = copiar('convenios')
  resumen.dal_records = copiar('dal_records')
})()
db.pragma('foreign_keys = ON')

// Verificación: mismos conteos en origen y destino, y mismo contenido en Litigio por sección.
let ok = true
for (const t of ['users', 'convenios', 'dal_records']) {
  const o = cuenta(origen, t), d = cuenta(db, t)
  const bien = o === d
  ok &&= bien
  console.log(`${bien ? '✓' : '✗'} ${t.padEnd(12)} origen ${String(o).padStart(5)}  →  destino ${String(d).padStart(5)}`)
}
const porSeccion = (base) => Object.fromEntries(
  base.prepare('SELECT section, COUNT(*) n, SUM(LENGTH(data)) bytes FROM dal_records GROUP BY section').all()
    .map(r => [r.section, `${r.n}/${r.bytes}`]))
const so = porSeccion(origen), sd = porSeccion(db)
for (const s of new Set([...Object.keys(so), ...Object.keys(sd)])) {
  const bien = so[s] === sd[s]
  ok &&= bien
  console.log(`${bien ? '✓' : '✗'}   litigio/${s.padEnd(13)} ${so[s] || '—'}  →  ${sd[s] || '—'}  (registros/bytes)`)
}
const fk = db.prepare('PRAGMA foreign_key_check').all()
if (fk.length) { ok = false; console.log(`✗ ${fk.length} referencias rotas:`, fk.slice(0, 5)) }

console.log(ok ? '\n✅ Migración completa y verificada.' : '\n⚠️  La verificación encontró diferencias. Revisa antes de usar el módulo.')
process.exit(ok ? 0 : 1)
