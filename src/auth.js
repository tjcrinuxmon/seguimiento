const TOKEN_KEY = 'ine_seguimiento_token'
const USER_KEY  = 'ine_seguimiento_user'

export const getToken = () => localStorage.getItem(TOKEN_KEY)

export function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
}

export function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

// Datos del token (sin verificar la firma: solo para saber si venció y quién es)
export function datosToken(token) {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) } catch { return null }
}
export const vencido = (token) => { const d = datosToken(token); return !d?.exp || d.exp * 1000 <= Date.now() }
// Token renovado por el servidor (X-Nuevo-Token): se guarda con los datos actuales del usuario
export function renovarAuth(token) {
  const { iat, exp, ...usuario } = datosToken(token) || {}
  if (usuario.id) setAuth(token, usuario)
}

// Sesión del portal (mismo dominio, detrás del gateway): para pedirle un pase nuevo sin salir
const PORTAL_TOKEN_KEY = 'ine_portal_token'
const PORTAL_USER_KEY  = 'ine_portal_user'
export const getPortalToken = () => { try { return localStorage.getItem(PORTAL_TOKEN_KEY) } catch { return null } }
export function setPortalAuth(token) {
  const { iat, exp, ...usuario } = datosToken(token) || {}
  if (!usuario.id) return
  localStorage.setItem(PORTAL_TOKEN_KEY, token)
  localStorage.setItem(PORTAL_USER_KEY, JSON.stringify(usuario))
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
