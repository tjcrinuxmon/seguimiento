// Rubros de seguimiento por dirección. Para sumar una dirección o un rubro nuevo,
// se agrega aquí y se le da su vista en App.jsx; el menú y el inicio se arman solos.
//
// `permiso` debe coincidir con permisos() de server.js.

export const permisos = (u) => ({
  litigio:   u?.role === 'admin' || u?.role === 'ejecutiva' || u?.direccion === 'asuntos_laborales',
  convenios: u?.role === 'admin' || u?.direccion === 'contratos_convenios',
})

export const DIRECCIONES = [
  {
    key: 'asuntos_laborales',
    label: 'Asuntos Laborales',
    corto: 'DAL',
    rubros: [
      { vista: 'litigio',           label: 'Subdirección de Litigio', descripcion: 'Actores, emplazamientos, sentencias, amparos y demás etapas del litigio.', permiso: 'litigio' },
      { vista: 'litigio-dashboard', label: 'Dashboard de Litigio',    descripcion: 'Resumen y gráficas del litigio.',                                         permiso: 'litigio' },
      { vista: 'consulta',          label: 'Subdirección de Consulta', descripcion: 'Se está definiendo qué se reportará.',                                   permiso: 'litigio', enConstruccion: true },
    ],
  },
  {
    key: 'contratos_convenios',
    label: 'Contratos y Convenios',
    corto: 'DCyC',
    rubros: [
      { vista: 'convenios',         label: 'Convenios',            descripcion: 'Registro y etapas de revisión de cada convenio.', permiso: 'convenios' },
      { vista: 'convenios-reporte', label: 'Reporte de Convenios', descripcion: 'Estatus, vencimientos y gráficas de convenios.',  permiso: 'convenios' },
      { vista: 'contratos',         label: 'Contratos',            descripcion: 'Se está definiendo qué se reportará.',              permiso: 'convenios', enConstruccion: true },
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
