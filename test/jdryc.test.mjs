// Pruebas de la limpieza del Excel JDRYC (npm test). Casos tomados del Excel real.
import assert from 'node:assert/strict'
import * as J from '../scripts/jdryc.js'

const f = (v, o) => J.fechaDe(v, o)?.fecha ?? null

// Números de serie (celdas con fecha de Excel, o el número escrito como texto)
assert.equal(f(46087), '2026-03-06')
assert.equal(f('46288'), '2026-09-23')
assert.equal(f(21948722), null)                       // un ID SAI no es fecha
// d/m/aaaa (México); m/d solo si el "día" pasa de 12
assert.equal(f('15/01/2026 ante la JLE en Chihuahua'), '2026-01-15')
assert.equal(f('2/01/2026 ante la JLE en Jalisco'), '2026-01-02')
assert.equal(f('1/21/26'), '2026-01-21')
assert.equal(f('07-10-2026 FONDO'), '2026-10-07')
assert.equal(f('08/04/2026 \r\n+ 2 días\r\n10/04/2026'), '2026-04-08')
assert.equal(f('05/06/206'), '2026-06-05')            // al año le faltó un dígito
// Con el mes en letra
assert.equal(f('07 de enero 2026'), '2026-01-07')
assert.equal(f('20 DE MARZO DE 2026'), '2026-03-20')
assert.equal(f('17 de junio de 2026'), '2026-06-17')
assert.equal(f('5 demarzo'), null)                    // sin año: solo si se indica uno
assert.equal(f('5 demarzo', { anio: 2026 }), '2026-03-05')
assert.equal(J.fechaDe('5 demarzo', { anio: 2026 }).sinAnio, true)
assert.equal(f('23-Sep-26'), '2026-09-23')
assert.equal(f('1-Apr', { anio: 2026 }), '2026-04-01')
// Lo que no es fecha
assert.equal(f('EN TRÁMITE'), null)
assert.equal(f('N/A'), null)
assert.equal(f('INE/DEAJ/1018/2026'), null)
assert.equal(f('Respuesta INE/DEAJ/1794/2026'), null)

// Oficio y fecha juntos
assert.deepEqual(J.oficioYFecha('INE/DEAJ/1018/2026 \r\nde 16/01/2026'), { oficio: 'INE/DEAJ/1018/2026\nde 16/01/2026', fecha: '2026-01-16', sinAnio: false })
assert.deepEqual(J.oficioYFecha('1/16/26'), { oficio: '', fecha: '2026-01-16', sinAnio: false })
assert.deepEqual(J.oficioYFecha(46087), { oficio: '', fecha: '2026-03-06', sinAnio: false })
assert.deepEqual(J.oficioYFecha('Respuesta INE/DEAJ/1541/2026'), { oficio: 'Respuesta INE/DEAJ/1541/2026', fecha: null, sinAnio: false })

// Estatus y parte
assert.equal(J.estatusDe('Concluida'), 'CONCLUIDO')
assert.equal(J.estatusDe('En trámite'), 'EN TRÁMITE')
assert.equal(J.estatusDe(''), '')
assert.equal(J.estatusDe('Otro'), null)
assert.equal(J.parteDe('PARTE INFRACTORA'), 'Infractor')
assert.equal(J.parteDe('PARTE DENUNCIANTE / INFRACTOR'), 'Denunciante / Infractor')
assert.equal(J.parteDe('Denunciante'), 'Denunciante')

// Abogados
assert.deepEqual(J.abogadosDe('Gibrán \r\nIrene \r\nAmérica'), { nombres: ['Gibrán', 'Irene', 'América'], conF: false })
assert.deepEqual(J.abogadosDe('América y Nicolás'), { nombres: ['América', 'Nicolás'], conF: false })
assert.deepEqual(J.abogadosDe('América-Nicolás'), { nombres: ['América', 'Nicolás'], conF: false })
assert.deepEqual(J.abogadosDe('Luis Carlos/Irene F'), { nombres: ['Luis Carlos', 'Irene'], conF: true })
assert.deepEqual(J.abogadosDe('América f'), { nombres: ['América'], conF: true })
assert.equal(J.claveNombre('AMÉRICA'), J.claveNombre('America'))
assert.equal(J.nombreCanonico(new Map([['Jarin', 5], ['Jarín', 1]])), 'Jarín')
assert.equal(J.nombreCanonico(new Map([['IRENE', 2], ['Irene', 9]])), 'Irene')
assert.equal(J.nombreCanonico(new Map([['AMÉRICA', 2], ['America', 1], ['América', 80]])), 'América')

console.log('jdryc: ok')
