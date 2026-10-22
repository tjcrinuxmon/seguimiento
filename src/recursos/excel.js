import * as XLSX from 'xlsx'
import { SECCIONES, valorCasilla } from './campos.js'
import { calcularPlazos, proximoPlazo, etapaActual, expedienteClave, sumarMeses } from './plazos.js'

// Exporta a Excel los expedientes de Recursos y Consultas, completos, en tres hojas:
//   Expedientes                 una fila por expediente con todos sus campos
//   Oficios y requerimientos    una fila por renglón de cada lista (oficios, pruebas, alegatos…)
//   Plazos                      cada plazo calculado, con su fecha y estado
// Las fechas van como texto dd/mm/aaaa para que no se recorran por zona horaria.

const fecha = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : '')
const ESTADO = { vencido: 'Vencido', hoy: 'Vence hoy', por_vencer: 'Por vencer', pendiente: 'En tiempo', en_curso: 'En curso', cumplido: 'Cumplido', concluido: 'Concluido' }

function valor(def, v, abogados) {
  if (def.tipo === 'casilla') return v === true ? 'Sí' : v === false ? 'No' : ''
  if (v === undefined || v === null || v === '') return ''
  if (def.tipo === 'fecha') return fecha(v)
  if (def.tipo === 'abogado') return abogados.find(a => a.id === Number(v))?.nombre || ''
  if (def.tipo === 'opcion') return def.opciones.find(o => o.valor === v)?.label || v
  return v
}

// Encabezado único por campo: si dos secciones repiten etiqueta (p. ej. "Nombre") o es dato de una
// persona (denunciante / denunciado), se antepone la sección.
function encabezados() {
  const cuenta = {}
  SECCIONES.forEach(s => s.campos.forEach(c => { cuenta[c.label] = (cuenta[c.label] || 0) + 1 }))
  const out = []
  const PERSONAS = ['Quien da vista o denuncia', 'Persona denunciada']   // siempre con prefijo, para saber de quién es cada dato
  SECCIONES.forEach(s => s.campos.forEach(c => out.push({ def: c, titulo: cuenta[c.label] > 1 || PERSONAS.includes(s.titulo) ? `${s.titulo} · ${c.label}` : c.label })))
  return out
}

const anchoColumnas = (filas) => {
  const claves = Object.keys(filas[0] || {})
  return claves.map(k => ({ wch: Math.min(60, Math.max(10, k.length + 2, ...filas.slice(0, 200).map(f => String(f[k] ?? '').length + 2))) }))
}

export function descargarExcel(expedientes, { abogados = [], inhabiles = new Set(), nombre } = {}) {
  const cols = encabezados()
  const listas = SECCIONES.flatMap(s => (s.listas || []).map(l => ({ ...l, seccion: s.titulo })))

  const hojaExp = [], hojaListas = [], hojaPlazos = []
  for (const e of expedientes) {
    const clave = expedienteClave(e)
    const plazos = calcularPlazos(e, inhabiles)
    const prox = proximoPlazo(plazos)
    const fila = {
      Expediente: clave,
      'Etapa actual': etapaActual(e).label,
      'Término (6 meses)': fecha(sumarMeses(e.fecha_recepcion_deaj, 6)),
      'Próximo plazo': prox?.label || '',
      'Fecha del próximo plazo': fecha(prox?.fecha),
      'Estado del próximo plazo': prox ? ESTADO[prox.estado] : '',
    }
    for (const c of cols) fila[c.titulo] = valor(c.def, c.def.tipo === 'casilla' ? valorCasilla(c.def, e) : e[c.def.k], abogados)
    for (const l of listas) fila[`${l.titulo} (núm.)`] = (e[l.k] || []).length
    hojaExp.push(fila)

    for (const l of listas) {
      (e[l.k] || []).forEach((r, i) => {
        const f = { Expediente: clave, Etapa: l.seccion, Lista: l.titulo, 'Núm.': i + 1 }
        for (const c of l.columnas) f[c.label] = valor(c, r[c.k], abogados)
        hojaListas.push(f)
      })
    }
    for (const p of plazos) {
      hojaPlazos.push({
        Expediente: clave, Plazo: p.label, Fecha: fecha(p.fecha),
        'Corre para': p.quien === 'partes' ? 'Las partes' : 'DEAJ', Estado: ESTADO[p.estado] || p.estado,
        Nota: p.nota || '',
      })
    }
  }

  const wb = XLSX.utils.book_new()
  const agregar = (filas, titulo, vacio) => {
    const ws = XLSX.utils.json_to_sheet(filas.length ? filas : [{ [vacio]: '' }])
    ws['!cols'] = anchoColumnas(filas)
    ws['!autofilter'] = filas.length ? { ref: ws['!ref'] } : undefined
    XLSX.utils.book_append_sheet(wb, ws, titulo)
  }
  agregar(hojaExp, 'Expedientes', 'Sin expedientes')
  agregar(hojaListas, 'Oficios y requerimientos', 'Sin oficios capturados')
  agregar(hojaPlazos, 'Plazos', 'Sin plazos calculados')
  XLSX.writeFile(wb, nombre || `Recursos_y_Consultas_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
