import React, { useEffect, useMemo, useState } from 'react'
import { createExpedienteRc, updateExpedienteRc, deleteExpedienteRc, getSiguienteRc } from '../api.js'
import { SECCIONES } from './campos.js'
import { ETAPAS, calcularPlazos, etapaActual, expedienteClave } from './plazos.js'
import { EstadoPlazo, fmtFecha } from './ui.jsx'

const ANCHO = { sm: 'sm:col-span-1', md: 'sm:col-span-1', lg: 'sm:col-span-2', completo: 'sm:col-span-2 lg:col-span-3' }

function Campo({ def, valor, onChange, plazo, sugerencias, idBase, abogados }) {
  const id = `${idBase}-${def.k}`
  const comun = { id, className: 'ine-input', value: valor ?? '', onChange: e => onChange(e.target.value) }
  let control
  if (def.tipo === 'area') control = <textarea {...comun} rows={2} style={{ resize: 'vertical' }} />
  else if (def.tipo === 'abogado') control = (
    // Solo los activos, más el que ya tenga asignado aunque se haya dado de baja
    <select {...comun} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">— Sin asignar —</option>
      {(abogados || []).filter(a => a.activo || a.id === Number(valor)).map(a => (
        <option key={a.id} value={a.id}>{a.nombre}{a.activo ? '' : ' (inactivo)'}</option>
      ))}
    </select>
  )
  else if (def.tipo === 'opcion') control = (
    <select {...comun}>
      <option value="">— Selecciona —</option>
      {def.opciones.map(o => <option key={o.valor} value={o.valor}>{o.label}</option>)}
    </select>
  )
  else control = (
    <input {...comun} type={def.tipo === 'fecha' ? 'date' : def.tipo === 'numero' ? 'number' : 'text'}
      min={def.tipo === 'numero' ? 1 : undefined} list={sugerencias ? `${id}-sug` : undefined} />
  )
  return (
    <div className={ANCHO[def.ancho] || ''}>
      <label htmlFor={id} className="ine-label">
        {def.label}{def.requerido && <span className="ine-required" aria-hidden="true">*</span>}
      </label>
      {control}
      {sugerencias && <datalist id={`${id}-sug`}>{sugerencias.map(s => <option key={s} value={s} />)}</datalist>}
      {plazo && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ine-muted">
          Límite: <strong className="text-ine-text">{fmtFecha(plazo.fecha)}</strong> <EstadoPlazo plazo={plazo} />
        </p>
      )}
      {def.ayuda && !plazo && <p className="mt-1 text-xs text-ine-muted">{def.ayuda}</p>}
    </div>
  )
}

