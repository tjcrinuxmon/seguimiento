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
| Asuntos Laborales | Subdirección de Recursos y Consultas: PLS y RI-Consultas (+ dashboard) | En uso | Administradores, Dirección Ejecutiva y Asuntos Laborales |
| Contratos y Convenios | Convenios (+ reporte) | En uso | Administradores y Contratos y Convenios |
| Contratos y Convenios | Contratos | Por definir | — |

Asuntos Laborales tiene dos niveles de dashboard: el de la dirección (alertas sumadas y,
de cada subdirección, cifras y plazos) y el de cada subdirección (`#/litigio/dashboard`,
`#/recursos/dashboard`), que se abre desde la franja de alertas arriba de la captura.
Todos usan los mismos cálculos (`src/components/tablero/dal.js`): cada asunto con
vencimiento se clasifica como vencido, por vencer (≤3 y 4–7 días), en plazo, atendido a tiempo
o fuera de plazo, y cada número de la matriz o de la carga por abogado abre el detalle
filtrado. Qué campo da por atendido cada tipo está en `TIPOS_LITIGIO` (debe coincidir con
`entregaBadge` en `DALView.jsx`).

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

## Recursos y Consultas: PLS y RI-Consultas

La subdirección tiene dos partes con un selector arriba: **PLS** (Procedimiento Laboral
Sancionador, `#/recursos`: expedientes con plazos calculados) y **RI-Consultas**
(`#/recursos/ri`): los catálogos que se llevaban en el Excel "JDRYC", una pestaña por hoja
(jurídico-laboral, rescisiones, transparencia, CTRL, requerimientos TEPJF/OIC, turno RI y
protocolo). Los campos de cada catálogo están en `src/recursos/riCampos.js`.

El Excel se importa una sola vez; después se captura en el sistema:

```bash
node scripts/importar-jdryc.js "EXCEL JDRYC.xlsx" --simular   # muestra qué haría, sin escribir
node scripts/importar-jdryc.js "EXCEL JDRYC.xlsx"             # importa (--forzar para reemplazar)
```

Limpia fechas, separa oficio y fecha cuando venían juntos y unifica nombres de abogados; lo
que no pudo leer queda con su texto original en "Notas de la importación" de cada registro.

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
