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

======================================================================
GUÍA DE NOMBRES DE VARIABLES (cargar_demo.py)
======================================================================
Las constantes que vienen de comun.py están explicadas en la guía de comun.py.

--- Constantes ---
RUTA_JSON_PERFILES_DEMO      salida/perfiles_demo.json, el archivo que creó
                             generar_demo.py y que aquí se sube.
NOMBRE_COLECCION_FIRESTORE   "usuarios": la colección de Firestore donde van
                             los perfiles. Debe coincidir con la que lee la app.

--- leer_argumentos() ---
lector_de_argumentos         Objeto de argparse que entiende --dry-run y --confirmar.
grupo_modos_excluyentes      Grupo que impide usar los dos modos a la vez.

--- leer_perfiles() ---
perfiles_demo                Lista de perfiles leída del JSON.
problemas_encontrados        Lista de errores de seguridad. Si NO está vacía,
                             no se sube nada (protege datos reales).
perfil                       Un perfil mientras se revisa.
uid_perfil                   El identificador del perfil ("demo-001").
campos_no_permitidos         Campos que el perfil trae de más (ej. "telefono").
descripcion_problema         Un problema mientras se imprime.

--- revisar_credenciales() ---
ruta_clave_en_variable_entorno
                             Texto guardado en GOOGLE_APPLICATION_CREDENTIALS.
archivo_clave_resuelto       Esa ruta convertida en ruta completa y real. Se
                             revisa que exista y que esté FUERA del proyecto.

--- mostrar_ensayo() ---
cantidad_dias_con_horario    Cuántos días de la semana tiene horario el perfil.
dia_de_clase                 Un día ("lunes"...) mientras se cuenta.

--- subir() ---
ruta_clave_cuenta_servicio   Ruta al .json de la clave de Firebase.
base_de_datos_firestore      Conexión con Firestore.
lote_de_escrituras           "Batch": junta todas las escrituras para que se
                             guarden todas juntas o ninguna.

--- ejecutar_programa_principal() ---
argumentos_de_terminal       Las opciones que escribiste al correr el script.
respuesta_confirmacion_usuario
                             Lo que escribiste cuando pregunta "Escribe SI".

--- Nombres que NO se cambiaron (y por qué) ---
--dry-run, --confirmar       Son las opciones de la terminal; la documentación
                             del proyecto ya las usa.
GOOGLE_APPLICATION_CREDENTIALS
                             Nombre oficial que exige Google; no se puede cambiar.
firebase_admin, credentials, firestore, argparse
                             Nombres de librerías (no son nuestros).
"uid", "esDemo", "horario"...
                             Campos del perfil en Firestore.
