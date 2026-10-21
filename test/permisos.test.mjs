// Pruebas de quién ve qué en Seguimiento (npm test)
import assert from 'node:assert/strict'
import { permisos } from '../src/rubros.js'

const ve = (u) => Object.entries(permisos(u)).filter(([, v]) => v).map(([k]) => k).sort().join(',')

assert.equal(ve({ role: 'admin' }), 'contratos,convenios,dal,dcyc,litigio,recursos')
assert.equal(ve({ role: 'ejecutiva' }), 'dal,litigio,recursos')
// Director/a: toda su dirección
assert.equal(ve({ role: 'director', direccion: 'asuntos_laborales' }), 'dal,litigio,recursos')
assert.equal(ve({ role: 'director', direccion: 'contratos_convenios' }), 'contratos,convenios,dcyc')
// Subdirector/a: solo su subdirección (sin dashboard de la dirección)
assert.equal(ve({ role: 'subdirector', direccion: 'asuntos_laborales', subdireccion: 'recursos' }), 'recursos')
assert.equal(ve({ role: 'subdirector', direccion: 'asuntos_laborales', subdireccion: 'litigio' }), 'litigio')
assert.equal(ve({ role: 'subdirector', direccion: 'contratos_convenios', subdireccion: 'convenios' }), 'convenios')
// Subdirector/a sin subdirección capturada: como antes, toda su dirección
assert.equal(ve({ role: 'subdirector', direccion: 'asuntos_laborales' }), 'dal,litigio,recursos')
// La subdirección solo cuenta para Subdirector/a
assert.equal(ve({ role: 'director', direccion: 'asuntos_laborales', subdireccion: 'recursos' }), 'dal,litigio,recursos')
// Otra dirección o sin sesión: nada
assert.equal(ve({ role: 'director', direccion: 'asuntos_hasl' }), '')
assert.equal(ve(null), '')

console.log('permisos: ok')
