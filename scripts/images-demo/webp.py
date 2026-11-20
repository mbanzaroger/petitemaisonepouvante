"""Convertit ./png/*.png en WebP (qualité 82) dans les ressources de catalog-service."""
from pathlib import Path

from PIL import Image

ICI = Path(__file__).resolve().parent
CIBLE = ICI.parents[1] / 'services' / 'catalog-service' / 'src' / 'main' / 'resources' / 'db' / 'demo-images'
CIBLE.mkdir(parents=True, exist_ok=True)
for png in sorted((ICI / 'png').glob('*.png')):
    sortie = CIBLE / (png.stem + '.webp')
    Image.open(png).convert('RGB').save(sortie, 'WEBP', quality=82, method=6)
    print(f'{sortie.name} : {sortie.stat().st_size // 1024} Kio')
