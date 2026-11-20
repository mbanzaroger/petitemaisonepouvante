# Visuels des produits de démonstration

Illustrations originales des 12 produits du jeu de données (`services/catalog-service`, migration V2), dessinées en
SVG pour le projet et converties en WebP 600 × 600. La migration Java `V5__images_de_demonstration` les charge en
base (US21, ADR-007) ; l'administrateur peut ensuite les remplacer depuis « Produits et stock ».

Régénérer les images après une modification d'un SVG (Chromium de Playwright et Pillow requis) :

```bash
cd frontend && node ../scripts/images-demo/rendre.mjs
python3 ../scripts/images-demo/webp.py
```
