// Pruebas de cómo se unen los registros de Litigio por expediente (npm test)
import assert from 'node:assert/strict'
import { clavesExpediente, indiceExpedientes, relacionados } from '../src/components/litigio/expedientes.js'

const c = clavesExpediente
// Mismo expediente escrito distinto
assert.deepEqual(c('SM-JLI-80/2022'), ['SM-JLI-80/2022'])
assert.deepEqual(c(' sm-jli-80/2022 '), ['SM-JLI-80/2022'])
assert.deepEqual(c('SM - JLI - 80 / 2022'), ['SM-JLI-80/2022'])
assert.deepEqual(c('SM-JLI-71-/2025'), ['SM-JLI-71/2025'])
assert.deepEqual(c('ST-JLI-09/2026'), ['ST-JLI-9/2026'])
assert.deepEqual(c('ST-JLI-9/2026'), ['ST-JLI-9/2026'])
// Requerimientos de un incidente: cuentan para el expediente principal
assert.deepEqual(c('SM-JLI-46/2025 INC1'), ['SM-JLI-46/2025'])
assert.deepEqual(c('SM-JLI-32/2023-INC3'), ['SM-JLI-32/2023'])
assert.deepEqual(c('SM-JLI-32/2023 INC 3'), ['SM-JLI-32/2023'])
assert.deepEqual(c('SM-JLI-25/2025 INCIDENTE-2'), ['SM-JLI-25/2025'])
// Varios expedientes en una celda
assert.deepEqual(c('SCM-JLI-4/2026 SCM-JLI-6/2026 y SCM-JLI-7/2026'), ['SCM-JLI-4/2026', 'SCM-JLI-6/2026', 'SCM-JLI-7/2026'])
// Salas distintas no se confunden
assert.notDeepEqual(c('SM-JLI-43/2025'), c('SCM-JLI-43/2025'))
// Otros formatos
assert.deepEqual(c('221/2022'), ['221/2022'])
assert.deepEqual(c(''), [])

// Índice y relacionados
const emp = { id: 1, expediente: 'SM-JLI-46/2025' }
const sen = { id: 7, expediente: 'sm-jli-46/2025' }
const req1 = { id: 3, expediente: 'SM-JLI-46/2025 INC1' }
const req2 = { id: 4, expediente: 'SM-JLI-99/2025' }
const idx = indiceExpedientes({ emplaz: [emp], sentencias: [sen], requerims: [req1, req2] })
assert.deepEqual(Object.keys(relacionados(idx, emp, 'emplaz')).sort(), ['requerims', 'sentencias'])
assert.equal(relacionados(idx, emp, 'emplaz').requerims.length, 1)
assert.deepEqual(relacionados(idx, sen, 'sentencias').emplaz, [emp])
// El propio registro no sale, aunque sea una copia (p. ej. después de editarlo)…
assert.equal(relacionados(idx, { ...emp }, 'emplaz').emplaz, undefined)
// …pero sí otro de otra sección con el mismo id
const req3 = { id: 1, expediente: 'SM-JLI-46/2025' }
const idx2 = indiceExpedientes({ emplaz: [emp], requerims: [req3] })
assert.deepEqual(relacionados(idx2, { ...emp }, 'emplaz').requerims, [req3])

console.log('expedientes: ok')