======================================================================
"""

import argparse
import json
import os
import sys
from pathlib import Path

from comun import (CAMPOS_PERMITIDOS_EN_PERFIL, CARPETA_RAIZ_DEL_PROYECTO,
                   CARPETA_DE_RESULTADOS_GENERADOS, DIAS_DE_CLASE_SIN_TILDE)

RUTA_JSON_PERFILES_DEMO = CARPETA_DE_RESULTADOS_GENERADOS / "perfiles_demo.json"
NOMBRE_COLECCION_FIRESTORE = "usuarios"


def leer_argumentos():
    """Lee las opciones escritas después del nombre del script."""
    lector_de_argumentos = argparse.ArgumentParser(
        description="Sube los perfiles demo a Firestore (por defecto solo ensayo).")
    # Los dos modos son excluyentes: o ensayo o confirmar, nunca ambos.
    grupo_modos_excluyentes = lector_de_argumentos.add_mutually_exclusive_group()
    grupo_modos_excluyentes.add_argument(
        "--dry-run", action="store_true",
        help="solo muestra lo que subiría (es el modo por defecto)")
    grupo_modos_excluyentes.add_argument(
        "--confirmar", action="store_true",
        help="SÍ sube los perfiles a Firestore")
    return lector_de_argumentos.parse_args()


def leer_perfiles():
    """Carga perfiles_demo.json y revisa que sean seguros de subir."""
    if not RUTA_JSON_PERFILES_DEMO.exists():
        print(f"❌ No existe {RUTA_JSON_PERFILES_DEMO.relative_to(CARPETA_RAIZ_DEL_PROYECTO)}.")
        print("   Corre primero:  python generar_demo.py")
        sys.exit(1)
    perfiles_demo = json.loads(RUTA_JSON_PERFILES_DEMO.read_text(encoding="utf-8"))

    # Revisión de seguridad: si algo no cuadra, NO se sube nada.
    problemas_encontrados = []
    for perfil in perfiles_demo:
        uid_perfil = perfil.get("uid", "¿sin uid?")
        if perfil.get("esDemo") is not True:
            problemas_encontrados.append(f"{uid_perfil}: esDemo no es true")
        campos_no_permitidos = set(perfil) - CAMPOS_PERMITIDOS_EN_PERFIL
        if campos_no_permitidos:
            problemas_encontrados.append(
                f"{uid_perfil}: campos no permitidos {sorted(campos_no_permitidos)}")
        if not str(uid_perfil).startswith("demo-"):
            problemas_encontrados.append(
                f"{uid_perfil}: el uid de un perfil demo debe empezar con 'demo-'")
    if problemas_encontrados:
        print("❌ Los perfiles no pasaron la revisión; no se sube nada:")
        for descripcion_problema in problemas_encontrados:
            print("   -", descripcion_problema)
        sys.exit(1)
    return perfiles_demo


def revisar_credenciales():
    """Devuelve la ruta de la clave o None, explicando qué falta."""
    ruta_clave_en_variable_entorno = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not ruta_clave_en_variable_entorno:
        print("🔑 Falta la variable de entorno GOOGLE_APPLICATION_CREDENTIALS.")
        print("   Es la ruta al archivo .json de la cuenta de servicio.")
        print("   Windows (PowerShell):  $env:GOOGLE_APPLICATION_CREDENTIALS=\"C:\\ruta\\clave.json\"")
        print("   Git Bash / Mac / Linux: export GOOGLE_APPLICATION_CREDENTIALS=\"/ruta/clave.json\"")
        return None
    archivo_clave_resuelto = Path(ruta_clave_en_variable_entorno).expanduser().resolve()
    if not archivo_clave_resuelto.is_file():
        print("🔑 GOOGLE_APPLICATION_CREDENTIALS apunta a un archivo que no existe: "
              f"{archivo_clave_resuelto}")
        return None
    # Si la clave está dentro de carpool-zonas/, podría terminar en Git.
    if CARPETA_RAIZ_DEL_PROYECTO in archivo_clave_resuelto.parents:
        print("⛔ La clave está DENTRO de la carpeta del proyecto. Muévela fuera")
        print("   (ej. Documentos/claves/) para que nunca termine en Git.")
        return None
    return archivo_clave_resuelto


def mostrar_ensayo(perfiles_demo):
    """Modo --dry-run: imprime lo que se subiría, sin conectarse a Firebase."""
    print("=" * 60)
    print(" MODO ENSAYO (--dry-run): NO se sube nada")
    print("=" * 60)
    print(f"Se subirían {len(perfiles_demo)} documentos a la colección "
          f"'{NOMBRE_COLECCION_FIRESTORE}':\n")
    for perfil in perfiles_demo:
        cantidad_dias_con_horario = sum(perfil["horario"].get(dia_de_clase) is not None
                                        for dia_de_clase in DIAS_DE_CLASE_SIN_TILDE)
        print(f"   {NOMBRE_COLECCION_FIRESTORE}/{perfil['uid']}  ·  {perfil['nombre']:<24} · "
              f"{perfil['rol']:<9} · zonas={','.join(perfil['zonas'])} · "
              f"{cantidad_dias_con_horario} días · tol {perfil['tolerancia']} min")
    print(f"\nTodos con esDemo = true: {all(perfil['esDemo'] is True for perfil in perfiles_demo)}")
    print("\n¿Credenciales listas para subir de verdad?")
    if revisar_credenciales():
        print("   ✅ Sí. Cuando quieras subir:  python cargar_demo.py --confirmar")
    else:
        print("   ❌ Todavía no (es normal si aún no creaste el proyecto de Firebase).")


def subir(perfiles_demo, ruta_clave_cuenta_servicio):
    """Modo --confirmar: sube los perfiles con firebase-admin."""
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError:
        print("❌ Falta firebase-admin. Instálalo con:  pip install -r requirements.txt")
        sys.exit(1)

    firebase_admin.initialize_app(credentials.Certificate(str(ruta_clave_cuenta_servicio)))
    base_de_datos_firestore = firestore.client()

    # Un "lote" (batch) junta varias escrituras y las manda de una sola vez:
    # o se guardan todas o ninguna.
    lote_de_escrituras = base_de_datos_firestore.batch()
    for perfil in perfiles_demo:
        # El id del documento es el uid: si lo corres dos veces, se
        # SOBRESCRIBEN los mismos 35 documentos (no se duplican).
        lote_de_escrituras.set(
            base_de_datos_firestore.collection(NOMBRE_COLECCION_FIRESTORE).document(perfil["uid"]),
            perfil)
    lote_de_escrituras.commit()
    print(f"✅ Subidos {len(perfiles_demo)} perfiles demo a '{NOMBRE_COLECCION_FIRESTORE}'.")


def ejecutar_programa_principal():
    argumentos_de_terminal = leer_argumentos()
    perfiles_demo = leer_perfiles()

    if not argumentos_de_terminal.confirmar:
        mostrar_ensayo(perfiles_demo)
        return

    ruta_clave_cuenta_servicio = revisar_credenciales()
    if ruta_clave_cuenta_servicio is None:
        print("\n❌ No se subió nada: faltan credenciales válidas.")
        sys.exit(1)
    respuesta_confirmacion_usuario = input(
        f"Vas a escribir {len(perfiles_demo)} documentos en Firestore. "
        "Escribe SI para continuar: ")
    if respuesta_confirmacion_usuario.strip().upper() != "SI":
        print("Cancelado. No se subió nada.")
        return
    subir(perfiles_demo, ruta_clave_cuenta_servicio)


if __name__ == "__main__":
    ejecutar_programa_principal()
