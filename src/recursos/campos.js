// Campos de un expediente de Recursos y Consultas, agrupados por etapa del procedimiento.
// (El número y el año del expediente no son campos: los asigna el servidor al crearlo.)
// La ficha se dibuja a partir de esta lista: para agregar o renombrar un campo basta con
// cambiarlo aquí (los datos se guardan por su clave `k`).
//
// Tipos: texto, numero, fecha, area (texto largo), opcion (con `opciones`).
// `plazo`: clave del plazo (plazos.js) cuya fecha límite se muestra junto al campo.

// Columnas comunes de un oficio (número, a quién va, síntesis, envío y desahogo)
const OFICIO = [
  { k: 'oficio',         label: 'Núm. de oficio', tipo: 'texto', ancho: 'md' },
  { k: 'destinatario',   label: 'Destinatario',   tipo: 'texto', ancho: 'md' },
  { k: 'sintesis',       label: 'Síntesis',       tipo: 'area',  ancho: 'lg' },
  { k: 'fecha_envio',    label: 'Envío',          tipo: 'fecha', ancho: 'sm' },
  { k: 'fecha_desahogo', label: 'Desahogo',       tipo: 'fecha', ancho: 'sm' },
]

export const DETERMINACIONES = [
  { valor: 'inicio',    label: 'Inicio del procedimiento' },
  { valor: 'no_inicio', label: 'No inicio' },
  { valor: 'extincion', label: 'Extinción' },
  { valor: 'sobreseimiento', label: 'Sobreseimiento' },
  { valor: 'archivo',   label: 'Archivo' },
]

