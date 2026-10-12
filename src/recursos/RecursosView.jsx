import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { getExpedientesRc, getInhabiles, getAbogados } from '../api.js'
import { ETAPAS, calcularPlazos, proximoPlazo, etapaActual, expedienteClave } from './plazos.js'
import { EstadoPlazo, fmtFecha } from './ui.jsx'
import Ficha from './Ficha.jsx'
import Inhabiles from './Inhabiles.jsx'
import Abogados from './Abogados.jsx'

const normalizar = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// Subdirección de Recursos y Consultas: lista de expedientes con su etapa y su próximo
// plazo; al abrir uno se muestra su ficha.
export default function RecursosView({ user }) {
  const [expedientes, setExpedientes] = useState(null)
  const [diasInhabiles, setDiasInhabiles] = useState([])
  const [abogados, setAbogados] = useState([])
  const [verAbogados, setVerAbogados] = useState(false)
  const [error, setError] = useState(null)
  const [abierto, setAbierto] = useState(null)       // expediente en la ficha ({} = nuevo)
  const [verInhabiles, setVerInhabiles] = useState(false)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('')            // '', 'vencido', 'por_vencer'
  const [etapaFiltro, setEtapaFiltro] = useState('')

  const cargar = useCallback(async () => {
    setError(null)
    try {
      const [exps, inh, abg] = await Promise.all([getExpedientesRc(), getInhabiles(), getAbogados('recursos')])
      setExpedientes(exps); setDiasInhabiles(inh); setAbogados(abg)
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const inhabiles = useMemo(() => new Set(diasInhabiles.map(d => d.fecha)), [diasInhabiles])

  const filas = useMemo(() => (expedientes || []).map(x => {
    const plazos = calcularPlazos(x, inhabiles)
    return { ...x, clave: expedienteClave(x), etapa: etapaActual(x), proximo: proximoPlazo(plazos),
      vencidos: plazos.filter(p => p.estado === 'vencido').length }
  }), [expedientes, inhabiles])

  const visibles = useMemo(() => {
    const t = normalizar(q.trim())
    return filas
      .filter(x => !t || normalizar([x.clave, x.abogado, x.denunciante_nombre, x.denunciado_nombre, x.conducta].join(' ')).includes(t))
      .filter(x => !filtro || (filtro === 'vencido' ? x.vencidos > 0 : x.proximo?.estado === 'por_vencer'))
      .filter(x => !etapaFiltro || x.etapa.clave === etapaFiltro)
      .sort((a, b) => (a.proximo?.dias ?? 1e9) - (b.proximo?.dias ?? 1e9))
  }, [filas, q, filtro, etapaFiltro])

  const totales = useMemo(() => ({
    vencidos: filas.filter(x => x.vencidos > 0).length,
    porVencer: filas.filter(x => x.proximo?.estado === 'por_vencer').length,
  }), [filas])

  if (abierto) {
    return (
      <Ficha
        key={abierto.id || 'nuevo'}
        expediente={abierto.id ? abierto : null}
        inhabiles={inhabiles}
        abogados={abogados}
        user={user}
        onCerrar={() => setAbierto(null)}
        onGuardado={(r) => setExpedientes(xs => [r, ...(xs || []).filter(x => x.id !== r.id)])}
        onEliminado={(id) => { setExpedientes(xs => xs.filter(x => x.id !== id)); setAbierto(null) }}
      />
    )
  }

  return (
    <div className="fade-in max-w-6xl mx-auto flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-ine-text">Expedientes</h1>
          <p className="text-sm text-ine-muted mt-0.5">
            {expedientes ? `${filas.length} expedientes` : 'Cargando…'}
            {totales.vencidos > 0 && <> · <strong style={{ color: '#991B1B' }}>{totales.vencidos} con plazo vencido</strong></>}
            {totales.porVencer > 0 && <> · <strong style={{ color: '#92400E' }}>{totales.porVencer} por vencer</strong></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline" style={{ fontSize: 13 }} onClick={() => setVerAbogados(v => !v)}>
            Abogados
          </button>
          <button type="button" className="btn-outline" style={{ fontSize: 13 }} onClick={() => setVerInhabiles(v => !v)}>
            Días inhábiles
          </button>
          <button type="button" className="btn-ine" style={{ fontSize: 13 }} onClick={() => setAbierto({})}>+ Nuevo expediente</button>
        </div>
      </div>

      {verAbogados && (
        <Abogados subdireccion="recursos" abogados={abogados} puedeEditar={user?.role === 'admin'} onCambio={cargar} onCerrar={() => setVerAbogados(false)} />
      )}
      {verInhabiles && (
        <Inhabiles dias={diasInhabiles} puedeEditar={user?.role === 'admin'} onCambio={cargar} onCerrar={() => setVerInhabiles(false)} />
      )}

      {error && (
        <div className="carga-error" role="alert">
          <span>No se pudieron cargar los expedientes: {error}</span>
          <button type="button" onClick={cargar}>Reintentar</button>
        </div>
      )}

      <div className="ine-card p-3 flex flex-wrap gap-2">
        <input type="search" className="ine-input flex-1 min-w-[200px]" placeholder="Buscar expediente, abogado, denunciante o denunciado…"
          aria-label="Buscar" value={q} onChange={e => setQ(e.target.value)} />
        <select className="ine-input" style={{ width: 'auto' }} aria-label="Plazos" value={filtro} onChange={e => setFiltro(e.target.value)}>
          <option value="">Todos los plazos</option>
          <option value="vencido">Con plazo vencido</option>
          <option value="por_vencer">Por vencer</option>
        </select>
        <select className="ine-input" style={{ width: 'auto' }} aria-label="Etapa" value={etapaFiltro} onChange={e => setEtapaFiltro(e.target.value)}>
          <option value="">Todas las etapas</option>
          {ETAPAS.map(et => <option key={et.clave} value={et.clave}>{et.label}</option>)}
        </select>
      </div>

      {!expedientes && !error && <div className="ine-card p-5" dangerouslySetInnerHTML={{ __html: window.Carga?.lineas(6) || 'Cargando…' }} />}

      {expedientes && visibles.length === 0 && (
        <div className="ine-card p-8 text-center">
          <p className="text-sm text-ine-text font-semibold">
            {filas.length ? 'Ningún expediente coincide con la búsqueda.' : 'Aún no hay expedientes.'}
          </p>
          {!filas.length && <p className="text-xs text-ine-muted mt-1">Crea el primero con «Nuevo expediente».</p>}
        </div>
      )}

      {visibles.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {visibles.map(x => (
            <li key={x.id}>
              <button type="button" onClick={() => setAbierto(x)}
                className="w-full text-left ine-card px-4 py-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-[1.3fr_1.6fr_1fr_1.3fr] items-center hover:bg-ine-bg transition-colors"
                style={{ borderLeft: `4px solid ${x.vencidos ? '#991B1B' : x.proximo?.estado === 'por_vencer' ? '#D97706' : '#828A91'}` }}>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ine-text truncate">{x.clave}</span>
                  <span className="block text-xs text-ine-muted truncate">{x.abogado || 'Sin abogado asignado'}</span>
                </span>
                <span className="min-w-0 text-xs" style={{ color: '#454247' }}>
                  <span className="block truncate"><span className="text-ine-muted">Denuncia: </span>{x.denunciante_nombre || '—'}</span>
                  <span className="block truncate"><span className="text-ine-muted">Denunciado: </span>{x.denunciado_nombre || '—'}</span>
                </span>
                <span className="text-xs font-semibold" style={{ color: x.etapa.concluido ? '#828A91' : '#454247' }}>{x.etapa.label}</span>
                <span className="min-w-0 text-xs flex flex-col items-start gap-1">
                  {x.proximo ? (
                    <>
                      <EstadoPlazo plazo={x.proximo} />
                      <span className="text-ine-muted truncate max-w-full">{x.proximo.label} · {fmtFecha(x.proximo.fecha)}</span>
                    </>
                  ) : <span className="text-ine-muted">{x.etapa.concluido ? 'Sin plazos pendientes' : 'Sin plazos calculados'}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
