// Seguimiento (SiCoDEAJ) — seguimiento de rubros por dirección de la DEAJ.
// Detrás del gateway: /seguimiento/* → este servidor, /api/seg/* → /api/*.
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import db from './db.js'
import { permisos } from './src/rubros.js'
import { renombrarEnRegistros } from './scripts/abogados.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = Number(process.env.PORT) || 3009
const JWT_SECRET = process.env.JWT_SECRET
const PORTAL_SSO_SECRET = process.env.PORTAL_SSO_SECRET
if (!JWT_SECRET) { console.error('FATAL: JWT_SECRET no definido'); process.exit(1) }
if (!PORTAL_SSO_SECRET) { console.error('FATAL: PORTAL_SSO_SECRET no definido'); process.exit(1) }
const JWT_EXPIRES = '8h'

app.use(helmet({ contentSecurityPolicy: false }))
const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'http://localhost:3000,http://localhost:5176')
  .split(',').map(o => o.trim())
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}))
app.use(express.json({ limit: '2mb' }))

// ─── Permisos ─────────────────────────────────────────────────────────────────
// La misma regla que el menú (src/rubros.js): rol, dirección y subdirección del portal.
export { permisos }

const exigir = (rubro) => (req, res, next) =>
  permisos(req.user)[rubro] ? next() : res.status(403).json({ error: 'Sin acceso a este rubro' })

// ─── SSO desde el portal ──────────────────────────────────────────────────────
const ssoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera 15 minutos.' },
})

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, direccion: u.direccion, subdireccion: u.subdireccion || null })

app.post('/api/auth/sso', ssoLimiter, (req, res) => {
  const { sso_token } = req.body || {}
  if (!sso_token) return res.status(400).json({ error: 'Token SSO requerido' })
  let payload
  try {
    payload = jwt.verify(sso_token, PORTAL_SSO_SECRET)
  } catch {
    return res.status(401).json({ error: 'Token SSO inválido o expirado' })
  }
  const email = String(payload.email || '').toLowerCase()
  if (!email) return res.status(400).json({ error: 'Token SSO sin correo' })

  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!existing) {
    db.prepare('INSERT INTO users (username, email, name, role, direccion, subdireccion, puesto) VALUES (?,?,?,?,?,?,?)')
      .run(email, email, payload.name || email, payload.role || 'director', payload.direccion || null, payload.subdireccion || null, payload.puesto || null)
  } else {
    db.prepare('UPDATE users SET name=?, role=?, direccion=?, subdireccion=?, puesto=? WHERE id=?')
      .run(payload.name || existing.name, payload.role || existing.role, payload.direccion || null, payload.subdireccion || null,
           payload.puesto ?? existing.puesto, existing.id)
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  const token = jwt.sign(publicUser(user), JWT_SECRET, { expiresIn: JWT_EXPIRES })
  res.json({ token, user: publicUser(user) })
})

// Todo lo demás bajo /api requiere sesión
app.use('/api', (req, res, next) => {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' })
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Sesión expirada. Inicia sesión nuevamente.' })
  }
})

