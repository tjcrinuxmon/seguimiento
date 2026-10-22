// Litigio → Sentencias: el plazo y el vencimiento de una sentencia salen de sus conceptos de
// condena (las absoluciones no tienen plazo). Una sentencia anterior sin conceptos conserva su
// plazo y vencimiento generales (plazo, fechaVencimiento) hasta que se migre (migrar-condenas.js).

export const condenasDe = (r) => (Array.isArray(r?.condenas) ? r.condenas : []).filter(f => f.sentido !== 'Absolución')
const tieneConceptos = (r) => Array.isArray(r?.condenas) && r.condenas.length > 0

// Plazos distintos (en días) de la sentencia
export function plazosSentencia(r) {
  const p = tieneConceptos(r) ? condenasDe(r).map(f => f.plazo) : [r?.plazo]
  return [...new Set(p.filter(x => x !== undefined && x !== null && x !== '').map(String))]
}

// Vencimientos distintos de la sentencia, del más próximo al más lejano
export function vencimientosSentencia(r) {
  const v = tieneConceptos(r) ? condenasDe(r).map(f => f.vencimiento) : [r?.fechaVencimiento]
  return [...new Set(v.filter(Boolean))].sort()
}

// El vencimiento que cuenta para las alertas: el más próximo de lo que falta por cumplir; si ya
// se cumplió todo, el último (para saber si la entrega al TEPJF fue a tiempo).
export function venceSentencia(r) {
  if (!tieneConceptos(r)) return r?.fechaVencimiento || null
  const c = condenasDe(r).filter(f => f.vencimiento)
  if (!c.length) return null
  const pendientes = c.filter(f => !f.cumplimiento).map(f => f.vencimiento).sort()
  return pendientes[0] || c.map(f => f.vencimiento).sort().pop()
}

// Sentencia con plazo/vencimiento generales y sin conceptos → un concepto "Condena" con ellos
export function migrarCondenas(r) {
  if (tieneConceptos(r) || !(r.plazo || r.fechaVencimiento)) return null
  const { plazo, fechaVencimiento, ...resto } = r
  return { ...resto, condenas: [{ concepto: '', sentido: 'Condena', plazo: plazo ?? '', vencimiento: fechaVencimiento || '' }] }
}
