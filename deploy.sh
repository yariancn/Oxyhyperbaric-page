#!/bin/bash
# DEPRECATED: Este script desplegaba al proyecto Pages duplicado (ya eliminado).
# Usa: npx wrangler deploy
set -e
cd "$(dirname "$0")"
PROJECT_NAME="${1:-oxyhyperbaric-page}"

echo "→ Verificando sesión Cloudflare..."
npx wrangler whoami

echo "→ Creando proyecto si no existe..."
npx wrangler pages project create "$PROJECT_NAME" --production-branch main 2>/dev/null || true

echo "→ Desplegando a Cloudflare Pages..."
npx wrangler pages deploy . --project-name="$PROJECT_NAME" --branch=main --commit-dirty=true

echo ""
echo "Listo. URL staging: https://${PROJECT_NAME}.pages.dev"
