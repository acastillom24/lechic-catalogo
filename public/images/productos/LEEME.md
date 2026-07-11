# Cómo administrar las imágenes de productos

Aquí van las fotos de los productos. La estructura es por marca:

```
public/images/productos/
├── importaciones/
│   ├── expression-original.png
│   ├── expression-magic.png
│   └── ...
├── esika/
├── yanbal/
├── natura-avon/
└── dupree-oriflame/
```

## Reglas para que el catálogo se vea bien

1. **Formato**: PNG con fondo transparente es lo ideal (el frasco "flota"
   sobre el degradado rosa de la tarjeta). También sirve JPG con fondo blanco.

2. **Proporción**: las tarjetas usan proporción vertical 3:4. Una imagen de
   600×800 px queda perfecta. Si la foto es cuadrada o muy ancha, no se
   deforma: se ajusta dentro del marco (object-fit: contain), pero se ve
   mejor si respetas el formato vertical.

3. **Nombre del archivo**: minúsculas, con guiones, sin tildes ni espacios.
   Ejemplo: `expression-magic.png`, no `Expression Magic.PNG`.

4. **Peso**: comprime las imágenes antes de subirlas (usa tinypng.com o
   similar). Apunta a menos de 200 KB por imagen para que el sitio cargue
   rápido.

## Variantes (1, 2, 3 o más tipos por perfume)

Cada variante tiene su propia imagen. En `data/productos.js`, dentro del
array `variantes`, cada objeto apunta a su archivo:

```js
variantes: [
  { nombre: "Original", precio: 27, imagen: "/images/productos/importaciones/expression-original.png" },
  { nombre: "Magic",    precio: 35, imagen: "/images/productos/importaciones/expression-magic.png" },
]
```

- En la **tarjeta del catálogo** se muestra la primera variante + un aviso
  de cuántas presentaciones hay + el precio "desde".
- En la **página del producto** aparecen todos los botones para cambiar
  entre variantes, y la imagen/precio/aromas cambian al seleccionar.

## Si falta una imagen

No se rompe nada: la tarjeta muestra un marco con el nombre del producto.
Puedes publicar aunque te falten fotos y agregarlas después.
