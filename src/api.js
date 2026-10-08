import axios from 'axios'
import { getToken, clearAuth } from './auth.js'

const api = axios.create({ baseURL: '/api/seg', timeout: 30000 })

// Barra de progreso superior mientras haya peticiones en curso (ver src/carga.js).
api.interceptors.request.use((config) => {
  window.Carga?.inicio()
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => { window.Carga?.fin(); return res },
  (err) => {
    window.Carga?.fin()
    if (!err.response) err.message = 'Sin conexión con el servidor. Revisa tu señal e intenta de nuevo.'
    if (err.response?.status === 401) {
      clearAuth()
      window.location.reload()
    }
    return Promise.reject(err)
  }
)

export const ssoLogin = (sso_token) => api.post('/auth/sso', { sso_token }).then(r => r.data)

// Usuarios (campo "Responsable" de Convenios)
export const getUsers = () => api.get('/users').then(r => r.data)

// Contratos y Convenios → Convenios
export const getConvenios   = ()         => api.get('/convenios').then(r => r.data)
export const createConvenio = (data)     => api.post('/convenios', data).then(r => r.data)
export const updateConvenio = (id, data) => api.put(`/convenios/${id}`, data).then(r => r.data)
export const deleteConvenio = (id)       => api.delete(`/convenios/${id}`).then(r => r.data)

// Asuntos Laborales → Litigio
export const getDalSection   = (section)           => api.get(`/dal/${section}`).then(r => r.data)
export const createDalRecord = (section, data)     => api.post(`/dal/${section}`, data).then(r => r.data)
export const updateDalRecord = (section, id, data) => api.put(`/dal/${section}/${id}`, data).then(r => r.data)
export const deleteDalRecord = (section, id)       => api.delete(`/dal/${section}/${id}`).then(r => r.data)
