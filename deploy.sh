#!/usr/bin/env bash
#
# Deploy de Seguimiento: actualiza el código, compila el frontend (Vite) y reinicia con PM2.
# Es una app compilada: el navegador carga dist/, así que un "git pull" no basta.
#
# Uso:
#   ./deploy.sh                    # app PM2 "seguimiento", rama "main"
#   ./deploy.sh seguimiento-staging # otra app de PM2 (misma rama)
#
set -euo pipefail

APP="${1:-seguimiento}"
BRANCH="main"
cd "$(dirname "$0")"

echo "▶ 1/4  Actualizando código ($BRANCH)…"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git merge --ff-only "origin/$BRANCH"

echo "▶ 2/4  Instalando dependencias…"
npm ci --no-audit --no-fund

echo "▶ 3/4  Compilando frontend…"
npm run build

echo "▶ 4/4  Reiniciando en PM2 ($APP)…"
if pm2 describe "$APP" > /dev/null 2>&1; then
  pm2 restart "$APP" --update-env
else
  pm2 start server.js --name "$APP"
fi
pm2 save
echo "✅ Despliegue de $APP completado."
