// Pruebas del semáforo de plazos (npm test)
import assert from 'node:assert/strict'
import { semaforo } from '../src/semaforo.js'

const e = (desde, vence, hoy) => semaforo(desde, vence, hoy)?.estado

// Plazo de 20 días: del 1 al 21 de marzo
const D = '2026-03-01', V = '2026-03-21'
assert.equal(e(D, V, '2026-03-01'), 'verde')      // 0 %
assert.equal(e(D, V, '2026-03-18'), 'verde')      // 17/20 = 85 % → todavía verde
assert.equal(e(D, V, '2026-03-19'), 'ambar')      // 18/20 = 90 %
assert.equal(e(D, V, '2026-03-20'), 'ambar')      // día anterior
assert.equal(e(D, V, '2026-03-21'), 'hoy')        // el día del vencimiento: rojo
assert.equal(e(D, V, '2026-03-22'), 'vencido')
assert.equal(semaforo(D, V, '2026-03-25').dias, -4)

// Plazo corto (3 días): no alcanza a pasar por ámbar
assert.equal(e('2026-03-02', '2026-03-05', '2026-03-03'), 'verde')   // 33 %
assert.equal(e('2026-03-02', '2026-03-05', '2026-03-04'), 'verde')   // 67 %
assert.equal(e('2026-03-02', '2026-03-05', '2026-03-05'), 'hoy')

// Plazo de 10 días: el día 9 (90 %) ya es ámbar
assert.equal(e('2026-04-01', '2026-04-11', '2026-04-09'), 'verde')   // 80 %
assert.equal(e('2026-04-01', '2026-04-11', '2026-04-10'), 'ambar')   // 90 %

// Sin fecha de inicio: ámbar a 3 días del vencimiento
assert.equal(e(null, '2026-05-10', '2026-05-06'), 'verde')
assert.equal(e(null, '2026-05-10', '2026-05-07'), 'ambar')
assert.equal(e('', '2026-05-10', '2026-05-10'), 'hoy')
// Inicio posterior al vencimiento (dato mal capturado): como sin inicio
assert.equal(e('2026-06-01', '2026-05-10', '2026-05-08'), 'ambar')
// Sin vencimiento
assert.equal(semaforo('2026-01-01', '', '2026-01-05'), null)

console.log('semáforo: ok')
