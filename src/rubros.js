// Rubros de seguimiento por dirección. Cada dirección tiene sus subdirecciones y su
// Dashboard; los Reportes se agregarán como rubro tipo 'reportes' cuando se definan.
// Para sumar una dirección o un rubro nuevo se agrega aquí y se le da su vista en
// App.jsx; el menú y el inicio se arman solos.
//
// `permiso` debe coincidir con permisos() de server.js.
// Colores: solo la paleta INE 2026 (gris oxford #454247, beige #C5A989, gris cálido
// #DDD4CE, gris medio #828A91, gris claro #C5C9CC y sus matices).

export const permisos = (u) => ({
  litigio:   u?.role === 'admin' || u?.role === 'ejecutiva' || u?.direccion === 'asuntos_laborales',
  convenios: u?.role === 'admin' || u?.direccion === 'contratos_convenios',
})

// Tonos de las subdirecciones: la primera de cada dirección en beige, la segunda en gris.
export const TONOS = {
  beige: { acento: '#C5A989', fondo: '#F7F0E8', icono: '#EADBC8', trazo: '#6E5638' },
  gris:  { acento: '#828A91', fondo: '#EFF1F2', icono: '#DCE0E3', trazo: '#454247' },
}

const fmt = (n) => Number(n || 0).toLocaleString('es-MX')

export const DIRECCIONES = [
  {
    key: 'asuntos_laborales',
    label: 'Asuntos Laborales',
    corto: 'DAL',
    tema: { fondo: '#C5A989', texto: '#000000', sutil: '#454247' },
    rubros: [
      { tipo: 'dashboard', vista: 'dal-dashboard', label: 'Dashboard', icono: 'dashboard', permiso: 'litigio',
        descripcion: 'Resumen y gráficas de la dirección.',
        cifra: (r) => r.litigio && { num: fmt(r.litigio.etapas), label: 'etapas' } },
      { tipo: 'subdireccion', tono: 'beige', vista: 'litigio', label: 'Subdirección de Litigio', icono: 'balanza', permiso: 'litigio',
        descripcion: 'Actores, emplazamientos, sentencias, amparos y demás etapas del litigio.',
        cifra: (r) => r.litigio && { num: fmt(r.litigio.registros), label: 'registros' } },
      { tipo: 'subdireccion', tono: 'gris', vista: 'consulta', label: 'Subdirección de Consulta', icono: 'consulta', permiso: 'litigio', enConstruccion: true,
        descripcion: 'Se está definiendo qué se reportará.' },
    ],
  },
  {
    key: 'contratos_convenios',
    label: 'Contratos y Convenios',
    corto: 'DCyC',
    tema: { fondo: '#454247', texto: '#FFFFFF', sutil: '#DDD4CE' },
    rubros: [
      { tipo: 'dashboard', vista: 'dcyc-dashboard', label: 'Dashboard', icono: 'dashboard', permiso: 'convenios',
        descripcion: 'Estatus, vencimientos y gráficas de convenios.',
        cifra: (r) => r.convenios && {
          num: fmt(r.convenios.por_vencer), label: 'vencen en 5 días', alerta: r.convenios.por_vencer > 0,
        } },
      { tipo: 'subdireccion', tono: 'beige', vista: 'convenios', label: 'Subdirección de Convenios', icono: 'documento', permiso: 'convenios',
        descripcion: 'Registro y etapas de revisión de cada convenio.',
        cifra: (r) => r.convenios && {
          num: fmt(r.convenios.total), label: 'convenios',
          nota: r.convenios.en_tramite ? `${fmt(r.convenios.en_tramite)} en trámite` : null,
        } },
      { tipo: 'subdireccion', tono: 'gris', vista: 'contratos', label: 'Subdirección de Contratos', icono: 'firma', permiso: 'convenios', enConstruccion: true,
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