export const SECCIONES = [
  {
    etapa: 'recepcion', titulo: 'Recepción de la denuncia',
    campos: [
      { k: 'abogado_id', label: 'Abogado', tipo: 'abogado' },
      { k: 'fecha_recepcion_deaj', label: 'Recepción en la DEAJ', tipo: 'fecha', ayuda: 'Desde aquí corre el término de 6 meses.' },
      { k: 'fecha_recepcion_dal', label: 'Recepción en la DAL', tipo: 'fecha' },
      { k: 'protocolo', label: 'Protocolo aplicable', tipo: 'texto', ayuda: 'Por ejemplo, con perspectiva de género.' },
      { k: 'medidas_cautelares', label: 'Medidas cautelares', tipo: 'area', ancho: 'completo' },
    ],
  },
  {
    etapa: 'recepcion', titulo: 'Quien da vista o denuncia',
    campos: [
      { k: 'denunciante_nombre', label: 'Nombre', tipo: 'texto' },
      { k: 'denunciante_cargo', label: 'Cargo', tipo: 'texto' },
      { k: 'denunciante_adscripcion', label: 'Adscripción', tipo: 'texto' },
    ],
  },
  {
    etapa: 'recepcion', titulo: 'Persona denunciada',
    campos: [
      { k: 'denunciado_nombre', label: 'Nombre', tipo: 'texto' },
      { k: 'denunciado_cargo', label: 'Cargo', tipo: 'texto' },
      { k: 'denunciado_adscripcion', label: 'Área de adscripción', tipo: 'texto' },
      { k: 'conducta', label: 'Conducta del probable infractor', tipo: 'area', ancho: 'completo' },
    ],
  },
  {
    etapa: 'radicacion', titulo: 'Radicación',
    campos: [
      { k: 'fecha_acuerdo_radicacion', label: 'Acuerdo de recepción y radicación', tipo: 'fecha' },
      { k: 'fecha_notificacion_radicacion', label: 'Notificación', tipo: 'fecha' },
    ],
  },
  {
    etapa: 'investigacion', titulo: 'Investigación preliminar',
    campos: [
      { k: 'fecha_acuerdo_investigacion', label: 'Acuerdo de investigación preliminar', tipo: 'fecha' },
    ],
    listas: [
      { k: 'requerimientos', titulo: 'Requerimientos', nuevo: 'Agregar requerimiento',
        columnas: [...OFICIO, { k: 'desahogo', label: 'Desahogo (resumen)', tipo: 'area', ancho: 'lg' }] },
    ],
  },
  {
    etapa: 'determinacion', titulo: 'Determinación de la investigación',
    campos: [
      { k: 'determinacion', label: 'Determinación', tipo: 'opcion', opciones: DETERMINACIONES },
      { k: 'fecha_acuerdo_determinacion', label: 'Acuerdo de inicio / no inicio', tipo: 'fecha', plazo: 'acuerdo_listo' },
      { k: 'oficio_notificacion_determinacion', label: 'Oficio de notificación del acuerdo', tipo: 'texto' },
      { k: 'fecha_notificacion_determinacion', label: 'Notificación del acuerdo', tipo: 'fecha', plazo: 'termino' },
    ],
  },
  // ── Sustanciación (solo si la determinación es «Inicio del procedimiento») ──
  // Los campos con `plazo` son la fecha en que realmente se hizo la actividad; junto a cada
  // uno se muestra la fecha límite calculada (plazos.js).
  {
    etapa: 'sustanciacion', titulo: 'Contestación y admisión de pruebas', soloInicio: true,
    campos: [
      { k: 'fecha_contestacion', label: 'Contestación y ofrecimiento de pruebas', tipo: 'fecha', plazo: 'contestacion',
        ayuda: '10 días desde el día siguiente a la notificación del acuerdo de inicio.' },
      { k: 'fecha_emision_admision', label: 'Acuerdo de admisión de pruebas', tipo: 'fecha' },
      { k: 'fecha_notificacion_admision', label: 'Notificación del acuerdo', tipo: 'fecha' },
    ],
  },
  {
    etapa: 'sustanciacion', titulo: 'Requerimientos', soloInicio: true,
    campos: [],
    listas: [
      { k: 'requerimientos_sustanciacion', titulo: 'Requerimientos', nuevo: 'Agregar requerimiento',
        columnas: [
          { k: 'oficio', label: 'Número de oficio', tipo: 'texto', ancho: 'md' },
          { k: 'fecha_envio', label: 'Envío', tipo: 'fecha', ancho: 'sm' },
          { k: 'fecha_desahogo', label: 'Desahogo', tipo: 'fecha', ancho: 'sm' },
        ] },
    ],
  },
  {
    etapa: 'sustanciacion', titulo: 'Desahogo de pruebas', soloInicio: true,
    campos: [],
    listas: [
      { k: 'desahogos_pruebas', titulo: 'Pruebas', nuevo: 'Agregar prueba',
        columnas: [
          { k: 'prueba', label: 'Tipo de prueba', tipo: 'area', ancho: 'lg' },
          { k: 'fecha', label: 'Fecha del desahogo', tipo: 'fecha', ancho: 'sm' },
        ] },
    ],
  },
  {
    etapa: 'sustanciacion', titulo: 'Acuerdo de alegatos', soloInicio: true,
    campos: [
      { k: 'fecha_acuerdo_alegatos', label: 'Emisión del acuerdo de alegatos', tipo: 'fecha' },
      { k: 'fecha_notificacion_alegatos', label: 'Notificación del acuerdo de alegatos', tipo: 'fecha' },
      { k: 'fecha_alegatos', label: 'Formulación de alegatos', tipo: 'fecha', plazo: 'alegatos',
        ayuda: '5 días desde el día siguiente a la notificación del acuerdo de alegatos.' },
    ],
  },
  {
    etapa: 'sustanciacion', titulo: 'Acuerdo de revisión exhaustiva', soloInicio: true,
    campos: [
      { k: 'fecha_acuerdo_exhaustiva', label: 'Emisión del acuerdo', tipo: 'fecha' },
      { k: 'fecha_notificacion_exhaustiva', label: 'Notificación del acuerdo', tipo: 'fecha' },
    ],
  },
  {
    etapa: 'sustanciacion', titulo: 'Acuerdo de cierre de instrucción', soloInicio: true,
    campos: [
      { k: 'fecha_cierre_instruccion', label: 'Emisión del acuerdo', tipo: 'fecha' },
      { k: 'fecha_notificacion_cierre', label: 'Notificación del acuerdo', tipo: 'fecha' },
    ],
  },
  {
    etapa: 'sustanciacion', titulo: 'Resolución', soloInicio: true,
    campos: [
      { k: 'fecha_acuerdo_resolucion', label: 'Elaboración del proyecto de resolución', tipo: 'fecha', plazo: 'proyecto',
        ayuda: '25 días desde el día siguiente a la emisión del acuerdo de cierre de instrucción.' },
      { k: 'fecha_envio_se', label: 'Envío de la resolución a la Secretaría Ejecutiva', tipo: 'fecha', plazo: 'envio_se',
        ayuda: '10 días después de que vencen los 25 del proyecto.' },
      { k: 'fecha_aprobacion_se', label: 'Firma de la resolución', tipo: 'fecha' },
      { k: 'fecha_notificacion_resolucion', label: 'Notificación de la resolución', tipo: 'fecha', plazo: 'notificacion_resolucion',
        ayuda: '10 días desde la firma de la resolución.' },
    ],
  },
]
