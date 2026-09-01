import pandas as pd
import os
from pathlib import Path

# Configuración
RUTA_IMAGENES = r"C:\Users\alinc\Documents\lechic-catalogo\public\images\productos\lbel\L_BEL"
ARCHIVO_EXCEL = r"C:\Users\alinc\Documents\lechic-catalogo\public\images\productos\lbel\L_BEL\rename.xlsx"

# También puedes especificar una ruta diferente para el Excel si está en otra ubicación:
# ARCHIVO_EXCEL = r"C:\ruta\a\tu\rename.xlsx"

def renombrar_imagenes():
    """
    Lee el Excel y renombra las imágenes que coincidan.
    """
    
    # Validar que la carpeta existe
    if not os.path.exists(RUTA_IMAGENES):
        print(f"❌ Error: La carpeta no existe: {RUTA_IMAGENES}")
        return
    
    # Validar que el Excel existe
    if not os.path.exists(ARCHIVO_EXCEL):
        print(f"❌ Error: El archivo Excel no existe: {ARCHIVO_EXCEL}")
        return
    
    try:
        # Leer el Excel
        df = pd.read_excel(ARCHIVO_EXCEL)
        print(f"✓ Excel cargado correctamente")
        print(f"✓ Se encontraron {len(df)} registros para renombrar\n")
        
    except Exception as e:
        print(f"❌ Error al leer el Excel: {e}")
        return
    
    # Contar resultados
    renombrados = 0
    no_encontrados = 0
    errores = []
    
    # Iterar sobre cada fila del Excel
    for idx, row in df.iterrows():
        old_name = str(row['old_name']).strip()
        new_name = str(row['new_name']).strip()
        
        ruta_old = os.path.join(RUTA_IMAGENES, old_name)
        ruta_new = os.path.join(RUTA_IMAGENES, new_name)
        
        # Verificar si el archivo existe
        if os.path.exists(ruta_old):
            try:
                # Renombrar
                os.rename(ruta_old, ruta_new)
                renombrados += 1
                print(f"✓ Renombrado: {old_name} → {new_name}")
            except Exception as e:
                errores.append((old_name, new_name, str(e)))
                print(f"❌ Error al renombrar {old_name}: {e}")
        else:
            no_encontrados += 1
            print(f"⚠ No encontrado: {old_name}")
    
    # Reporte final
    print("\n" + "="*60)
    print("REPORTE FINAL")
    print("="*60)
    print(f"✓ Renombrados correctamente: {renombrados}")
    print(f"⚠ No encontrados: {no_encontrados}")
    print(f"❌ Errores: {len(errores)}")
    
    if errores:
        print("\nDetalles de errores:")
        for old, new, error in errores:
            print(f"  - {old} → {new}: {error}")

if __name__ == "__main__":
    print("Iniciando renombrado de imágenes...\n")
    renombrar_imagenes()
    print("\n¡Proceso completado!")