// ─── Resumen para la pantalla de inicio (solo de los rubros que el usuario ve) ─
const hoyLocal = (dias = 0) => {
  const d = new Date(); d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

app.get('/api/resumen', (req, res) => {
  const p = permisos(req.user)
  const out = {}
  if (p.litigio) {
    const r = db.prepare('SELECT COUNT(*) AS registros, COUNT(DISTINCT section) AS etapas FROM dal_records').get()
    out.litigio = r
  }
  if (p.recursos) {
    out.recursos = {
      ...db.prepare('SELECT COUNT(*) AS expedientes FROM rc_expedientes').get(),
      ...db.prepare('SELECT COUNT(*) AS ri FROM ric_registros').get(),
    }
  }
  if (p.convenios) {
    out.convenios = db.prepare(`
      SELECT COUNT(*) AS total,
             COALESCE(SUM(estatus IN ('revision', 'revision_interna', 'validacion')), 0) AS en_tramite,
             COALESCE(SUM(fecha_vencimiento BETWEEN ? AND ?), 0) AS por_vencer
      FROM convenios
    `).get(hoyLocal(0), hoyLocal(5))
  }
  res.json(out)
})

// ─── Usuarios (para el campo "Responsable" de Convenios) ──────────────────────
app.get('/api/users', exigir('convenios'), (req, res) => {
  const { role, direccion } = req.user
  const rows = role === 'admin'
    ? db.prepare('SELECT id, name, role, direccion, puesto FROM users ORDER BY role, name').all()
    : db.prepare('SELECT id, name, role, direccion, puesto FROM users WHERE direccion = ? ORDER BY role, name').all(direccion)
  res.json(rows)
})

// ─── Contratos y Convenios → Convenios ────────────────────────────────────────
const CONVENIO_CAMPOS = [
  'tipo_convenio', 'tercero', 'oficio_solicitud', 'fecha_oficio', 'fecha_asignacion', 'id_sai', 'tema',
  'oficio_primera_revision', 'fecha_primera_revision', 'atencion_obs_ur', 'fecha_atencion_obs_ur',
  'oficio_segunda_revision', 'fecha_segunda_revision', 'segunda_atencion_obs_ur',
  'oficio_validacion_juridica', 'fecha_validacion_juridica',
  'oficio_validacion_preliminar', 'fecha_validacion_preliminar',
  'numero_convenio', 'estatus', 'fecha_vencimiento', 'observaciones', 'responsable',
]
const valoresConvenio = (body) => CONVENIO_CAMPOS.map(c => {
  if (c === 'tercero') return body.tercero.trim()
  if (c === 'estatus') return body.estatus || 'revision'
  return body[c] || null
})

app.get('/api/convenios', exigir('convenios'), (req, res) => {
  res.json(db.prepare('SELECT * FROM convenios ORDER BY created_at DESC').all())
})

app.post('/api/convenios', exigir('convenios'), (req, res) => {
  if (!req.body?.tercero?.trim()) return res.status(400).json({ error: 'El campo Tercero es requerido' })
  const result = db.prepare(`
    INSERT INTO convenios (${CONVENIO_CAMPOS.join(', ')}, created_by_id)
    VALUES (${CONVENIO_CAMPOS.map(() => '?').join(', ')}, ?)
  `).run(...valoresConvenio(req.body), req.user.id)
  res.status(201).json(db.prepare('SELECT * FROM convenios WHERE id = ?').get(result.lastInsertRowid))
})

app.put('/api/convenios/:id', exigir('convenios'), (req, res) => {
  if (!req.body?.tercero?.trim()) return res.status(400).json({ error: 'El campo Tercero es requerido' })
  const r = db.prepare(`
    UPDATE convenios SET ${CONVENIO_CAMPOS.map(c => `${c}=?`).join(', ')}, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(...valoresConvenio(req.body), req.params.id)
  if (!r.changes) return res.status(404).json({ error: 'Convenio no encontrado' })
  res.json(db.prepare('SELECT * FROM convenios WHERE id = ?').get(req.params.id))
})

app.delete('/api/convenios/:id', exigir('convenios'), (req, res) => {
  db.prepare('DELETE FROM convenios WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ─── Asuntos Laborales → Litigio ──────────────────────────────────────────────
const DAL_SECTIONS = new Set(['actores', 'emplaz', 'noemplaz', 'sentencias', 'requerims', 'cumplims',
  'incidentes', 'amparos', 'conciliacion', 'oic', 'reencauz'])

const seccionValida = (req, res, next) =>
  DAL_SECTIONS.has(req.params.section) ? next() : res.status(400).json({ error: 'Sección inválida' })

const filaDal = (r) => ({ id: r.id, ...JSON.parse(r.data) })

app.get('/api/dal/:section', exigir('litigio'), seccionValida, (req, res) => {
  const rows = db.prepare('SELECT id, data FROM dal_records WHERE section = ? ORDER BY id ASC').all(req.params.section)
  res.json(rows.map(filaDal))
})

app.post('/api/dal/:section', exigir('litigio'), seccionValida, (req, res) => {
  const { id: _id, ...data } = req.body || {}
  const result = db.prepare('INSERT INTO dal_records (section, data) VALUES (?, ?)').run(req.params.section, JSON.stringify(data))
  res.status(201).json(filaDal(db.prepare('SELECT id, data FROM dal_records WHERE id = ?').get(result.lastInsertRowid)))
})

app.put('/api/dal/:section/:id', exigir('litigio'), seccionValida, (req, res) => {
  const row = db.prepare('SELECT id FROM dal_records WHERE id = ? AND section = ?').get(req.params.id, req.params.section)
  if (!row) return res.status(404).json({ error: 'Registro no encontrado' })
  const { id: _id, ...data } = req.body || {}
  db.prepare('UPDATE dal_records SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify(data), req.params.id)
  res.json(filaDal(db.prepare('SELECT id, data FROM dal_records WHERE id = ?').get(req.params.id)))
})

// Borrar registros de Litigio: solo administradores (igual que en la etapa anterior)
app.delete('/api/dal/:section/:id', exigir('litigio'), seccionValida, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede eliminar registros' })
  db.prepare('DELETE FROM dal_records WHERE id = ? AND section = ?').run(req.params.id, req.params.section)
  res.json({ ok: true })
})

// ─── Asuntos Laborales → Recursos y Consultas ─────────────────────────────────
// `abogado` (nombre) se calcula desde el catálogo con `abogado_id`, para que un cambio de
// nombre se vea en todos los expedientes.
const nombreAbogado = db.prepare('SELECT nombre FROM abogados WHERE id = ?')
const filaRc = (r) => {
  const data = JSON.parse(r.data)
  const abogado = data.abogado_id ? nombreAbogado.get(data.abogado_id)?.nombre || null : null
  return { ...data, abogado, id: r.id, numero: r.numero, anio: r.anio, updated_at: r.updated_at }
}
// Número y año del expediente (INE/DEAJ/ALI/{numero}/{anio}): los asigna el servidor al
// crearlo y ya no cambian. El año es el año activo que fijó un administrador (o el actual
// si no hay); el número, el siguiente consecutivo de ese año: el mayor entre el que fijó
// un administrador (rc_consecutivos) y el último usado + 1.
const anioActivo = () => {
  const a = Number(db.prepare("SELECT valor FROM rc_config WHERE clave = 'anio_activo'").get()?.valor)
  return a >= 2000 && a <= 2100 ? a : new Date().getFullYear()
}
const minimoNumero = (anio) =>
  db.prepare('SELECT COALESCE(MAX(numero), 0) + 1 AS numero FROM rc_expedientes WHERE anio = ?').get(anio).numero
const siguienteNumero = (anio) => {
  const fijado = db.prepare('SELECT siguiente FROM rc_consecutivos WHERE anio = ?').get(anio)?.siguiente || 0
  return Math.max(fijado, minimoNumero(anio))
}

app.get('/api/rc/expedientes', exigir('recursos'), (req, res) => {
  const rows = db.prepare('SELECT * FROM rc_expedientes ORDER BY anio DESC, numero DESC').all()
  res.json(rows.map(filaRc))
})

// Número que tendría un expediente nuevo (solo para mostrarlo antes de crearlo)
app.get('/api/rc/siguiente', exigir('recursos'), (req, res) => {
  const anio = anioActivo()
  res.json({ anio, numero: siguienteNumero(anio) })
})

// Numeración: año activo y próximo número. Cualquiera con acceso la consulta; solo un
// administrador la cambia. `minimo` es el último número usado ese año + 1.
app.get('/api/rc/consecutivo', exigir('recursos'), (req, res) => {
  const anio = Number(req.query.anio) || anioActivo()
  res.json({ anio, anioActivo: anioActivo(), siguiente: siguienteNumero(anio), minimo: minimoNumero(anio) })
})

app.put('/api/rc/consecutivo', exigir('recursos'), (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede configurar el consecutivo' })
  const anio = Number(req.body?.anio)
  const siguiente = Number(req.body?.siguiente)
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) return res.status(400).json({ error: 'Año inválido' })
  if (!Number.isInteger(siguiente) || siguiente < 1) return res.status(400).json({ error: 'El número debe ser un entero mayor que 0' })
  const minimo = minimoNumero(anio)
  if (siguiente < minimo) {
    return res.status(400).json({ error: `En ${anio} ya se usó hasta el ${minimo - 1}; el próximo debe ser ${minimo} o mayor.` })
  }
  db.transaction(() => {
    db.prepare(`INSERT INTO rc_config (clave, valor) VALUES ('anio_activo', ?)
      ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, updated_at = CURRENT_TIMESTAMP`).run(String(anio))
    db.prepare(`INSERT INTO rc_consecutivos (anio, siguiente) VALUES (?, ?)
      ON CONFLICT(anio) DO UPDATE SET siguiente = excluded.siguiente, updated_at = CURRENT_TIMESTAMP`).run(anio, siguiente)
  })()
  res.json({ anio, anioActivo: anioActivo(), siguiente: siguienteNumero(anio), minimo })
})

app.get('/api/rc/expedientes/:id', exigir('recursos'), (req, res) => {
  const row = db.prepare('SELECT * FROM rc_expedientes WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Expediente no encontrado' })
  res.json(filaRc(row))
})

const guardarRc = (req, res, id) => {
  const { id: _i, numero: _n, anio: _a, updated_at: _u, abogado: _ab, ...data } = req.body || {}
  if (id) {
    // El número y el año no se modifican al editar
    const r = db.prepare('UPDATE rc_expedientes SET data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(JSON.stringify(data), id)
    if (!r.changes) return res.status(404).json({ error: 'Expediente no encontrado' })
    return res.json(filaRc(db.prepare('SELECT * FROM rc_expedientes WHERE id = ?').get(id)))
  }
  // Asignar número y crear en una sola transacción, para que dos capturas simultáneas
  // no obtengan el mismo número.
  const crear = db.transaction(() => {
    const anio = anioActivo()
    const numero = siguienteNumero(anio)
    return db.prepare('INSERT INTO rc_expedientes (numero, anio, data, created_by_id) VALUES (?,?,?,?)')
      .run(numero, anio, JSON.stringify(data), req.user.id).lastInsertRowid
  })
  const nuevoId = crear.immediate()
  res.status(201).json(filaRc(db.prepare('SELECT * FROM rc_expedientes WHERE id = ?').get(nuevoId)))
}

app.post('/api/rc/expedientes', exigir('recursos'), (req, res) => guardarRc(req, res, null))
app.put('/api/rc/expedientes/:id', exigir('recursos'), (req, res) => guardarRc(req, res, Number(req.params.id)))

app.delete('/api/rc/expedientes/:id', exigir('recursos'), (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede eliminar expedientes' })
  db.prepare('DELETE FROM rc_expedientes WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ─── Asuntos Laborales → Recursos y Consultas → RI-Consultas ──────────────────
// Mismo esquema que Litigio: un registro JSON por renglón de cada catálogo.
const RIC_SECTIONS = new Set(['juridico', 'rescisiones', 'transparencia', 'ctrl', 'requerimientos', 'turno_ri', 'protocolo'])
const seccionRic = (req, res, next) =>
  RIC_SECTIONS.has(req.params.section) ? next() : res.status(400).json({ error: 'Sección inválida' })

app.get('/api/ric/:section', exigir('recursos'), seccionRic, (req, res) => {
  const rows = db.prepare('SELECT id, data FROM ric_registros WHERE section = ? ORDER BY id ASC').all(req.params.section)
  res.json(rows.map(filaDal))
})

app.post('/api/ric/:section', exigir('recursos'), seccionRic, (req, res) => {
  const { id: _id, ...data } = req.body || {}
  const result = db.prepare('INSERT INTO ric_registros (section, data) VALUES (?, ?)').run(req.params.section, JSON.stringify(data))
  res.status(201).json(filaDal(db.prepare('SELECT id, data FROM ric_registros WHERE id = ?').get(result.lastInsertRowid)))
})

app.put('/api/ric/:section/:id', exigir('recursos'), seccionRic, (req, res) => {
  const row = db.prepare('SELECT id FROM ric_registros WHERE id = ? AND section = ?').get(req.params.id, req.params.section)
  if (!row) return res.status(404).json({ error: 'Registro no encontrado' })
  const { id: _id, ...data } = req.body || {}
  db.prepare('UPDATE ric_registros SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify(data), req.params.id)
  res.json(filaDal(db.prepare('SELECT id, data FROM ric_registros WHERE id = ?').get(req.params.id)))
})

app.delete('/api/ric/:section/:id', exigir('recursos'), seccionRic, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede eliminar registros' })
  db.prepare('DELETE FROM ric_registros WHERE id = ? AND section = ?').run(req.params.id, req.params.section)
  res.json({ ok: true })
})

// ─── Catálogo de abogados por subdirección ────────────────────────────────────
// Lo consultan quienes ven la subdirección; solo un administrador lo modifica.
// subdirección → permiso que la ve. Litigio y RI-Consultas guardan en sus registros el nombre
// del abogado (no el id): al corregir un nombre en el catálogo se corrige en sus registros.
const SUBDIRECCIONES_ABOGADOS = { recursos: 'recursos', ri: 'recursos', litigio: 'litigio' }

app.get('/api/abogados', (req, res) => {
  const sub = req.query.subdireccion
  if (!SUBDIRECCIONES_ABOGADOS[sub]) return res.status(400).json({ error: 'Subdirección inválida' })
  if (!permisos(req.user)[SUBDIRECCIONES_ABOGADOS[sub]]) return res.status(403).json({ error: 'Sin acceso a este rubro' })
  res.json(db.prepare('SELECT id, nombre, activo FROM abogados WHERE subdireccion = ? ORDER BY activo DESC, nombre').all(sub))
})

app.post('/api/abogados', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede modificar el catálogo de abogados' })
  const { subdireccion, nombre } = req.body || {}
  if (!SUBDIRECCIONES_ABOGADOS[subdireccion]) return res.status(400).json({ error: 'Subdirección inválida' })
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' })
  const r = db.prepare('INSERT INTO abogados (subdireccion, nombre) VALUES (?, ?)').run(subdireccion, nombre.trim())
  res.status(201).json(db.prepare('SELECT id, nombre, activo FROM abogados WHERE id = ?').get(r.lastInsertRowid))
})

app.put('/api/abogados/:id', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede modificar el catálogo de abogados' })
  const actual = db.prepare('SELECT * FROM abogados WHERE id = ?').get(req.params.id)
  if (!actual) return res.status(404).json({ error: 'Abogado no encontrado' })
  const nombre = req.body?.nombre !== undefined ? String(req.body.nombre).trim() : actual.nombre
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' })
  const activo = req.body?.activo !== undefined ? (req.body.activo ? 1 : 0) : actual.activo
  // Si el nombre nuevo ya existe en el catálogo ("Chris" → "Christian"), se fusionan: sus
  // registros pasan a ese nombre y este renglón se quita del catálogo.
  const igual = nombre !== actual.nombre &&
    db.prepare('SELECT id FROM abogados WHERE subdireccion = ? AND nombre = ? AND id <> ?').get(actual.subdireccion, nombre, actual.id)
  if (nombre !== actual.nombre) renombrarEnRegistros(db, actual.subdireccion, actual.nombre, nombre)
  if (igual) {
    db.prepare('DELETE FROM abogados WHERE id = ?').run(actual.id)
    return res.json({ ...db.prepare('SELECT id, nombre, activo FROM abogados WHERE id = ?').get(igual.id), fusionado: true })
  }
  db.prepare('UPDATE abogados SET nombre = ?, activo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nombre, activo, actual.id)
  res.json(db.prepare('SELECT id, nombre, activo FROM abogados WHERE id = ?').get(actual.id))
})

// ─── Días inhábiles (para plazos en días hábiles) ─────────────────────────────
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

app.get('/api/inhabiles', (req, res) => {
  res.json(db.prepare('SELECT fecha, motivo FROM dias_inhabiles ORDER BY fecha').all())
})

app.post('/api/inhabiles', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede capturar días inhábiles' })
  const { fecha, motivo } = req.body || {}
  if (!FECHA_RE.test(fecha || '')) return res.status(400).json({ error: 'Fecha inválida (AAAA-MM-DD)' })
  db.prepare('INSERT INTO dias_inhabiles (fecha, motivo) VALUES (?, ?) ON CONFLICT(fecha) DO UPDATE SET motivo = excluded.motivo')
    .run(fecha, (motivo || '').trim() || null)
  res.status(201).json({ fecha, motivo: (motivo || '').trim() || null })
})

app.delete('/api/inhabiles/:fecha', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede quitar días inhábiles' })
  db.prepare('DELETE FROM dias_inhabiles WHERE fecha = ?').run(req.params.fecha)
  res.json({ ok: true })
})

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }))

// ─── Frontend compilado (dist/) ───────────────────────────────────────────────
const dist = join(__dirname, 'dist')
app.use('/seguimiento', express.static(dist))
app.get(['/seguimiento', '/seguimiento/*'], (req, res) => res.sendFile(join(dist, 'index.html')))

app.listen(PORT, () => console.log(`✅ Seguimiento (SiCoDEAJ) en http://localhost:${PORT}/seguimiento/`))
