// Pruebas del plazo y vencimiento de una sentencia a partir de sus conceptos (npm test)
import assert from 'node:assert/strict'
import { plazosSentencia, vencimientosSentencia, venceSentencia, migrarCondenas } from '../src/components/litigio/sentencias.js'

// Un solo concepto de condena
const una = { condenas: [{ concepto: 'Salarios', sentido: 'Condena', plazo: '3', vencimiento: '2026-03-05' }] }
assert.deepEqual(plazosSentencia(una), ['3'])
assert.deepEqual(vencimientosSentencia(una), ['2026-03-05'])
assert.equal(venceSentencia(una), '2026-03-05')

// Varios plazos y vencimientos; la absolución no cuenta
const varias = { condenas: [
  { concepto: 'Salarios', sentido: 'Condena', plazo: '5', vencimiento: '2026-03-09' },
  { concepto: 'Aguinaldo', sentido: 'Condena', plazo: '3', vencimiento: '2026-03-05' },
  { concepto: 'Prima', sentido: 'Condena', plazo: '3', vencimiento: '2026-03-05' },
  { concepto: 'Reinstalación', sentido: 'Absolución' },
] }
assert.deepEqual(plazosSentencia(varias), ['5', '3'])
assert.deepEqual(vencimientosSentencia(varias), ['2026-03-05', '2026-03-09'])
assert.equal(venceSentencia(varias), '2026-03-05')            // el más próximo pendiente
// Cumplidos los de 3 días: cuenta el de 5
varias.condenas[1].cumplimiento = '2026-03-04'; varias.condenas[2].cumplimiento = '2026-03-04'
assert.equal(venceSentencia(varias), '2026-03-09')
// Todo cumplido: el último vencimiento
varias.condenas[0].cumplimiento = '2026-03-08'
assert.equal(venceSentencia(varias), '2026-03-09')

// Solo absoluciones: sin plazo ni vencimiento
const absuelta = { condenas: [{ concepto: 'Reinstalación', sentido: 'Absolución' }], plazo: '3', fechaVencimiento: '2026-01-01' }
assert.deepEqual(plazosSentencia(absuelta), [])
assert.equal(venceSentencia(absuelta), null)

// Sentencia anterior sin conceptos: usa sus campos generales
const vieja = { expediente: 'SM-JLI-1/2025', plazo: 15, fechaVencimiento: '2025-05-02' }
assert.deepEqual(plazosSentencia(vieja), ['15'])
assert.equal(venceSentencia(vieja), '2025-05-02')
// …y al migrar, pasan a un concepto de condena
assert.deepEqual(migrarCondenas(vieja), { expediente: 'SM-JLI-1/2025', condenas: [{ concepto: '', sentido: 'Condena', plazo: 15, vencimiento: '2025-05-02' }] })
assert.equal(migrarCondenas(una), null)
assert.equal(migrarCondenas({ expediente: 'X' }), null)

console.log('sentencias: ok')
