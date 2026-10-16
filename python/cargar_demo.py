"""
cargar_demo.py — sube los perfiles demo a Firestore (colección "usuarios").

⚠️ Por defecto NO sube nada: está en modo "ensayo" (--dry-run) y solo
   muestra lo que subiría. Para subir de verdad hay que escribir --confirmar.

Cómo correrlo (desde la carpeta python/):
    python generar_demo.py              # primero, para crear perfiles_demo.json
    python cargar_demo.py               # ensayo: no toca Firebase
    python cargar_demo.py --confirmar   # sube de verdad (solo cuando estés listo)

Para --confirmar necesitas una clave de cuenta de servicio de Firebase:
  1. Descárgala tú desde la consola de Firebase (ver docs/explicaciones/fase-6.md).
  2. Guárdala FUERA de la carpeta del proyecto (ej. Documentos/claves/).
  3. Pon su ruta en la variable de entorno GOOGLE_APPLICATION_CREDENTIALS.
  NUNCA la subas a Git ni la compartas.
"""

import argparse
import json
import os
import sys
from pathlib import Path

from comun import CAMPOS_PERFIL, CARPETA_PROYECTO, CARPETA_SALIDA, DIAS

ARCHIVO = CARPETA_SALIDA / "perfiles_demo.json"
COLECCION = "usuarios"


def leer_argumentos():
    """Lee las opciones escritas después del nombre del script."""
    lector = argparse.ArgumentParser(
        description="Sube los perfiles demo a Firestore (por defecto solo ensayo).")
    # Los dos modos son excluyentes: o ensayo o confirmar, nunca ambos.
    grupo = lector.add_mutually_exclusive_group()
    grupo.add_argument("--dry-run", action="store_true",
                       help="solo muestra lo que subiría (es el modo por defecto)")
    grupo.add_argument("--confirmar", action="store_true",
                       help="SÍ sube los perfiles a Firestore")
    return lector.parse_args()


def leer_perfiles():
    """Carga perfiles_demo.json y revisa que sean seguros de subir."""
    if not ARCHIVO.exists():
        print(f"❌ No existe {ARCHIVO.relative_to(CARPETA_PROYECTO)}.")
        print("   Corre primero:  python generar_demo.py")
        sys.exit(1)
    perfiles = json.loads(ARCHIVO.read_text(encoding="utf-8"))

    # Revisión de seguridad: si algo no cuadra, NO se sube nada.
    problemas = []
    for p in perfiles:
        uid = p.get("uid", "¿sin uid?")
        if p.get("esDemo") is not True:
            problemas.append(f"{uid}: esDemo no es true")
        extras = set(p) - CAMPOS_PERFIL
        if extras:
            problemas.append(f"{uid}: campos no permitidos {sorted(extras)}")
        if not str(uid).startswith("demo-"):
            problemas.append(f"{uid}: el uid de un perfil demo debe empezar con 'demo-'")
    if problemas:
        print("❌ Los perfiles no pasaron la revisión; no se sube nada:")
        for linea in problemas:
            print("   -", linea)
        sys.exit(1)
    return perfiles


def revisar_credenciales():
    """Devuelve la ruta de la clave o None, explicando qué falta."""
    ruta = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not ruta:
        print("🔑 Falta la variable de entorno GOOGLE_APPLICATION_CREDENTIALS.")
        print("   Es la ruta al archivo .json de la cuenta de servicio.")
        print("   Windows (PowerShell):  $env:GOOGLE_APPLICATION_CREDENTIALS=\"C:\\ruta\\clave.json\"")
        print("   Git Bash / Mac / Linux: export GOOGLE_APPLICATION_CREDENTIALS=\"/ruta/clave.json\"")
        return None
    archivo = Path(ruta).expanduser().resolve()
    if not archivo.is_file():
        print(f"🔑 GOOGLE_APPLICATION_CREDENTIALS apunta a un archivo que no existe: {archivo}")
        return None
    # Si la clave está dentro de carpool-zonas/, podría terminar en Git.
    if CARPETA_PROYECTO in archivo.parents:
        print("⛔ La clave está DENTRO de la carpeta del proyecto. Muévela fuera")
        print("   (ej. Documentos/claves/) para que nunca termine en Git.")
        return None
    return archivo


def mostrar_ensayo(perfiles):
    """Modo --dry-run: imprime lo que se subiría, sin conectarse a Firebase."""
    print("=" * 60)
    print(" MODO ENSAYO (--dry-run): NO se sube nada")
    print("=" * 60)
    print(f"Se subirían {len(perfiles)} documentos a la colección '{COLECCION}':\n")
    for p in perfiles:
        dias = sum(p["horario"].get(d) is not None for d in DIAS)
        print(f"   {COLECCION}/{p['uid']}  ·  {p['nombre']:<24} · {p['rol']:<9} · "
              f"zonas={','.join(p['zonas'])} · {dias} días · tol {p['tolerancia']} min")
    print(f"\nTodos con esDemo = true: {all(p['esDemo'] is True for p in perfiles)}")
    print("\n¿Credenciales listas para subir de verdad?")
    if revisar_credenciales():
        print("   ✅ Sí. Cuando quieras subir:  python cargar_demo.py --confirmar")
    else:
        print("   ❌ Todavía no (es normal si aún no creaste el proyecto de Firebase).")


def subir(perfiles, clave):
    """Modo --confirmar: sube los perfiles con firebase-admin."""
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError:
        print("❌ Falta firebase-admin. Instálalo con:  pip install -r requirements.txt")
        sys.exit(1)

    firebase_admin.initialize_app(credentials.Certificate(str(clave)))
    db = firestore.client()

    # Un "lote" (batch) junta varias escrituras y las manda de una sola vez:
    # o se guardan todas o ninguna.
    lote = db.batch()
    for p in perfiles:
        # El id del documento es el uid: si lo corres dos veces, se
        # SOBRESCRIBEN los mismos 35 documentos (no se duplican).
        lote.set(db.collection(COLECCION).document(p["uid"]), p)
    lote.commit()
    print(f"✅ Subidos {len(perfiles)} perfiles demo a '{COLECCION}'.")


def main():
    argumentos = leer_argumentos()
    perfiles = leer_perfiles()

    if not argumentos.confirmar:
        mostrar_ensayo(perfiles)
        return

    clave = revisar_credenciales()
    if clave is None:
        print("\n❌ No se subió nada: faltan credenciales válidas.")
        sys.exit(1)
    respuesta = input(f"Vas a escribir {len(perfiles)} documentos en Firestore. "
                      "Escribe SI para continuar: ")
    if respuesta.strip().upper() != "SI":
        print("Cancelado. No se subió nada.")
        return
    subir(perfiles, clave)


if __name__ == "__main__":
    main()
