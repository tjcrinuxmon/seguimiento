// Semáforo de los plazos (DAL, 2026-10). Se mide qué parte del plazo ya transcurrió, desde que
// empieza a correr (`desde`: notificación, emplazamiento, recepción…) hasta el vencimiento:
//   verde   hasta el 85 % del tiempo
//   ámbar   del 86 % hasta el día anterior al vencimiento
//   rojo    el día del vencimiento ("vence hoy") y después ("vencido")
// Si no se sabe cuándo empezó a correr, ámbar a partir de 3 días antes del vencimiento.
// Funciones puras (sin React) para poder probarlas por separado.

export const PORCENTAJE_AMBAR = 0.85
export const DIAS_AMBAR_SIN_INICIO = 3

const valida = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso || '')
const aDia = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000 }
const hoyLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Estado de un plazo pendiente: { estado: 'vencido' | 'hoy' | 'ambar' | 'verde', dias, pct } (null sin vencimiento)
export function semaforo(desde, vence, hoy = hoyLocal()) {
  if (!valida(vence)) return null
  const dias = aDia(vence) - aDia(hoy)
  if (dias < 0) return { estado: 'vencido', dias, pct: null }
  if (dias === 0) return { estado: 'hoy', dias, pct: null }
  if (valida(desde) && aDia(desde) < aDia(vence)) {
    const pct = (aDia(hoy) - aDia(desde)) / (aDia(vence) - aDia(desde))
    return { estado: pct > PORCENTAJE_AMBAR ? 'ambar' : 'verde', dias, pct }
  }
  return { estado: dias <= DIAS_AMBAR_SIN_INICIO ? 'ambar' : 'verde', dias, pct: null }
}

// Colores del semáforo (texto, fondo, borde)
export const COLORES = {
  vencido: { texto: '#991B1B', fondo: '#FEF2F2', borde: '#FCA5A5' },
  hoy:     { texto: '#FFFFFF', fondo: '#DC2626', borde: '#DC2626' },
  ambar:   { texto: '#92400E', fondo: '#FFFBEB', borde: '#FCD34D' },
  verde:   { texto: '#065F46', fondo: '#ECFDF5', borde: '#A7F3D0' },
}
