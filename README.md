# Seguimiento — SiCoDEAJ

Módulo de SiCoDEAJ donde cada dirección de la DEAJ reporta el seguimiento de sus rubros.
Sustituye al módulo **Tareas** (`tareas2`), que quedó archivado sin cambios en
[tjcrinuxmon/tareas2](https://github.com/tjcrinuxmon/tareas2) por si alguna de sus
funciones (tareas, calendario, seguimiento diario, oficios, gestión de usuarios) se
vuelve a necesitar.

## Rubros

| Dirección | Rubro | Estado | Quién lo ve |
|---|---|---|---|
| Asuntos Laborales | Subdirección de Litigio (+ dashboard) | En uso | Administradores, Dirección Ejecutiva y Asuntos Laborales |
| Asuntos Laborales | Subdirección de Consulta | Por definir | — |
| Contratos y Convenios | Convenios (+ reporte) | En uso | Administradores y Contratos y Convenios |
| Contratos y Convenios | Contratos | Por definir | — |

Los rubros y sus permisos se definen en `src/rubros.js` (menú e inicio) y en
`permisos()` de `server.js` (API); deben coincidir.

## Cómo encaja en SiCoDEAJ

- **Gateway**: `/seguimiento/*` → este servidor; `/api/seg/*` → `/api/*`; `/tareas2` redirige aquí.
- **Portal**: tarjeta "Seguimiento". El acceso, rol y dirección de cada persona se
  administran en el portal (campos `acceso_tareas`, `rol_tareas`, `direccion_tareas`) y se
  sincronizan a `seguimiento.db`. El SSO se firma con `TAREAS_SECRET` del portal, que debe
  ser igual a `PORTAL_SSO_SECRET` aquí.
- **Puertos**: prod 3009, staging 3109.

## Desarrollo

```bash
npm install
cp .env.example .env          # y ajusta los secretos
npm run dev                   # servidor :3009 + Vite :5176
```

## Migración desde Tareas (una sola vez)

```bash
node scripts/migrar-desde-tareas.js ../tareas/tareas.db
```

Copia usuarios, convenios y registros de Litigio conservando sus id, abre la base de
origen en solo lectura y verifica conteos por tabla y por sección. Si `seguimiento.db` ya
tiene datos se detiene (usa `--forzar` para reemplazarlos).

## Despliegue

```bash
./deploy.sh                       # prod (PM2 "seguimiento")
./deploy.sh seguimiento-staging   # staging
```
