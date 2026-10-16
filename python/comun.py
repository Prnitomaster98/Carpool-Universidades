"""
comun.py — funciones y constantes que comparten los scripts de la Fase 6.

No se ejecuta solo: lo usan analisis_encuesta.py y generar_demo.py con
    from comun import ...

Aquí está TODO lo que probablemente tengas que ajustar cuando tengas la
encuesta real (nombres de columnas, alias de zonas), para no tener que
buscarlo en varios archivos.
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

# ----------------------------------------------------------------------
# 0. Que los acentos y emojis se vean bien también en la terminal de Windows
# ----------------------------------------------------------------------
# La terminal clásica de Windows usa otra codificación y a veces falla al
# imprimir "á" o "✅". reconfigure() la cambia a UTF-8 si se puede.
for _flujo in (sys.stdout, sys.stderr):
    try:
        _flujo.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass  # en Colab o terminales viejas simplemente no hace falta

# ----------------------------------------------------------------------
# 1. Rutas (carpetas y archivos)
# ----------------------------------------------------------------------
# Path(__file__) es la ruta de ESTE archivo. .parent es su carpeta (python/).
# Así los scripts funcionan aunque los corras desde otra carpeta.
CARPETA_PYTHON = Path(__file__).resolve().parent
CARPETA_DATOS = CARPETA_PYTHON / "data"
CARPETA_SALIDA = CARPETA_PYTHON / "salida"          # ignorada por Git
CARPETA_PROYECTO = CARPETA_PYTHON.parent            # carpool-zonas/

ENCUESTA_REAL = CARPETA_DATOS / "encuesta.csv"
ENCUESTA_EJEMPLO = CARPETA_DATOS / "encuesta_ejemplo.csv"
ZONAS_GEOJSON = CARPETA_PROYECTO / "web" / "data" / "zonas.geojson"

# ----------------------------------------------------------------------
# 2. Días de la semana
# ----------------------------------------------------------------------
# Las claves van SIN tilde ("miercoles") para que sean fáciles de usar
# en JavaScript: perfil.horario.miercoles
DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes"]
DIAS_BONITOS = {"lunes": "Lunes", "martes": "Martes", "miercoles": "Miércoles",
                "jueves": "Jueves", "viernes": "Viernes"}

# Los ÚNICOS campos que puede tener un perfil de la colección usuarios
# (modelo de datos del plan). No hay dirección, coordenadas, teléfono ni foto.
CAMPOS_PERFIL = {"uid", "nombre", "carrera", "rol", "zonas", "horario",
                 "tolerancia", "esDemo"}

# ----------------------------------------------------------------------
# 3. Columnas del Google Form
# ----------------------------------------------------------------------
# A la IZQUIERDA: el nombre que usan los scripts (no lo cambies).
# A la DERECHA: el encabezado EXACTO de la columna en el CSV.
# ⚠️ Si en tu Google Form escribiste las preguntas con otras palabras,
#    cambia solo el texto de la derecha.
COLUMNAS = {
    "zona": "Zona de origen",
    "transporte": "Medio de transporte",
    "espera": "Minutos de espera tolerables",
    "interes": "¿La usarías? (1-5)",
    "freno": "¿Qué te frenaría?",
}
# Las columnas de horario se generan solas: "Entrada lunes", "Salida lunes", ...
for _dia in DIAS:
    COLUMNAS[f"entrada_{_dia}"] = f"Entrada {DIAS_BONITOS[_dia].lower()}"
    COLUMNAS[f"salida_{_dia}"] = f"Salida {DIAS_BONITOS[_dia].lower()}"

# ----------------------------------------------------------------------
# 4. Zonas
# ----------------------------------------------------------------------
# Los ids y nombres de las zonas se leen de web/data/zonas.geojson (Fase 2).
# Esta lista PROVISIONAL (los mismos ids) solo se usa si ese archivo no existe.
ZONAS_PROVISIONALES = [
    {"id": "zona-centro", "nombre": "Zona Centro"},
    {"id": "zona-norte", "nombre": "Zona Norte"},
    {"id": "zona-sur", "nombre": "Zona Sur"},
    {"id": "zona-este", "nombre": "Zona Este"},
    {"id": "zona-oeste", "nombre": "Zona Oeste"},
]

# Formas "raras" en que la gente escribe una zona → id de la zona.
# Las claves van "normalizadas" (minúsculas, sin tildes, espacios ni signos).
# No hace falta poner "zonanorte" ni "norte": esas se reconocen solas.
# ⚠️ Cuando tengas las zonas reales, agrega aquí los apodos que aparezcan
#    en la encuesta (el análisis te muestra los que no reconoció).
ALIAS_ZONAS = {
    "zn": "zona-norte",
    "zs": "zona-sur",
    "ze": "zona-este",
    "zo": "zona-oeste",
    "elcentro": "zona-centro",
}


def normalizar(texto):
    """'  Zona 10 ' → 'zona10'. Quita tildes, espacios, puntos y mayúsculas.

    Sirve para comparar textos que la gente escribe distinto.
    """
    if texto is None:
        return ""
    texto = str(texto).strip().lower()
    # unicodedata separa "á" en "a" + tilde; luego nos quedamos solo con la letra
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", texto)  # deja solo letras y números


def cargar_zonas():
    """Devuelve (lista_de_zonas, vienen_del_geojson).

    Cada zona es un diccionario {"id": ..., "nombre": ...}.
    """
    if ZONAS_GEOJSON.exists():
        datos = json.loads(ZONAS_GEOJSON.read_text(encoding="utf-8"))
        zonas = []
        for feature in datos.get("features", []):
            props = feature.get("properties", {})
            if props.get("id"):
                zonas.append({"id": props["id"],
                              "nombre": props.get("nombre", props["id"])})
        if zonas:
            return zonas, True
    return ZONAS_PROVISIONALES, False


def nombre_limpio(zona):
    """'Zona Norte — ejemplo' → 'Zona Norte' (quita la marca de ejemplo)."""
    return re.split(r"\s+[—–-]\s+ejemplo", zona["nombre"], flags=re.I)[0].strip()


def id_de_zona(texto, zonas):
    """Lo que escribió el estudiante → id de la zona, o None si no se reconoce.

    Ejemplos: 'Zona Norte', 'zona norte', 'NORTE', 'zona-norte' → 'zona-norte'
    """
    clave = normalizar(texto)
    if not clave:
        return None
    for z in zonas:
        formas = {
            normalizar(nombre_limpio(z)),                # "zonanorte"
            normalizar(z["id"]),                         # "zonanorte"
            normalizar(re.sub(r"^zona-?", "", z["id"])),  # "norte"
        }
        if clave in formas:
            return z["id"]
    if ALIAS_ZONAS.get(clave) in {z["id"] for z in zonas}:
        return ALIAS_ZONAS[clave]
    return None


def unificar_zona(texto, zonas):
    """Convierte lo que escribió el estudiante en el nombre oficial de la zona.

    Si no se reconoce, devuelve el texto limpio (con mayúscula inicial) para
    que igual aparezca en el análisis y puedas agregarlo a ALIAS_ZONAS.
    """
    if not normalizar(texto):
        return None
    zid = id_de_zona(texto, zonas)
    if zid:
        return next(nombre_limpio(z) for z in zonas if z["id"] == zid)
    return str(texto).strip().title()


# Reconoce "7:00", "07:00", "7:00:00", "7:00 a. m.", "1:30 p.m.", "13h30", "7"
_PATRON_HORA = re.compile(r"^(\d{1,2})(?:[:h.](\d{2}))?(?::\d{2})?\s*([ap])?")


def limpiar_hora(valor):
    """Convierte cualquier forma de escribir una hora a 'HH:MM' (24 h).

    Devuelve None si la celda está vacía o no se entiende.
    """
    if valor is None:
        return None
    texto = str(valor).strip().lower().replace(" ", "").replace(".", "")
    # replace(".", "") convierte "p. m." en "pm"; "7.30" se trata aparte abajo
    if texto in ("", "nan", "none", "-", "noaplica", "na"):
        return None
    texto = re.sub(r"^(\d{1,2})(\d{2})(?=[ap]|$)", r"\1:\2", texto)  # "730pm"→"7:30pm"
    coincidencia = _PATRON_HORA.match(texto)
    if not coincidencia:
        return None
    hora = int(coincidencia.group(1))
    minuto = int(coincidencia.group(2) or 0)
    ampm = coincidencia.group(3)
    if ampm == "p" and hora < 12:
        hora += 12          # 1:30 p. m. → 13:30
    if ampm == "a" and hora == 12:
        hora = 0            # 12:00 a. m. → 00:00
    if hora > 23 or minuto > 59:
        return None
    return f"{hora:02d}:{minuto:02d}"   # :02d = dos dígitos con cero a la izquierda


def aviso_grande(lineas):
    """Imprime un recuadro llamativo en la terminal."""
    ancho = max(len(l) for l in lineas) + 4
    print("\n" + "#" * ancho)
    for l in lineas:
        print("# " + l.ljust(ancho - 4) + " #")
    print("#" * ancho + "\n")


def leer_encuesta():
    """Lee la encuesta y la devuelve LIMPIA como tabla de pandas.

    Devuelve (tabla, es_real). es_real es False si se usó el archivo de ejemplo.
    """
    import pandas as pd  # se importa aquí para que comun.py cargue rápido

    if ENCUESTA_REAL.exists():
        ruta, es_real = ENCUESTA_REAL, True
    else:
        ruta, es_real = ENCUESTA_EJEMPLO, False
        aviso_grande([
            "⚠️  ATENCIÓN: NO SE ENCONTRÓ data/encuesta.csv",
            "Se está usando data/encuesta_ejemplo.csv (DATOS INVENTADOS).",
            "Los resultados NO son reales: no los presentes como hallazgos.",
            "Cuando tengas la encuesta, expórtala de Google Forms como CSV",
            "y guárdala como python/data/encuesta.csv",
        ])

    # encoding="utf-8-sig" acepta el CSV de Google Forms aunque traiga
    # una marca invisible al inicio (BOM). dtype=str = leer todo como texto.
    tabla = pd.read_csv(ruta, encoding="utf-8-sig", dtype=str)
    tabla.columns = [c.strip() for c in tabla.columns]

    # ¿Están todas las columnas que esperamos?
    faltan = [encabezado for encabezado in COLUMNAS.values()
              if encabezado not in tabla.columns]
    if faltan:
        print("❌ Al CSV le faltan estas columnas:", faltan)
        print("   Columnas que sí tiene:", list(tabla.columns))
        print("   Ajusta el diccionario COLUMNAS en python/comun.py.")
        sys.exit(1)

    # Renombramos las columnas a los nombres cortos (zona, transporte, ...)
    tabla = tabla.rename(columns={v: k for k, v in COLUMNAS.items()})
    tabla = tabla[list(COLUMNAS.keys())]  # nos quedamos solo con esas columnas

    # --- Limpieza ---
    zonas, _ = cargar_zonas()
    tabla["zona"] = tabla["zona"].apply(lambda t: unificar_zona(t, zonas))
    tabla["transporte"] = tabla["transporte"].fillna("").str.strip().str.capitalize()
    for dia in DIAS:
        tabla[f"entrada_{dia}"] = tabla[f"entrada_{dia}"].apply(limpiar_hora)
        tabla[f"salida_{dia}"] = tabla[f"salida_{dia}"].apply(limpiar_hora)
    # to_numeric convierte "15" → 15; lo que no sea número queda vacío (NaN)
    tabla["espera"] = pd.to_numeric(
        tabla["espera"].str.extract(r"(\d+)")[0], errors="coerce")
    tabla["interes"] = pd.to_numeric(tabla["interes"], errors="coerce")
    tabla["freno"] = tabla["freno"].fillna("").str.strip()

    tabla = tabla.dropna(subset=["zona"])  # sin zona la respuesta no sirve
    return tabla, es_real
