// Pruebas de las reglas de plazos de Recursos y Consultas (npm test).
import assert from 'node:assert/strict'
import * as P from '../src/recursos/plazos.js'
const vacio = new Set()
// Meses: mismo día, y fin de mes
assert.equal(P.sumarMeses('2026-03-14', 6), '2026-09-14')
assert.equal(P.sumarMeses('2026-08-31', 6), '2027-02-28')
assert.equal(P.sumarMeses('2026-03-31', 6), '2026-09-30')
assert.equal(P.sumarMeses('2026-09-14', -1), '2026-08-14')
// Hábiles: vie 9-oct-2026 + 1 hábil = lun 12; + 5 = vie 16
assert.equal(P.sumarHabiles('2026-10-09', 1, vacio), '2026-10-12')
assert.equal(P.sumarHabiles('2026-10-09', 5, vacio), '2026-10-16')
// Con inhábil el lunes 12: + 1 = martes 13
assert.equal(P.sumarHabiles('2026-10-09', 1, new Set(['2026-10-12'])), '2026-10-13')
// 10 hábiles desde jue 1-oct = jue 15-oct
assert.equal(P.sumarHabiles('2026-10-01', 10, vacio), '2026-10-15')
// Expediente completo
const e = { numero: 12, anio: 2026, fecha_recepcion_deaj: '2026-03-14', fecha_notificacion_determinacion: '2026-09-01',
  determinacion: 'inicio', fecha_contestacion: '2026-09-21', oficios_alegatos: [{ fecha_envio: '2026-10-01' }, { fecha_envio: '2026-10-05' }],
  fecha_cierre_instruccion: '2026-10-09' }
const pl = P.calcularPlazos(e, vacio)
const f = Object.fromEntries(pl.map(x => [x.clave, x.fecha]))
assert.equal(f.termino, '2026-09-14'); assert.equal(f.acuerdo_listo, '2026-08-14'); assert.equal(f.revision, '2026-08-30')
assert.equal(f.recurso, '2026-09-15')            // 10 hábiles desde mar 1-sep
assert.equal(f.acuerdo_admision, '2026-10-01')   // 8 hábiles desde lun 21-sep
assert.equal(f.alegatos, '2026-10-12')           // 5 hábiles desde lun 5-oct (último envío)
assert.equal(f.resolucion, '2026-11-13')         // 25 hábiles desde vie 9-oct
assert.equal(pl.find(x => x.clave === 'termino').estado, 'cumplido')
assert.equal(pl.find(x => x.clave === 'acuerdo_admision').estado, 'vencido')
assert.equal(P.expedienteClave(e), 'INE/DEAJ/ALI/12/2026')
// No inicio: sin plazos de pruebas
assert.equal(P.calcularPlazos({ ...e, determinacion: 'no_inicio' }, vacio).some(x => x.clave === 'acuerdo_admision'), false)
assert.equal(P.etapaActual({ ...e, determinacion: 'no_inicio' }).concluido, true)
console.log('✓ plazos de Recursos y Consultas')
// Sobreseimiento: concluye como no inicio / extinción y no genera plazos de pruebas
assert.equal(P.etapaActual({ ...e, determinacion: 'sobreseimiento' }).label, 'Concluido (sobreseimiento)')
assert.equal(P.calcularPlazos({ ...e, determinacion: 'sobreseimiento' }, vacio).some(x => x.clave === 'resolucion'), false)
// Archivo: concluye al notificar el acuerdo, como no inicio
assert.equal(P.etapaActual({ determinacion: 'archivo', fecha_notificacion_determinacion: '2026-10-01' }).label, 'Concluido (archivo)')
