import React from 'react'

// Piezas comunes de los dashboards de Seguimiento. Todos siguen el mismo orden:
//   encabezado → alertas → cifras clave → distribución/avance → carga por persona → vencimientos/pendientes
//
// Color: las barras usan un solo tono (gris oxford) con el valor escrito, porque la paleta
// INE 2026 no tiene suficientes tonos distinguibles para series de colores. El color fuerte
// se reserva para el estado de un plazo (vencido / por vencer) y siempre va con ícono y texto.

export const TINTA = { fuerte: '#000000', media: '#454247', suave: '#828A91', linea: '#E3DFDA', pista: '#EDEAE6' }
export const ESTADO = {
  vencido:   { texto: '#991B1B', fondo: '#FEF2F2', borde: '#FCA5A5', icono: '⚠' },
  porVencer: { texto: '#92400E', fondo: '#FFFBEB', borde: '#FCD34D', icono: '⏱' },
  neutro:    { texto: '#454247', fondo: '#F7F5F3', borde: '#E3DFDA', icono: '' },
}

const fmt = (n) => Number(n || 0).toLocaleString('es-MX')

// Días que faltan para una fecha AAAA-MM-DD (negativo si ya pasó); null si no hay fecha.
export function diasPara(fecha) {
  if (!fecha) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const d = new Date(fecha + 'T00:00:00')
  if (isNaN(d)) return null
  return Math.round((d - hoy) / 86400000)
}

export function Encabezado({ titulo, subtitulo }) {
  return (
    <div>
      <h1 className="text-lg sm:text-xl font-bold text-ine-text">{titulo}</h1>
      {subtitulo && <p className="text-sm text-ine-muted mt-1">{subtitulo}</p>}
    </div>
  )
}

// Avisos de plazos: vencidos y por vencer dentro del umbral de la dirección.
export function Alertas({ vencidos, porVencer, umbral, que = 'plazos' }) {
  if (!vencidos && !porVencer) {
    return (
      <div className="rounded-lg px-4 py-3 text-sm font-semibold" style={{ background: '#F7F5F3', border: `1px solid ${TINTA.linea}`, color: TINTA.media }}>
        ✓ Sin {que} vencidos ni por vencer en los próximos {umbral} días.
      </div>
    )
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {vencidos > 0 && <Aviso estado={ESTADO.vencido} num={vencidos} texto={`${vencidos === 1 ? 'vencido' : 'vencidos'} sin atender`} />}
      {porVencer > 0 && <Aviso estado={ESTADO.porVencer} num={porVencer} texto={`${porVencer === 1 ? 'vence' : 'vencen'} en los próximos ${umbral} días`} />}
    </div>
  )
}

function Aviso({ estado, num, texto }) {
  return (
    <div className="rounded-lg px-4 py-3 flex items-center gap-3" role="status"
      style={{ background: estado.fondo, border: `1px solid ${estado.borde}`, borderLeft: `4px solid ${estado.texto}` }}>
      <span aria-hidden="true" style={{ color: estado.texto, fontSize: 18 }}>{estado.icono}</span>
      <span className="text-sm" style={{ color: estado.texto }}>
        <strong className="text-lg mr-1">{fmt(num)}</strong>{texto}
      </span>
    </div>
  )
}

// Cifras clave: [{ label, valor, nota }]
export function Cifras({ items }) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      {items.map(k => (
        <div key={k.label} className="ine-card px-4 py-3.5">
          <p className="text-xs font-semibold text-ine-muted">{k.label}</p>
          <p className="text-2xl font-black mt-1 leading-none" style={{ color: TINTA.media }}>{fmt(k.valor)}</p>
          {k.nota && <p className="text-xs mt-1.5" style={{ color: '#8A6E4B' }}>{k.nota}</p>}
        </div>
      ))}
    </div>
  )
}

