// Sentencias de Litigio: pasa el plazo y el vencimiento generales (plazo, fechaVencimiento) de las
// sentencias que aún no tienen conceptos a un concepto "Condena" con esos datos. Desde que el
// plazo y el vencimiento salen de los conceptos, el formulario ya no tiene esos campos.
// Se puede correr más de una vez: solo toca las que no tienen conceptos.
//
// Uso: node scripts/migrar-condenas.js [--simular]
import db from '../db.js'
import { migrarCondenas } from '../src/components/litigio/sentencias.js'

const simular = process.argv.includes('--simular')
const filas = db.prepare("SELECT id, data FROM dal_records WHERE section = 'sentencias'").all()
const cambios = filas.map(r => ({ id: r.id, nuevo: migrarCondenas(JSON.parse(r.data)) })).filter(x => x.nuevo)

if (!simular) {
  const upd = db.prepare('UPDATE dal_records SET data = ? WHERE id = ?')
  db.transaction(() => { for (const c of cambios) upd.run(JSON.stringify(c.nuevo), c.id) })()
}
console.log(`${filas.length} sentencias; ${cambios.length} ${simular ? 'se pasarían' : 'pasaron'} a un concepto de condena.`)
