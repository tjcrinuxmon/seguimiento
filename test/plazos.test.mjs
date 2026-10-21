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
// Expediente completo (con inicio): plazos del término y de la sustanciación
const e = { numero: 12, anio: 2026, fecha_recepcion_deaj: '2026-03-14', fecha_notificacion_determinacion: '2026-09-01',
  determinacion: 'inicio', fecha_contestacion: '2026-09-21', fecha_notificacion_alegatos: '2026-10-05',
  fecha_cierre_instruccion: '2026-10-09', fecha_aprobacion_se: '2026-11-30' }
const pl = P.calcularPlazos(e, vacio)
const f = Object.fromEntries(pl.map(x => [x.clave, x.fecha]))
const estado = (k) => pl.find(x => x.clave === k).estado
assert.equal(f.termino, '2026-09-14'); assert.equal(f.acuerdo_listo, '2026-08-14'); assert.equal(f.revision, '2026-08-30')
assert.equal(f.recurso, '2026-09-15')                  // 10 hábiles desde mar 1-sep
assert.equal(f.contestacion, '2026-09-15')             // 10 hábiles desde la notificación del acuerdo de inicio
assert.equal(f.alegatos, '2026-10-12')                 // 5 hábiles desde lun 5-oct (notificación del acuerdo de alegatos)
assert.equal(f.proyecto, '2026-11-13')                 // 25 hábiles desde vie 9-oct (cierre de instrucción)
assert.equal(f.envio_se, '2026-11-27')                 // 10 hábiles después de que vencen los 25
assert.equal(f.notificacion_resolucion, '2026-12-14')  // 10 hábiles desde la firma (lun 30-nov)
assert.equal(estado('termino'), 'cumplido')
assert.equal(estado('contestacion'), 'cumplido')       // las partes ya contestaron (fecha real)
assert.equal(pl.find(x => x.clave === 'contestacion').cuando, '2026-09-21')
assert.equal(pl.find(x => x.clave === 'proyecto').quien, 'deaj')
assert.equal(pl.find(x => x.clave === 'alegatos').quien, 'partes')
assert.equal(P.expedienteClave(e), 'INE/DEAJ/ALI/12/2026')
// Etapa: sustanciación con el paso más avanzado capturado
assert.equal(P.etapaActual(e).clave, 'sustanciacion')
assert.equal(P.etapaActual(e).label, 'Sustanciación: resolución')
assert.equal(P.etapaActual({ ...e, fecha_aprobacion_se: '', fecha_cierre_instruccion: '' }).label, 'Sustanciación: alegatos')
assert.equal(P.etapaActual({ ...e, fecha_notificacion_resolucion: '2026-12-10' }).concluido, true)
// Sin inicio: no hay sustanciación ni sus plazos
for (const det of ['no_inicio', 'sobreseimiento', 'extincion', 'archivo']) {
  const p = P.calcularPlazos({ ...e, determinacion: det }, vacio)
  assert.equal(p.some(x => x.etapa === 'sustanciacion'), false, det)
}
assert.equal(P.etapaActual({ ...e, determinacion: 'no_inicio' }).concluido, true)
assert.equal(P.etapaActual({ ...e, determinacion: 'sobreseimiento' }).label, 'Concluido (sobreseimiento)')
console.log('✓ plazos de Recursos y Consultas')
// Archivo: concluye al notificar el acuerdo, como no inicio
assert.equal(P.etapaActual({ determinacion: 'archivo', fecha_notificacion_determinacion: '2026-10-01' }).label, 'Concluido (archivo)')
