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

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
