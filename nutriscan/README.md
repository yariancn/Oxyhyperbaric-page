# VerdiScan

PWA de escaneo alimentario para México y USA. Consulta [Open Food Facts](https://world.openfoodfacts.org) y aplica criterios propios de salud.

## Uso local

```bash
cd nutriscan
python3 -m http.server 8080
# Abrir http://localhost:8080
```

## Criterios de salud (v1.0)

Basados en literatura reciente:

- **NOVA** (Monteiro et al., Public Health Nutrition 2018) — ultraprocesados
- **NutriNet-Santé** — emulsificantes E471, carragenina E407
- **OMS 2023** — edulcorantes no nutritivos
- **IARC 2023** — aspartamo Grupo 2B
- **Frontiers in Public Health 2026** — aditivos en alimentos ultraprocesados

## Disclaimer

Herramienta informativa. No constituye consejo médico ni nutricional.
