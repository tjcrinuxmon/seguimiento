// Rubros de seguimiento por dirección. Cada dirección tiene sus subdirecciones y su
// Dashboard; los Reportes se agregarán como rubro tipo 'reportes' cuando se definan.
// Para sumar una dirección o un rubro nuevo se agrega aquí y se le da su vista en
// App.jsx; el menú y el inicio se arman solos.
//
// `permiso` debe coincidir con permisos() de server.js. `dashboard: true` en una subdirección
// le da su propio dashboard en #/<vista>/dashboard (se abre desde la franja de alertas).
// Colores: solo la paleta INE 2026 (gris oxford #454247, beige #C5A989, gris cálido
// #DDD4CE, gris medio #828A91, gris claro #C5C9CC y sus matices).

// Quién ve qué. Roles, dirección y subdirección vienen del portal (rol_tareas,
// direccion_tareas, subdireccion_tareas). Un Subdirector/a con subdirección solo ve la suya
// (ni la otra ni el dashboard de la dirección); sin subdirección, ve toda su dirección.
// server.js usa esta misma función para proteger la API.
export const permisos = (u) => {
  const admin = u?.role === 'admin'
  const todo = admin || u?.role === 'ejecutiva'
  const sub = u?.role === 'subdirector' ? (u?.subdireccion || null) : null
  const enDir = (dir) => u?.direccion === dir
  const ve = (dir, s) => enDir(dir) && (!sub || sub === s)
  return {
    // Asuntos Laborales: dashboard de la dirección, Litigio y Recursos y Consultas
    dal:       todo || (enDir('asuntos_laborales') && !sub),
    litigio:   todo || ve('asuntos_laborales', 'litigio'),
    recursos:  todo || ve('asuntos_laborales', 'recursos'),
    // Contratos y Convenios: solo esa dirección y administradores
    dcyc:      admin || (enDir('contratos_convenios') && !sub),
    convenios: admin || ve('contratos_convenios', 'convenios'),
    contratos: admin || ve('contratos_convenios', 'contratos'),
  }
}

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
      { tipo: 'dashboard', vista: 'dal-dashboard', label: 'Dashboard', icono: 'dashboard', permiso: 'dal',
        descripcion: 'Resumen y gráficas de la dirección.',
        cifra: (r) => r.litigio && { num: fmt(r.litigio.registros + (r.recursos?.expedientes || 0)), label: 'registros en total' } },
      { tipo: 'subdireccion', tono: 'beige', vista: 'litigio', label: 'Subdirección de Litigio', icono: 'balanza', permiso: 'litigio', dashboard: true,
        descripcion: 'Actores, emplazamientos, sentencias, amparos y demás etapas del litigio.',
        cifra: (r) => r.litigio && { num: fmt(r.litigio.registros), label: 'registros' } },
      { tipo: 'subdireccion', tono: 'gris', vista: 'recursos', label: 'Subdirección de Recursos y Consultas', icono: 'consulta', permiso: 'recursos', dashboard: true,
        descripcion: 'Denuncias: etapas del procedimiento, oficios y plazos.',
        cifra: (r) => r.recursos && { num: fmt(r.recursos.expedientes), label: 'expedientes' } },
    ],
  },
  {
    key: 'contratos_convenios',
    label: 'Contratos y Convenios',
    corto: 'DCyC',
    tema: { fondo: '#454247', texto: '#FFFFFF', sutil: '#DDD4CE' },
    rubros: [
      { tipo: 'dashboard', vista: 'dcyc-dashboard', label: 'Dashboard', icono: 'dashboard', permiso: 'dcyc',
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
      { tipo: 'subdireccion', tono: 'gris', vista: 'contratos', label: 'Subdirección de Contratos', icono: 'firma', permiso: 'contratos', enConstruccion: true,
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
