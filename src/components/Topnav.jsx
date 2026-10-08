import React, { useState, useRef, useEffect } from 'react'
import BrandLogo from './BrandLogo.jsx'

const ROLE_LABELS = { admin: 'Administrador', ejecutiva: 'Dirección Ejecutiva', director: 'Director(a)', subdirector: 'Subdirector(a)' }

// Menú: "Inicio" + un desplegable por dirección con sus rubros.
export default function Topnav({ direcciones, vista, onNavigate, user, onLogout }) {
  const [abierto, setAbierto] = useState(null)
  const navRef = useRef(null)

  useEffect(() => {
    const cerrar = (e) => { if (!navRef.current?.contains(e.target)) setAbierto(null) }
    const esc = (e) => { if (e.key === 'Escape') setAbierto(null) }
    document.addEventListener('mousedown', cerrar)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', cerrar); document.removeEventListener('keydown', esc) }
  }, [])

  const ir = (v) => { setAbierto(null); onNavigate(v) }

  return (
    <header
      className="bg-white flex items-center px-3 sm:px-4 flex-shrink-0"
      style={{ height: 60, borderBottom: '1px solid #E3DFDA', boxShadow: '0 1px 4px rgba(0,0,0,.05)', zIndex: 40 }}
    >
      <button onClick={() => ir('inicio')} className="flex items-center gap-2.5 flex-shrink-0 pr-3 sm:pr-4"
        style={{ borderRight: '1px solid #E3DFDA' }} title="Inicio">
        <BrandLogo size={28} />
        <div className="hidden sm:block leading-none text-left">
          <p className="text-sm font-black text-ine-purple">INE · DEAJ</p>
          <p className="text-xs text-ine-muted">Seguimiento</p>
        </div>
      </button>

      <nav ref={navRef} className="flex items-center gap-0.5 flex-1 min-w-0 px-1 sm:px-2">
        <NavBtn active={vista === 'inicio'} onClick={() => ir('inicio')} label="Inicio" />
        {direcciones.map(d => (
          <div key={d.key} className="relative flex-shrink-0">
            <NavBtn
              active={d.rubros.some(r => r.vista === vista)}
              onClick={() => setAbierto(a => a === d.key ? null : d.key)}
              label={<><span className="sm:hidden" title={d.label}>{d.corto}</span><span className="hidden sm:inline">{d.label}</span></>}
              hasArrow
              expanded={abierto === d.key}
            />
            {abierto === d.key && (
              <div className="absolute top-full mt-1 left-0 bg-white rounded-lg py-1 z-50"
                style={{ border: '1px solid #E3DFDA', boxShadow: '0 8px 24px rgba(0,0,0,.14)', minWidth: 230 }}>
                {d.rubros.map(r => (
                  <DropItem key={r.vista} active={vista === r.vista} onClick={() => ir(r.vista)}
                    label={r.label} enConstruccion={r.enConstruccion} />
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2 flex-shrink-0 pl-2 sm:pl-3" style={{ borderLeft: '1px solid #E3DFDA' }}>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: '#454247' }} aria-hidden="true">
          {user?.name?.charAt(0)?.toUpperCase()}
        </div>
        <div className="hidden md:block leading-none">
          <p className="text-xs font-semibold text-ine-text truncate max-w-[120px]">{user?.name}</p>
          <p className="text-xs text-ine-dim mt-0.5">{ROLE_LABELS[user?.role] || 'Usuario'}</p>
        </div>
        <button onClick={onLogout} title="Volver al portal" aria-label="Volver al portal"
          className="p-1.5 rounded-lg text-ine-dim hover:text-ine-purple hover:bg-ine-bg transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
        </button>
      </div>
    </header>
  )
}

function NavBtn({ active, onClick, label, hasArrow = false, expanded }) {
  return (
    <button
      onClick={onClick}
      aria-expanded={hasArrow ? !!expanded : undefined}
      className="flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors"
      style={active ? { background: '#454247', color: 'white', fontWeight: 600 } : { color: '#454247' }}
    >
      {label}
      {hasArrow && (
        <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      )}
    </button>
  )
}

function DropItem({ active, onClick, label, enConstruccion }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-left hover:bg-ine-bg transition-colors"
      style={active ? { color: '#000', fontWeight: 700, background: '#F7F5F3' } : { color: '#454247' }}
    >
      <span className="flex-1">{label}</span>
      {enConstruccion && (
        <span className="px-1.5 py-0.5 rounded font-semibold" style={{ fontSize: 10, background: '#DDD4CE', color: '#454247' }}>
          Próximamente
        </span>
      )}
    </button>
  )
}