export function Panel({ titulo, nota, children, className = '' }) {
  return (
    <section className={`ine-card p-4 sm:p-5 ${className}`}>
      <h2 className="text-sm font-bold text-ine-text">{titulo}</h2>
      {nota && <p className="text-xs text-ine-muted mt-0.5">{nota}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

const SinDatos = ({ texto = 'Sin datos registrados.' }) => <p className="text-sm text-ine-muted py-4">{texto}</p>

// Barras horizontales con etiqueta y valor: [{ nombre, valor, nota? }]. `total` (opcional)
// fija el 100 % de la barra (p. ej. un embudo contra el total); si no, la mayor es el 100 %.
export function Barras({ datos, total, unidad = '', mostrarPct = false }) {
  if (!datos.length) return <SinDatos />
  const max = total || Math.max(...datos.map(d => d.valor), 1)
  return (
    <ul className="flex flex-col gap-2.5">
      {datos.map(d => {
        const pct = Math.round((d.valor / max) * 100)
        return (
          <li key={d.nombre} title={`${d.nombre}: ${fmt(d.valor)}${unidad ? ' ' + unidad : ''}${total ? ` (${pct} %)` : ''}`}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate" style={{ color: TINTA.media }}>{d.nombre}</span>
              <span className="flex-shrink-0 font-bold" style={{ color: TINTA.fuerte }}>
                {fmt(d.valor)}{mostrarPct && <span className="font-normal text-ine-muted ml-1">{pct} %</span>}
              </span>
            </div>
            <div className="mt-1 h-2 rounded" style={{ background: TINTA.pista }}>
              <div className="h-2 rounded" style={{ width: `${Math.max(pct, d.valor ? 2 : 0)}%`, background: TINTA.media }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// Columnas verticales (p. ej. por año): [{ nombre, valor }]
export function Columnas({ datos }) {
  if (!datos.some(d => d.valor)) return <SinDatos />
  const max = Math.max(...datos.map(d => d.valor), 1)
  return (
    <div className="flex items-end gap-2 h-44" role="list">
      {datos.map(d => (
        <div key={d.nombre} role="listitem" className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1"
          title={`${d.nombre}: ${fmt(d.valor)}`}>
          <span className="text-xs font-bold" style={{ color: TINTA.fuerte }}>{d.valor ? fmt(d.valor) : ''}</span>
          <div className="w-full max-w-[44px] rounded-t" style={{ height: `${(d.valor / max) * 100}%`, minHeight: d.valor ? 3 : 0, background: TINTA.media }} />
          <span className="text-xs text-ine-muted truncate w-full text-center pt-1" style={{ borderTop: `1px solid ${TINTA.linea}` }}>{d.nombre}</span>
        </div>
      ))}
    </div>
  )
}

// Etiqueta del plazo de un renglón según los días que faltan.
export function Plazo({ dias, umbral }) {
  const e = dias < 0 ? ESTADO.vencido : dias <= umbral ? ESTADO.porVencer : ESTADO.neutro
  const texto = dias < 0 ? `Vencido hace ${-dias} d` : dias === 0 ? 'Vence hoy' : dias === 1 ? 'Vence mañana' : `En ${dias} días`
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: e.fondo, color: e.texto, border: `1px solid ${e.borde}` }}>
      {e.icono && <span aria-hidden="true">{e.icono}</span>}{texto}
    </span>
  )
}

// Tabla compacta: columnas [{ titulo, campo | render }], filas = objetos.
export function Tabla({ columnas, filas, vacio, limite = 12 }) {
  if (!filas.length) return <SinDatos texto={vacio} />
  const visibles = filas.slice(0, limite)
  return (
    <div className="overflow-x-auto -mx-4 sm:-mx-5">
      <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#F7F5F3' }}>
            {columnas.map(c => (
              <th key={c.titulo} className="text-left font-bold text-ine-muted px-4 sm:px-5 py-2 whitespace-nowrap">{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibles.map((f, i) => (
            <tr key={f.id ?? i} style={{ borderTop: `1px solid ${TINTA.pista}` }}>
              {columnas.map(c => (
                <td key={c.titulo} className="px-4 sm:px-5 py-2 align-middle" style={{ color: TINTA.media }}>
                  {c.render ? c.render(f) : (f[c.campo] || '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {filas.length > limite && (
        <p className="text-xs text-ine-muted px-4 sm:px-5 pt-2">y {fmt(filas.length - limite)} más…</p>
      )}
    </div>
  )
}

// Agrupa y cuenta: contar(lista, r => r.campo) → [{ nombre, valor }] de mayor a menor.
export function contar(lista, clave, { tope, sinValor } = {}) {
  const m = new Map()
  for (const r of lista) {
    const k = clave(r) || sinValor
    if (!k) continue
    m.set(k, (m.get(k) || 0) + 1)
  }
  const out = [...m].map(([nombre, valor]) => ({ nombre, valor })).sort((a, b) => b.valor - a.valor)
  return tope ? out.slice(0, tope) : out
}
