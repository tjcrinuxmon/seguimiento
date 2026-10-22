// Sesión de Seguimiento (vence tras 8 h sin actividad; el servidor la renueva con el uso).
// Si vence, se pide un pase nuevo al portal por detrás (su sesión vive en el mismo dominio,
// detrás del gateway) y se sigue donde se estaba; solo si el portal también venció se manda a
// iniciar sesión, y después el portal regresa a esta misma pantalla (?ir=tareas2&ruta=#/…).
import { setAuth, clearAuth, vencido, getPortalToken, setPortalAuth } from './auth.js'

const APP_PORTAL = 'tareas2'          // nombre de Seguimiento en el SSO del portal
const PING_PORTAL = 15 * 60 * 1000    // renovar la sesión del portal a lo más cada 15 min

// URL del portal (en desarrollo, Seguimiento corre en otro puerto)
export const urlPortal = () => import.meta.env.VITE_PORTAL_URL || window.location.origin.replace(/:(3009|5176)$/, ':3000')

let renovando = null
// Pase nuevo del portal → sesión nueva aquí. true si se pudo; varias llamadas a la vez comparten el intento.
export function renovarConPortal() {
  if (!renovando) {
    renovando = (async () => {
      const pt = getPortalToken()
      if (!pt || vencido(pt)) return false
      const r = await fetch('/api/sso/' + APP_PORTAL, { headers: { Authorization: `Bearer ${pt}` } })
      if (!r.ok) return false
      const nuevoPortal = r.headers.get('x-nuevo-token')
      if (nuevoPortal) setPortalAuth(nuevoPortal)
      const { token: sso } = await r.json()
      const s = await fetch('/api/seg/auth/sso', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sso_token: sso }),
      })
      if (!s.ok) return false
      const { token, user } = await s.json()
      setAuth(token, user)
      return true
    })().catch(() => false)
    renovando.finally(() => { renovando = null })
  }
  return renovando
}

// Mientras se trabaja aquí, también se mantiene viva la sesión del portal
let ultimoPing = 0
export function mantenerPortal() {
  const pt = getPortalToken()
  if (!pt || vencido(pt) || Date.now() - ultimoPing < PING_PORTAL) return
  ultimoPing = Date.now()
  fetch('/api/auth/me', { headers: { Authorization: `Bearer ${pt}` } })
    .then(r => { const n = r.headers.get('x-nuevo-token'); if (n) setPortalAuth(n) })
    .catch(() => {})
}

// Iniciar sesión en el portal y volver a esta pantalla
export function irAlPortal() {
  clearAuth()
  window.location.replace(`${urlPortal()}/?ir=${APP_PORTAL}&ruta=${encodeURIComponent(window.location.hash)}`)
}
