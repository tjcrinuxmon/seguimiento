import React, { useEffect, useState } from 'react'
import { getConsecutivoRc, setConsecutivoRc } from '../api.js'

// Numeración de expedientes: año activo (con el que se numeran los nuevos) y próximo
// número de ese año. Todos la ven; solo un administrador la cambia. No se puede fijar un
// número que ya se haya usado en ese año.
export default function Numeracion({ puedeEditar, onCambio, onCerrar }) {
  const [actual, setActual] = useState(null)        // { anioActivo, siguiente, ... } del año activo
  const [anio, setAnio] = useState('')
  const [info, setInfo] = useState(null)            // { siguiente, minimo } del año elegido
  const [siguiente, setSiguiente] = useState('')
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    getConsecutivoRc().then(r => { setActual(r); setAnio(String(r.anioActivo)) }).catch(e => setError(e?.response?.data?.error || e.message))
  }, [])

  // Al elegir otro año, mostrar en qué número va ese año
  useEffect(() => {
    const a = Number(anio)
    if (!(a >= 2000 && a <= 2100)) { setInfo(null); return }
    let vigente = true
    getConsecutivoRc(a).then(r => { if (vigente) { setInfo(r); setSiguiente(String(r.siguiente)) } }).catch(() => {})
    return () => { vigente = false }
  }, [anio])

  const guardar = async (ev) => {
    ev.preventDefault()
    setOcupado(true); setError(null); setAviso(null)
    try {
      const r = await setConsecutivoRc(Number(anio), Number(siguiente))
      setActual(r); setInfo(r)
      setAviso(`Listo: el próximo expediente será INE/DEAJ/ALI/${r.siguiente}/${r.anioActivo}.`)
      onCambio?.()
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="ine-card p-4 sm:p-5" aria-labelledby="numeracion-titulo">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="numeracion-titulo" className="text-sm font-bold text-ine-text">Numeración de expedientes</h2>
          <p className="text-xs text-ine-muted mt-0.5">
            {actual
              ? <>Próximo expediente: <strong className="text-ine-text">INE/DEAJ/ALI/{actual.siguiente}/{actual.anioActivo}</strong></>
              : 'Cargando…'}
          </p>
        </div>
        <button type="button" onClick={onCerrar} className="text-xs text-ine-muted hover:underline flex-shrink-0">Cerrar</button>
      </div>

      {puedeEditar ? (
        <form onSubmit={guardar} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="num-anio" className="ine-label">Año activo</label>
            <input id="num-anio" type="number" min={2000} max={2100} className="ine-input" style={{ width: 120 }}
              value={anio} onChange={e => setAnio(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="num-sig" className="ine-label">Próximo número</label>
            <input id="num-sig" type="number" min={info?.minimo || 1} className="ine-input" style={{ width: 140 }}
              value={siguiente} onChange={e => setSiguiente(e.target.value)} required />
          </div>
          <button type="submit" className="btn-ine" disabled={ocupado || !anio || !siguiente} style={{ fontSize: 13 }}>Guardar</button>
          {info && (
            <p className="w-full text-xs text-ine-muted">
              {info.minimo > 1
                ? `En ${anio} ya se usó hasta el ${info.minimo - 1}; el próximo debe ser ${info.minimo} o mayor.`
                : `En ${anio} aún no hay expedientes.`}
              {' '}Los expedientes nuevos se numerarán con este año hasta que se cambie.
            </p>
          )}
        </form>
      ) : (
        <p className="text-xs text-ine-muted mt-3">Solo un administrador puede cambiar el año activo o el próximo número.</p>
      )}
      {error && <p className="text-xs font-semibold mt-2" role="alert" style={{ color: '#991B1B' }}>{error}</p>}
      {aviso && <p className="text-xs font-semibold mt-2" role="status" style={{ color: '#454247' }}>✓ {aviso}</p>}
    </section>
  )
}
