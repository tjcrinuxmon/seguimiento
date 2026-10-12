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
      { k: 'oficio_notificacion_radicacion', label: 'Oficio de notificación', tipo: 'texto' },
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
  {
    etapa: 'pruebas', titulo: 'Contestación y pruebas', soloInicio: true,
    campos: [
      { k: 'fecha_contestacion', label: 'Contestación', tipo: 'fecha' },
      { k: 'fecha_emision_admision', label: 'Emisión del acuerdo de admisión de pruebas', tipo: 'fecha', plazo: 'acuerdo_admision' },
      { k: 'oficio_notificacion_admision', label: 'Oficio de notificación de admisión de pruebas', tipo: 'texto' },
      { k: 'fecha_admision_pruebas', label: 'Admisión de pruebas', tipo: 'fecha', plazo: 'admision' },
    ],
    listas: [
      { k: 'desahogos_pruebas', titulo: 'Desahogo de pruebas', nuevo: 'Agregar prueba',
        columnas: [
          { k: 'prueba', label: 'Prueba (testimonial, pericial…)', tipo: 'texto', ancho: 'md' },
          { k: 'fecha', label: 'Fecha de desahogo', tipo: 'fecha', ancho: 'sm' },
          { k: 'descripcion', label: 'Descripción', tipo: 'area', ancho: 'lg' },
        ] },
      { k: 'tramite', titulo: 'Requerimientos y acuerdos de trámite', nuevo: 'Agregar oficio',
        columnas: [...OFICIO, { k: 'respuesta', label: 'Respuesta', tipo: 'area', ancho: 'lg' }] },
    ],
  },
  {
    etapa: 'alegatos', titulo: 'Alegatos', soloInicio: true,
    campos: [
      { k: 'fecha_acuerdo_alegatos', label: 'Acuerdo de alegatos', tipo: 'fecha' },
    ],
    listas: [
      { k: 'oficios_alegatos', titulo: 'Oficios de notificación', nuevo: 'Agregar oficio', plazo: 'alegatos', columnas: OFICIO },
      { k: 'alegatos_recibidos', titulo: 'Alegatos recibidos', nuevo: 'Agregar alegatos',
        columnas: [
          { k: 'fecha', label: 'Fecha', tipo: 'fecha', ancho: 'sm' },
          { k: 'quien', label: 'Quién los envía', tipo: 'opcion', ancho: 'md',
            opciones: [{ valor: 'denunciante', label: 'Denunciante' }, { valor: 'denunciado', label: 'Denunciado' }] },
          { k: 'observaciones', label: 'Observaciones', tipo: 'area', ancho: 'lg' },
        ] },
    ],
  },
  {
    etapa: 'exhaustiva', titulo: 'Revisión exhaustiva', soloInicio: true,
    nota: 'Se solicita a la UR, a las Juntas o a la propia DEAJ la revisión del asunto.',
    campos: [
      { k: 'fecha_acuerdo_exhaustiva', label: 'Acuerdo de revisión exhaustiva', tipo: 'fecha' },
    ],
    listas: [
      { k: 'oficios_exhaustiva', titulo: 'Oficios de solicitud', nuevo: 'Agregar oficio', columnas: OFICIO },
    ],
  },
  {
    etapa: 'resolucion', titulo: 'Cierre de instrucción y resolución', soloInicio: true,
    campos: [
      { k: 'fecha_cierre_instruccion', label: 'Acuerdo de cierre de instrucción', tipo: 'fecha' },
      { k: 'fecha_acuerdo_resolucion', label: 'Acuerdo de resolución', tipo: 'fecha' },
      { k: 'fecha_envio_se', label: 'Envío a la SE para revisión', tipo: 'fecha', plazo: 'resolucion' },
      { k: 'fecha_aprobacion_se', label: 'Aprobación de la SE', tipo: 'fecha' },
    ],
    listas: [
      { k: 'notificaciones_resolucion', titulo: 'Notificación de la resolución', nuevo: 'Agregar notificación',
        columnas: [
          { k: 'oficio', label: 'Núm. de oficio', tipo: 'texto', ancho: 'md' },
          { k: 'fecha', label: 'Fecha', tipo: 'fecha', ancho: 'sm' },
          { k: 'destinatario', label: 'Destinatario', tipo: 'texto', ancho: 'md' },
          { k: 'sintesis', label: 'Síntesis', tipo: 'area', ancho: 'lg' },
        ] },
    ],
  },
]
