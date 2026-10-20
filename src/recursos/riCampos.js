// RI-Consultas (Subdirección de Recursos y Consultas): catálogos que antes se llevaban en el
// Excel "JDRYC", uno por hoja. Cada sección es una tabla de captura como las de Litigio
// (SectionView); el importador (scripts/importar-jdryc.js) usa estas mismas claves.
//
// Campos: key, label, type ('date' | 'select' | 'textarea' | 'number'), wide (ocupa el ancho
// del formulario), formOnly (no sale en la tabla, solo en el formulario), entregaBadge (campo de
// atención: verde si fue a tiempo, rojo si fue después del vencimiento indicado).
// `tabla`: las columnas que se ven en la tabla (pocas, las que sirven para ubicar y dar
// seguimiento); los demás campos están en el formulario y en el Excel.

export const ESTATUS_RI = ['', 'EN TRÁMITE', 'CONCLUIDO']
const estatus = { key: 'estatus', label: 'Estatus', type: 'select', options: ESTATUS_RI }
// Abogados: del catálogo de RI-Consultas (botón "Abogados"); los dados de baja no se ofrecen,
// pero sus registros conservan el nombre.
const abogado = (label = 'Abogado') => ({ key: 'abogado', label, type: 'select', catalogo: true })
const notas = { key: 'notasImportacion', label: 'Notas de la importación', type: 'textarea', wide: true, formOnly: true }

export const DIRECCIONES_RI = ['', 'DEA', 'DEAJ', 'DECEYEC', 'DEOE', 'DEPPP', 'DERFE', 'DESPEN', 'FISCALIZACIÓN', 'UTCE', "VINC. OPL'S"]
export const MODALIDADES_RI = ['', 'Electrónico', 'Físico', 'Híbrido']
export const PARTES_RI = ['', 'Infractor', 'Denunciante', 'Denunciante / Infractor', 'N/A']

