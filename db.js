// Base de datos de Seguimiento (SiCoDEAJ).
// Solo lo que usa el módulo: usuarios (espejo del portal), convenios y registros de
// Asuntos Laborales. Lo demás de la etapa "Tareas" quedó archivado en el repo tareas2.
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const db = new Database(join(__dirname, 'seguimiento.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Usuarios: el portal es la fuente de verdad (rol y dirección). Los sincroniza al
// guardarlos y el SSO los actualiza al entrar. No hay contraseñas locales.
// Las columnas username/password_hash se conservan porque el portal las escribe.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL DEFAULT 'sso_user',
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'director',
    direccion TEXT,
    puesto TEXT,
    portal_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// Contratos y Convenios → Convenios
db.exec(`
  CREATE TABLE IF NOT EXISTS convenios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_convenio TEXT,
    tercero TEXT NOT NULL,
    oficio_solicitud TEXT,
    fecha_oficio TEXT,
    fecha_asignacion TEXT,
    id_sai TEXT,
    tema TEXT,
    oficio_primera_revision TEXT,
    fecha_primera_revision TEXT,
    atencion_obs_ur TEXT,
    fecha_atencion_obs_ur TEXT,
    oficio_segunda_revision TEXT,
    fecha_segunda_revision TEXT,
    segunda_atencion_obs_ur TEXT,
    oficio_validacion_juridica TEXT,
    fecha_validacion_juridica TEXT,
    oficio_validacion_preliminar TEXT,
    fecha_validacion_preliminar TEXT,
    numero_convenio TEXT,
    estatus TEXT DEFAULT 'revision',
    fecha_vencimiento TEXT,
    observaciones TEXT,
    responsable TEXT,
    created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// Asuntos Laborales → Litigio. Un registro por fila de cada sección (actores,
// emplazamientos, sentencias…); el contenido de la fila va como JSON en `data`.
db.exec(`
  CREATE TABLE IF NOT EXISTS dal_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)
db.exec('CREATE INDEX IF NOT EXISTS idx_dal_section ON dal_records(section)')

export default db
