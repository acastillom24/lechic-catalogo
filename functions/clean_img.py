import os
import unicodedata
from pathlib import Path

def remove_accents(text):
    """Elimina tildes y acentos del texto"""
    nfd = unicodedata.normalize('NFD', text)
    return ''.join(char for char in nfd if unicodedata.category(char) != 'Mn')

def rename_images_in_folder(folder_path):
    """
    Lista y renombra imágenes eliminando tildes del nombre
    
    Args:
        folder_path (str): Ruta de la carpeta con imágenes
    """
    
    # Extensiones de imagen válidas
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'}
    
    # Verificar que la carpeta existe
    if not os.path.exists(folder_path):
        print(f"❌ Error: La carpeta no existe: {folder_path}")
        return
    
    # Obtener lista de archivos
    files = os.listdir(folder_path)
    images = [f for f in files if os.path.splitext(f)[1].lower() in image_extensions]
    
    if not images:
        print(f"⚠️  No se encontraron imágenes en: {folder_path}")
        return
    
    print(f"\n📁 Carpeta: {folder_path}")
    print(f"🖼️  Imágenes encontradas: {len(images)}\n")
    
    renamed_count = 0
    
    for filename in images:
        # Separar nombre y extensión
        name, ext = os.path.splitext(filename)
        
        # Eliminar tildes del nombre
        new_name = remove_accents(name)
        new_filename = new_name + ext.lower()
        
        # Si el nombre cambió, renombrar
        if filename != new_filename:
            old_path = os.path.join(folder_path, filename)
            new_path = os.path.join(folder_path, new_filename)
            
            try:
                os.rename(old_path, new_path)
                print(f"✅ {filename}")
                print(f"   → {new_filename}\n")
                renamed_count += 1
            except Exception as e:
                print(f"❌ Error al renombrar {filename}: {str(e)}\n")
        else:
            print(f"⏭️  {filename} (sin cambios)\n")
    
    print(f"\n{'='*60}")
    print(f"✨ Proceso completado!")
    print(f"   • Total de imágenes: {len(images)}")
    print(f"   • Renombradas: {renamed_count}")
    print(f"   • Sin cambios: {len(images) - renamed_count}")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    # Reemplaza esta ruta con tu carpeta
    folder_path = r"C:\Users\alinc\Documents\lechic-catalogo\public\images\productos\lbel\L_BEL"
    
    rename_images_in_folder(folder_path)