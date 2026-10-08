// Rubros de seguimiento por dirección. Para sumar una dirección o un rubro nuevo,
// se agrega aquí y se le da su vista en App.jsx; el menú y el inicio se arman solos.
//
// `permiso` debe coincidir con permisos() de server.js.
// Colores: solo la paleta INE 2026 (gris oxford #454247, beige #C5A989, gris cálido
// #DDD4CE, gris medio #828A91 y sus matices); cada dirección alterna cuál domina.

export const permisos = (u) => ({
  litigio:   u?.role === 'admin' || u?.role === 'ejecutiva' || u?.direccion === 'asuntos_laborales',
  convenios: u?.role === 'admin' || u?.direccion === 'contratos_convenios',
})

const fmt = (n) => Number(n || 0).toLocaleString('es-MX')

export const DIRECCIONES = [
  {
    key: 'asuntos_laborales',
    label: 'Asuntos Laborales',
    corto: 'DAL',
    tema: { fondo: '#C5A989', texto: '#000000', sutil: '#454247', icono: '#F3ECE4', trazo: '#454247' },
    rubros: [
      { vista: 'litigio', label: 'Subdirección de Litigio', icono: 'balanza', permiso: 'litigio',
        descripcion: 'Actores, emplazamientos, sentencias, amparos y demás etapas del litigio.',
        cifra: (r) => r.litigio && { num: fmt(r.litigio.registros), label: 'registros' } },
      { vista: 'litigio-dashboard', label: 'Dashboard de Litigio', icono: 'grafica', permiso: 'litigio',
        descripcion: 'Resumen y gráficas del litigio.',
        cifra: (r) => r.litigio && { num: fmt(r.litigio.etapas), label: 'etapas' } },
      { vista: 'consulta', label: 'Subdirección de Consulta', icono: 'consulta', permiso: 'litigio', enConstruccion: true,
        descripcion: 'Se está definiendo qué se reportará.' },
    ],
  },
  {
    key: 'contratos_convenios',
    label: 'Contratos y Convenios',
    corto: 'DCyC',
    tema: { fondo: '#454247', texto: '#FFFFFF', sutil: '#DDD4CE', icono: '#EDEAE6', trazo: '#454247' },
    rubros: [
      { vista: 'convenios', label: 'Convenios', icono: 'documento', permiso: 'convenios',
        descripcion: 'Registro y etapas de revisión de cada convenio.',
        cifra: (r) => r.convenios && {
          num: fmt(r.convenios.total), label: 'convenios',
          nota: r.convenios.en_tramite ? `${fmt(r.convenios.en_tramite)} en trámite` : null,
        } },
      { vista: 'convenios-reporte', label: 'Reporte de Convenios', icono: 'pastel', permiso: 'convenios',
        descripcion: 'Estatus, vencimientos y gráficas de convenios.',
        cifra: (r) => r.convenios && {
          num: fmt(r.convenios.por_vencer), label: 'vencen en 5 días', alerta: r.convenios.por_vencer > 0,
        } },
      { vista: 'contratos', label: 'Contratos', icono: 'firma', permiso: 'convenios', enConstruccion: true,
        descripcion: 'Se está definiendo qué se reportará.' },
    ],
  },
]

// Direcciones y rubros que el usuario puede ver
export function direccionesVisibles(user) {
  const p = permisos(user)
  return DIRECCIONES
    .map(d => ({ ...d, rubros: d.rubros.filter(r => p[r.permiso]) }))
    .filter(d => d.rubros.length)
}

export function buscarRubro(vista) {
  for (const d of DIRECCIONES) {
    const r = d.rubros.find(x => x.vista === vista)
    if (r) return { direccion: d, rubro: r }
  }
  return null
}
