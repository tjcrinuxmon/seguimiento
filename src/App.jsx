import React, { useState, useEffect, useCallback, useMemo } from 'react'
import BrandLogo from './components/BrandLogo.jsx'
import Topnav from './components/Topnav.jsx'
import Inicio from './components/Inicio.jsx'
import EnConstruccion from './components/EnConstruccion.jsx'
import DALView from './components/DALView.jsx'
import ConveniosView from './components/ConveniosView.jsx'
import ConveniosReport from './components/ConveniosReport.jsx'
import LoginPage from './components/LoginPage.jsx'
import { ssoLogin } from './api.js'
import { getToken, getUser, setAuth, clearAuth } from './auth.js'
import { direccionesVisibles, buscarRubro, permisos } from './rubros.js'

// La vista actual va en el hash (#/convenios) para que recargar la página o
// volver atrás en el celular deje al usuario donde estaba.
const vistaDelHash = () => window.location.hash.replace(/^#\/?/, '') || 'inicio'

export default function App() {
  const [token, setToken] = useState(() => getToken())
  const [user, setUser] = useState(() => getUser())
  const [vista, setVista] = useState(vistaDelHash)
  const [ssoLoading, setSsoLoading] = useState(() => !!new URLSearchParams(window.location.search).get('sso_token'))
  const [ssoError, setSsoError] = useState(null)

  // Entrada desde el portal: ?sso_token=…
  useEffect(() => {
    const ssoToken = new URLSearchParams(window.location.search).get('sso_token')
    if (!ssoToken) return
    ssoLogin(ssoToken)
      .then(({ token: t, user: u }) => {
        setAuth(t, u)
        setToken(t)
        setUser(u)
        window.history.replaceState({}, '', window.location.pathname + window.location.hash)
      })
      .catch((e) => setSsoError(e?.response?.data?.error || e.message))
      .finally(() => setSsoLoading(false))
  }, [])

  useEffect(() => {
    const alCambiar = () => setVista(vistaDelHash())
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])

  const navigate = useCallback((v) => {
    window.location.hash = v === 'inicio' ? '' : `/${v}`
    setVista(v)
  }, [])

  const handleLogout = () => {
    clearAuth()
    setToken(null)
    setUser(null)
  }

  const direcciones = useMemo(() => direccionesVisibles(user), [user])

  if (ssoLoading) return (
    <div className="flex items-center justify-center h-screen bg-ine-bg">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-ine-border border-t-ine-purple rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-ine-muted">Verificando acceso…</p>
      </div>
    </div>
  )

  if (ssoError && !token) return (
    <div className="flex items-center justify-center h-screen bg-ine-bg p-4">
      <div className="carga-error" role="alert" style={{ maxWidth: 420 }}>
        <span>No se pudo iniciar sesión: {ssoError}</span>
        <button type="button" onClick={() => window.location.replace('/')}>Volver al portal</button>
      </div>
    </div>
  )

  if (!token || !user) return <LoginPage />

  const p = permisos(user)
  const encontrado = buscarRubro(vista)
  // Una vista que no existe o a la que el usuario no tiene permiso cae al inicio.
  const vistaFinal = encontrado && p[encontrado.rubro.permiso] ? vista : 'inicio'

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-ine-bg">
      <Topnav direcciones={direcciones} vista={vistaFinal} onNavigate={navigate} user={user} onLogout={handleLogout} />

      <main className="flex-1 overflow-auto min-h-0 p-3 sm:p-6">
        {vistaFinal === 'inicio' && <Inicio user={user} direcciones={direcciones} onNavigate={navigate} />}
        {vistaFinal === 'dal-dashboard' && <DALView user={user} dashboardOnly />}
        {vistaFinal === 'litigio' && <DALView user={user} />}
        {vistaFinal === 'dcyc-dashboard' && <ConveniosReport />}
        {vistaFinal === 'convenios' && <ConveniosView user={user} />}
        {encontrado?.rubro.enConstruccion && vistaFinal !== 'inicio' && (
          <EnConstruccion direccion={encontrado.direccion} rubro={encontrado.rubro} onNavigate={navigate} />
        )}
      </main>

      <footer className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-shrink-0" style={{ background: '#454247' }}>
        <div className="flex items-center gap-2 min-w-0">
          <BrandLogo size={16} className="opacity-50" />
          <span className="text-xs font-semibold truncate" style={{ color: 'rgba(255,255,255,.55)' }}>
            INE · DEAJ — Dirección Ejecutiva de Asuntos Jurídicos
          </span>
        </div>
        <span className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,.35)' }}>
          © {new Date().getFullYear()} INE
        </span>
      </footer>
    </div>
  )
}
