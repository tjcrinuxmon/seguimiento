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
// Los roles y direcciones vienen del portal (rol_tareas / direccion_tareas).
export const permisos = (u) => ({
  // Asuntos Laborales → Litigio (y su dashboard)
  litigio:   u?.role === 'admin' || u?.role === 'ejecutiva' || u?.direccion === 'asuntos_laborales',
  // Contratos y Convenios → Convenios (y su reporte): solo esa dirección y administradores
  convenios: u?.role === 'admin' || u?.direccion === 'contratos_convenios',
})

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

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, direccion: u.direccion })

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
    db.prepare('INSERT INTO users (username, email, name, role, direccion, puesto) VALUES (?,?,?,?,?,?)')
      .run(email, email, payload.name || email, payload.role || 'director', payload.direccion || null, payload.puesto || null)
  } else {
    db.prepare('UPDATE users SET name=?, role=?, direccion=?, puesto=? WHERE id=?')
      .run(payload.name || existing.name, payload.role || existing.role, payload.direccion || null,
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

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }))

// ─── Frontend compilado (dist/) ───────────────────────────────────────────────
const dist = join(__dirname, 'dist')
app.use('/seguimiento', express.static(dist))
app.get(['/seguimiento', '/seguimiento/*'], (req, res) => res.sendFile(join(dist, 'index.html')))

app.listen(PORT, () => console.log(`✅ Seguimiento (SiCoDEAJ) en http://localhost:${PORT}/seguimiento/`))
