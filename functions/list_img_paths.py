# listar_imagenes.py
from pathlib import Path
import csv

RAIZ = Path(r"C:\Users\alinc\Documents\lechic-catalogo\public\images\productos\yanbal")   # ajusta esto
SALIDA = RAIZ.parent / "yanbal_imagenes.csv"
EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".avif"}

filas = []
for p in sorted(RAIZ.rglob("*")):
    if p.is_file() and p.suffix.lower() in EXT:
        rel = p.relative_to(RAIZ)
        filas.append({
            "nombre": p.name,
            "nombre_sin_ext": p.stem,
            "extension": p.suffix.lower().lstrip("."),
            "carpeta": str(rel.parent).replace("\\", "/") if rel.parent != Path(".") else "",
            "ruta_relativa": str(rel).replace("\\", "/"),
            "ruta_absoluta": str(p.resolve()),
            "peso_kb": round(p.stat().st_size / 1024, 1),
        })

with open(SALIDA, "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=list(filas[0].keys()))
    w.writeheader()
    w.writerows(filas)

print(f"{len(filas)} imágenes -> {SALIDA}")