// Lista editable de renglones (requerimientos, oficios, pruebas…)
function Lista({ def, filas = [], onChange, plazo, idBase }) {
  const set = (i, k, v) => onChange(filas.map((f, j) => (j === i ? { ...f, [k]: v } : f)))
  const quitar = (i) => onChange(filas.filter((_, j) => j !== i))
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h4 className="text-sm font-bold text-ine-text">{def.titulo}</h4>
        <span className="text-xs text-ine-muted">({filas.length})</span>
        {plazo && <span className="text-xs text-ine-muted flex items-center gap-1.5">· Hasta {fmtFecha(plazo.fecha)} <EstadoPlazo plazo={plazo} /></span>}
      </div>
      <div className="flex flex-col gap-3">
        {filas.map((f, i) => (
          <div key={i} className="rounded-lg p-3" style={{ background: '#FBFAF8', border: '1px solid #EDEAE6' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-ine-muted">{def.titulo} {i + 1}</span>
              <button type="button" onClick={() => quitar(i)} className="text-xs font-semibold px-2 py-1 rounded hover:bg-ine-bg"
                style={{ color: '#991B1B' }} aria-label={`Quitar ${def.titulo.toLowerCase()} ${i + 1}`}>Quitar</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {def.columnas.map(c => (
                <Campo key={c.k} def={c} valor={f[c.k]} onChange={v => set(i, c.k, v)} idBase={`${idBase}-${def.k}-${i}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn-outline mt-3" style={{ fontSize: 12, padding: '6px 12px' }}
        onClick={() => onChange([...filas, {}])}>+ {def.nuevo}</button>
    </div>
  )
}

export default function Ficha({ expediente, inhabiles, abogados, user, onCerrar, onGuardado, onEliminado }) {
  const nuevo = !expediente?.id
  const [e, setE] = useState(() => expediente || {})
  const [sucio, setSucio] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  // Expediente nuevo: mostrar el número que se le asignará (del año de recepción en la DEAJ)
  const anioPrevisto = /^\d{4}/.test(e.fecha_recepcion_deaj || '') ? Number(e.fecha_recepcion_deaj.slice(0, 4)) : new Date().getFullYear()
  const [previsto, setPrevisto] = useState(null)
  useEffect(() => {
    if (!nuevo) return
    let vigente = true
    getSiguienteRc(anioPrevisto).then(r => { if (vigente) setPrevisto(r) }).catch(() => {})
    return () => { vigente = false }
  }, [nuevo, anioPrevisto])
  const claveMostrada = nuevo
    ? (previsto ? `INE/DEAJ/ALI/${previsto.numero}/${previsto.anio}` : 'Expediente nuevo')
    : expedienteClave(e)

  // Avisar si se intenta salir con cambios sin guardar
  useEffect(() => {
    if (!sucio) return
    const h = (ev) => { ev.preventDefault(); ev.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [sucio])

  const set = (k, v) => { setE(x => ({ ...x, [k]: v })); setSucio(true); setAviso(null) }
  const plazos = useMemo(() => calcularPlazos(e, inhabiles), [e, inhabiles])
  const plazoDe = (clave) => plazos.find(p => p.clave === clave)
  const etapa = etapaActual(e)
  const nombreAbogado = abogados.find(a => a.id === Number(e.abogado_id))?.nombre
  const esInicio = e.determinacion === 'inicio'

  const guardar = async () => {
    setGuardando(true); setError(null)
    try {
      const r = nuevo ? await createExpedienteRc(e) : await updateExpedienteRc(e.id, e)
      setE(r); setSucio(false); setAviso(`Guardado a las ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`)
      onGuardado(r)
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setGuardando(false)
    }
  }

  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const borrar = async () => {
    try { await deleteExpedienteRc(e.id); onEliminado(e.id) }
    catch (err) { setError(err?.response?.data?.error || err.message) }
  }

  const cerrar = () => {
    if (sucio && !window.confirm('Hay cambios sin guardar. ¿Salir sin guardarlos?')) return
    onCerrar()
  }

  const secciones = SECCIONES.filter(s => !s.soloInicio || esInicio)
  const etapasOcultas = !esInicio && ETAPAS.some(x => x.soloInicio)

  return (
    <div className="fade-in max-w-5xl mx-auto flex flex-col gap-4 pb-24">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button type="button" onClick={cerrar} className="text-xs text-ine-muted hover:underline">← Expedientes</button>
          <h1 className="text-lg sm:text-xl font-bold text-ine-text mt-1">{claveMostrada}</h1>
          <p className="text-sm text-ine-muted mt-0.5">
            {etapa.label}{nombreAbogado ? ` · ${nombreAbogado}` : ''}
          </p>
        </div>
        {!nuevo && user?.role === 'admin' && (
          confirmarBorrar ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-ine-text">¿Eliminar este expediente?</span>
              <button type="button" className="btn-ine" style={{ background: '#991B1B', fontSize: 12, padding: '6px 12px' }} onClick={borrar}>Eliminar</button>
              <button type="button" className="btn-outline" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setConfirmarBorrar(false)}>Cancelar</button>
            </div>
          ) : (
            <button type="button" className="text-xs font-semibold px-2 py-1 rounded hover:bg-ine-bg" style={{ color: '#991B1B' }}
              onClick={() => setConfirmarBorrar(true)}>Eliminar expediente</button>
          )
        )}
      </div>

      {/* Plazos calculados */}
      <section className="ine-card p-4 sm:p-5">
        <h2 className="text-sm font-bold text-ine-text">Plazos</h2>
        {plazos.length === 0 ? (
          <p className="text-sm text-ine-muted mt-2">Captura la fecha de recepción en la DEAJ para calcular el término de 6 meses.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {plazos.map(p => (
              <li key={p.clave} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm py-1.5"
                style={{ borderTop: '1px solid #EDEAE6' }}>
                <span className="min-w-0" style={{ color: p.estado === 'cumplido' || p.estado === 'concluido' ? '#828A91' : '#000' }}>
                  {p.label}
                  {p.quien === 'partes' && <span className="text-xs text-ine-muted"> · corre para las partes</span>}
                  {p.nota && <span className="block text-xs" style={{ color: '#92400E' }}>{p.nota}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-ine-muted">{fmtFecha(p.fecha)}</span>
                  <EstadoPlazo plazo={p} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Etapas */}
      {secciones.map((s, i) => {
        const n = ETAPAS.findIndex(x => x.clave === s.etapa) + 1
        const anterior = secciones[i - 1]
        return (
          <section key={s.titulo} className="ine-card p-4 sm:p-5">
            {(!anterior || anterior.etapa !== s.etapa) && (
              <p className="text-xs font-semibold mb-1" style={{ color: '#8A6E4B' }}>
                Etapa {n} · {ETAPAS[n - 1].label}
              </p>
            )}
            <h3 className="text-base font-bold text-ine-text">{s.titulo}</h3>
            {s.nota && <p className="text-xs text-ine-muted mt-0.5">{s.nota}</p>}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
              {i === 0 && (
                <div>
                  <span className="ine-label">Expediente</span>
                  <p className="ine-input" style={{ background: '#F7F5F3', color: '#000', fontWeight: 700 }} aria-readonly="true">
                    {claveMostrada}
                  </p>
                  <p className="mt-1 text-xs text-ine-muted">
                    {nuevo ? 'Número consecutivo; se asigna al crear el expediente.' : 'Asignado automáticamente; no se puede cambiar.'}
                  </p>
                </div>
              )}
              {s.campos.map(c => (
                <Campo key={c.k} def={c} valor={e[c.k]} onChange={v => set(c.k, v)} idBase="rc"
                  plazo={c.plazo ? plazoDe(c.plazo) : null}
                  abogados={abogados} />
              ))}
            </div>
            {(s.listas || []).map(l => (
              <Lista key={l.k} def={l} filas={e[l.k]} onChange={v => set(l.k, v)} idBase="rc"
                plazo={l.plazo ? plazoDe(l.plazo) : null} />
            ))}
          </section>
        )
      })}
      {etapasOcultas && (
        <p className="text-xs text-ine-muted text-center">
          Las etapas de contestación, alegatos, revisión exhaustiva y resolución aparecen cuando la determinación es «Inicio del procedimiento».
        </p>
      )}

      {/* Barra de guardado, siempre visible */}
      <div className="fixed left-0 right-0 bottom-0 z-30 px-3 sm:px-6 py-3 flex flex-wrap items-center justify-end gap-3"
        style={{ background: 'rgba(255,255,255,.96)', borderTop: '1px solid #E3DFDA', boxShadow: '0 -2px 10px rgba(0,0,0,.06)',
                 paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
        {error && <span className="text-xs font-semibold mr-auto" role="alert" style={{ color: '#991B1B' }}>{error}</span>}
        {!error && aviso && <span className="text-xs text-ine-muted mr-auto" role="status">✓ {aviso}</span>}
        {!error && !aviso && sucio && <span className="text-xs text-ine-muted mr-auto">Cambios sin guardar</span>}
        <button type="button" className="btn-outline" style={{ fontSize: 13 }} onClick={cerrar}>Volver</button>
        <button type="button" className="btn-ine" style={{ fontSize: 13 }} disabled={guardando || (!sucio && !nuevo)} onClick={guardar}>
          {guardando ? 'Guardando…' : nuevo ? 'Crear expediente' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