export const SECCIONES_RI = [
  { key: 'juridico', label: 'Jurídico-laboral', titulo: 'Consultas jurídico-laborales', tabla: ['idSai', 'asunto', 'abogado', 'fechaAtencion', 'estatus'], campos: [
    { key: 'numero', label: 'Número de consulta', formOnly: true },
    { key: 'idSai', label: 'ID SAI' },
    { key: 'asunto', label: 'Asunto', type: 'textarea', wide: true },
    { key: 'medio', label: 'Medio por el que llegó', formOnly: true },
    abogado(),
    { key: 'oficioAtencion', label: 'Oficio de atención', formOnly: true },
    { key: 'fechaAtencion', label: 'Fecha de atención', type: 'date' },
    estatus,
    { key: 'observaciones', label: 'Observaciones', type: 'textarea', wide: true, formOnly: true },
    notas,
  ] },
  { key: 'rescisiones', label: 'Rescisiones', titulo: 'Consultas de rescisiones', tabla: ['idSai', 'asunto', 'abogado', 'fechaRecepcion', 'fechaDesahogo', 'estatus'], campos: [
    { key: 'numero', label: 'Número de consulta' },
    { key: 'idSai', label: 'Origen / SAI' },
    { key: 'asunto', label: 'Asunto', type: 'textarea', wide: true },
    { key: 'fechaRecepcion', label: 'Fecha de recepción', type: 'date' },
    { key: 'medio', label: 'Medio por el que llegó' },
    { key: 'oficioRespuesta', label: 'Oficio de respuesta' },
    { key: 'fechaDesahogo', label: 'Fecha de desahogo', type: 'date' },
    abogado('Abogado responsable'),
    estatus,
    notas,
  ] },
  { key: 'transparencia', label: 'Transparencia', titulo: 'Consultas de transparencia', tabla: ['numero', 'informacion', 'abogado', 'fechaVencimiento', 'fechaAtencion', 'estatus'], campos: [
    { key: 'numero', label: 'Número de solicitud' },
    { key: 'informacion', label: 'Información requerida', type: 'textarea', wide: true },
    abogado(),
    { key: 'fechaRecepcion', label: 'Fecha de recepción', type: 'date' },
    { key: 'fechaVencimiento', label: 'Fecha de vencimiento', type: 'date' },
    { key: 'fechaAtencion', label: 'Fecha de atención', type: 'date', entregaBadge: 'fechaVencimiento' },
    { key: 'oficioRespuesta', label: 'Oficio de respuesta' },
    estatus,
    notas,
  ] },
  { key: 'ctrl', label: 'CTRL', titulo: 'Consultas CTRL', tabla: ['idSai', 'abogado', 'fechaVencimiento', 'fechaAtencion', 'estatus'], campos: [
    { key: 'idSai', label: 'ID SAI' },
    { key: 'oficioConsulta', label: 'Oficio de consulta' },
    { key: 'numeroPersonas', label: 'Número de personas', type: 'number' },
    { key: 'nombres', label: 'Nombres', type: 'textarea', wide: true, formOnly: true, rows: 6 },
    abogado(),
    { key: 'fechaRecepcion', label: 'Fecha de recepción DEAJ', type: 'date' },
    { key: 'fechaVencimiento', label: 'Fecha de vencimiento', type: 'date' },
    { key: 'oficioAtencion', label: 'Oficio de atención' },
    { key: 'fechaAtencion', label: 'Fecha de atención', type: 'date', entregaBadge: 'fechaVencimiento' },
    estatus,
    notas,
  ] },
  { key: 'requerimientos', label: 'Requerimientos', titulo: 'Requerimientos TEPJF y OIC', tabla: ['expediente', 'requerimiento', 'abogado', 'fechaVencimiento', 'estatus'], campos: [
    { key: 'expediente', label: 'Expediente' },
    { key: 'requerimiento', label: 'Requerimiento', type: 'textarea', wide: true },
    { key: 'fechaNotificacion', label: 'Fecha de notificación', type: 'date' },
    // "plazoTexto" y no "plazo": el formulario calcula el vencimiento en días naturales cuando
    // hay "plazo" numérico, y aquí el plazo es en días hábiles u horas.
    { key: 'plazoTexto', label: 'Plazo (días hábiles u horas)' },
    { key: 'fechaVencimiento', label: 'Fecha de vencimiento', type: 'date' },
    abogado(),
    { key: 'oficioAtencion', label: 'Oficio de atención' },
    { key: 'fechaAtencion', label: 'Fecha de atención', type: 'date', entregaBadge: 'fechaVencimiento' },
    estatus,
    notas,
  ] },
  { key: 'turno_ri', label: 'Turno RI', titulo: 'Turno de recursos de inconformidad (competencia JGE)', tabla: ['expediente', 'abogado', 'venceInstruccion', 'venceAprobacionJge', 'fechaResolucion'], campos: [
    { key: 'expediente', label: 'Expediente' },
    abogado('Abogado responsable'),
    { key: 'modalidad', label: 'Modalidad de presentación', type: 'select', options: MODALIDADES_RI },
    { key: 'recurrente', label: 'Nombre del recurrente / cargo', type: 'textarea', wide: true },
    { key: 'notificacionPersonal', label: 'Notificación personal', type: 'date', formOnly: true },
    { key: 'parte', label: 'Parte', type: 'select', options: PARTES_RI },
    { key: 'presentacionRecurso', label: 'Presentación del recurso', type: 'date', formOnly: true },
    { key: 'presentacionNota', label: 'Presentación del recurso (nota)', formOnly: true },
    { key: 'actoControvertido', label: 'Acto controvertido', type: 'textarea', wide: true, formOnly: true },
    { key: 'observacionesConducta', label: 'Observaciones (conducta HASL)', type: 'textarea', wide: true, formOnly: true },
    { key: 'acuerdoJge', label: 'Número de acuerdo JGE (resolución)' },
    { key: 'direccionDesignada', label: 'Dirección designada', type: 'select', options: DIRECCIONES_RI },
    { key: 'fechaRemisionTurno', label: 'Fecha de remisión de turno', type: 'date' },
    { key: 'venceInstruccion', label: 'Vence: cerrar instrucción y emitir proyecto', type: 'date' },
    { key: 'fechaProyecto', label: 'Fecha de cierre de instrucción / proyecto', type: 'date', formOnly: true },
    { key: 'venceAprobacionJge', label: 'Vence: someter a aprobación de JGE', type: 'date' },
    { key: 'fechaResolucion', label: 'Fecha de resolución del recurso', type: 'date', entregaBadge: 'venceAprobacionJge' },
    { key: 'resolucionNota', label: 'Resolución (nota)', formOnly: true },
    { key: 'sentido', label: 'Sentido', type: 'textarea', wide: true, formOnly: true },
    { key: 'observaciones', label: 'Observaciones', type: 'textarea', wide: true, formOnly: true },
    { key: 'solicitudOpinion', label: 'Solicitud de opinión jurídica', type: 'date', formOnly: true },
    { key: 'venceOpinion', label: 'Vence: opinión jurídica', type: 'date', formOnly: true },
    { key: 'fechaOpinion', label: 'Fecha en que se liberó la opinión', type: 'date', formOnly: true },
    { key: 'opinionJuridica', label: 'Opinión jurídica', type: 'textarea', wide: true, formOnly: true },
    { key: 'criterio', label: 'Criterio', type: 'textarea', wide: true, formOnly: true },
    notas,
  ] },
  { key: 'protocolo', label: 'Protocolo', titulo: 'Protocolo', tabla: ['expediente', 'personas', 'opinion', 'fechaOpinion'], campos: [
    { key: 'expediente', label: 'Expediente' },
    { key: 'personas', label: 'Persona(s) funcionaria(s) involucrada(s)', type: 'textarea', wide: true },
    { key: 'regimen', label: 'Régimen laboral / contractual' },
    { key: 'fechaConducta', label: 'Fecha de la conducta' },
    { key: 'opinion', label: 'Opinión', type: 'textarea', wide: true },
    { key: 'fechaOpinion', label: 'Fecha de opinión' },
    { key: 'cantidadPersonas', label: 'Personas a las que se aplicó el protocolo' },
    { key: 'nota', label: 'Nota', type: 'textarea', wide: true, formOnly: true },
    { key: 'fechaDictamen', label: 'Dictamen', formOnly: true },
    notas,
  ] },
]
