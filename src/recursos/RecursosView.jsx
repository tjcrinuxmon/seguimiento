import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { getExpedientesRc, getInhabiles, getAbogados } from '../api.js'
import { ETAPAS, calcularPlazos, proximoPlazo, etapaActual, expedienteClave, sumarMeses } from './plazos.js'
import { DETERMINACIONES } from './campos.js'
import { descargarExcel } from './excel.js'
import { EstadoPlazo, fmtFecha } from './ui.jsx'
import Ficha from './Ficha.jsx'
import Inhabiles from './Inhabiles.jsx'
import Abogados from './Abogados.jsx'
import Numeracion from './Numeracion.jsx'
import { FranjaAlertas } from '../components/tablero/Tablero.jsx'
import { UMBRAL_DIAS, calcularRecursos } from '../components/tablero/dal.js'

const DET = Object.fromEntries(DETERMINACIONES.map(d => [d.valor, d.label]))
const VISTA_KEY = 'seguimiento_rc_vista'
const leerVista = () => { try { return localStorage.getItem(VISTA_KEY) || 'tarjetas' } catch { return 'tarjetas' } }

const normalizar = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// Subdirección de Recursos y Consultas: lista de expedientes con su etapa y su próximo
// plazo; al abrir uno se muestra su ficha.
export default function RecursosView({ user, onDashboard }) {
  const [expedientes, setExpedientes] = useState(null)
  const [diasInhabiles, setDiasInhabiles] = useState([])
  const [abogados, setAbogados] = useState([])
  const [verAbogados, setVerAbogados] = useState(false)
  const [verNumeracion, setVerNumeracion] = useState(false)
  const [error, setError] = useState(null)
  const [abierto, setAbierto] = useState(null)       // expediente en la ficha ({} = nuevo)
  const [verInhabiles, setVerInhabiles] = useState(false)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('')            // '', 'vencido', 'por_vencer'
  const [etapaFiltro, setEtapaFiltro] = useState('')
  const [vista, setVista] = useState(leerVista)      // 'tarjetas' | 'tabla' (se recuerda en este navegador)
  const cambiarVista = (v) => { setVista(v); try { localStorage.setItem(VISTA_KEY, v) } catch {} }

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
      .filter(x => !t || normalizar([x.clave, x.abogado, x.denunciante_nombre, x.denunciado_nombre, x.denunciado_adscripcion, x.conducta].join(' ')).includes(t))
      .filter(x => !filtro || (filtro === 'vencido' ? x.vencidos > 0 : x.proximo?.estado === 'por_vencer'))
      .filter(x => !etapaFiltro || x.etapa.clave === etapaFiltro)
      .sort((a, b) => (a.proximo?.dias ?? 1e9) - (b.proximo?.dias ?? 1e9))
  }, [filas, q, filtro, etapaFiltro])

  // Mismo conteo que el dashboard: plazos de la DEAJ vencidos y por vencer
  const alertas = useMemo(() => expedientes && calcularRecursos(expedientes, inhabiles), [expedientes, inhabiles])

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
      {!error && (
        <FranjaAlertas vencidos={alertas ? alertas.vencidos : null} porVencer={alertas?.porVencer}
          umbral={UMBRAL_DIAS} onAbrir={onDashboard} />
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-ine-text">Expedientes</h1>
          <p className="text-sm text-ine-muted mt-0.5">
            {expedientes ? `${filas.length} expedientes` : 'Cargando…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline" style={{ fontSize: 13 }} onClick={() => setVerNumeracion(v => !v)}>
            Numeración
          </button>
          <button type="button" className="btn-outline" style={{ fontSize: 13 }} onClick={() => setVerAbogados(v => !v)}>
            Abogados
          </button>
          <button type="button" className="btn-outline" style={{ fontSize: 13 }} onClick={() => setVerInhabiles(v => !v)}>
            Días inhábiles
          </button>
          <button type="button" className="btn-ine" style={{ fontSize: 13 }} onClick={() => setAbierto({})}>+ Nuevo expediente</button>
        </div>
      </div>

      {verNumeracion && (
        <Numeracion puedeEditar={user?.role === 'admin'} onCerrar={() => setVerNumeracion(false)} />
      )}
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
        <input type="search" className="ine-input flex-1 min-w-[200px]" placeholder="Buscar expediente, abogado, denunciante, denunciado o adscripción…"
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
        <div className="flex rounded-lg overflow-hidden" role="group" aria-label="Vista" style={{ border: '1.5px solid #E3DFDA' }}>
          {[['tarjetas', 'Tarjetas'], ['tabla', 'Tabla']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => cambiarVista(v)} aria-pressed={vista === v}
              className="px-3 text-xs font-semibold"
              style={vista === v ? { background: '#454247', color: '#fff' } : { background: '#fff', color: '#454247' }}>{l}</button>
          ))}
        </div>
        <button type="button" className="btn-outline" style={{ fontSize: 13 }} disabled={!visibles.length}
          title="Descarga los expedientes de la lista (con los filtros aplicados), con todos sus campos, oficios y plazos"
          onClick={() => descargarExcel(visibles, { abogados, inhabiles })}>↓ Excel</button>
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

      {visibles.length > 0 && vista === 'tabla' && (
        <div className="ine-card overflow-x-auto">
          <table className="w-full text-xs" style={{ borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead>
              <tr style={{ background: '#F7F5F3' }}>
                {['Expediente', 'Abogado', 'Recepción DEAJ', 'Término', 'Denunciante', 'Denunciado', 'Adscripción del denunciado', 'Determinación', 'Etapa', 'Próximo plazo'].map(h => (
                  <th key={h} className="text-left font-bold text-ine-muted px-3 py-2.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map(x => (
                <tr key={x.id} onClick={() => setAbierto(x)} tabIndex={0}
                  onKeyDown={ev => { if (ev.key === 'Enter') setAbierto(x) }}
                  className="cursor-pointer hover:bg-ine-bg focus:bg-ine-bg" style={{ borderTop: '1px solid #EDEAE6' }}>
                  <td className="px-3 py-2.5 font-bold text-ine-text whitespace-nowrap"
                    style={{ borderLeft: `4px solid ${x.vencidos ? '#991B1B' : x.proximo?.estado === 'por_vencer' ? '#D97706' : 'transparent'}` }}>{x.clave}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{x.abogado || '—'}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{fmtFecha(x.fecha_recepcion_deaj)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{fmtFecha(sumarMeses(x.fecha_recepcion_deaj, 6))}</td>
                  <td className="px-3 py-2.5">{x.denunciante_nombre || '—'}</td>
                  <td className="px-3 py-2.5">{x.denunciado_nombre || '—'}</td>
                  <td className="px-3 py-2.5">{x.denunciado_adscripcion || '—'}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{DET[x.determinacion] || '—'}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: x.etapa.concluido ? '#828A91' : '#454247' }}>{x.etapa.label}</td>
                  <td className="px-3 py-2.5">
                    {x.proximo ? (
                      <span className="flex flex-col items-start gap-1">
                        <EstadoPlazo plazo={x.proximo} />
                        <span className="text-ine-muted whitespace-nowrap">{x.proximo.label} · {fmtFecha(x.proximo.fecha)}</span>
                      </span>
                    ) : <span className="text-ine-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visibles.length > 0 && vista === 'tarjetas' && (
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
