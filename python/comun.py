"""
comun.py — funciones y constantes que comparten los scripts de la Fase 6.

No se ejecuta solo: lo usan analisis_encuesta.py, generar_demo.py y
cargar_demo.py con
    from comun import ...

Aquí está TODO lo que probablemente tengas que ajustar cuando tengas la
encuesta real (nombres de columnas, apodos de zonas), para no tener que
buscarlo en varios archivos.

======================================================================
GUÍA DE NOMBRES DE VARIABLES (comun.py)
======================================================================
Convención: los nombres en MAYÚSCULAS son CONSTANTES (se definen una vez y
no cambian mientras corre el programa). Los nombres en minúsculas son
variables normales que viven dentro de una función. Un guion bajo al
inicio (_nombre) significa "de uso interno de este archivo".

--- Rutas de carpetas y archivos ---
CARPETA_DE_SCRIPTS_PYTHON    Carpeta python/ (donde está este archivo).
                             Importa porque todas las demás rutas parten
                             de aquí; así los scripts funcionan aunque los
                             corras desde otra carpeta.
CARPETA_DE_DATOS_DE_ENTRADA  python/data/: donde va la encuesta en CSV.
CARPETA_DE_RESULTADOS_GENERADOS
                             python/salida/: gráficos y JSON que crean los
                             scripts. Git la ignora porque se puede regenerar.
CARPETA_RAIZ_DEL_PROYECTO    carpool-zonas/. Sirve para llegar a web/ y para
                             comprobar que la clave de Firebase NO esté dentro.
RUTA_ENCUESTA_REAL           data/encuesta.csv, la encuesta exportada de
                             Google Forms. Si existe, se usa siempre.
RUTA_ENCUESTA_DE_EJEMPLO     data/encuesta_ejemplo.csv (datos INVENTADOS).
                             Solo se usa si falta la real.
RUTA_ARCHIVO_ZONAS_GEOJSON   web/data/zonas.geojson: la lista oficial de
                             zonas que también usa el mapa.

--- Días y perfil ---
DIAS_DE_CLASE_SIN_TILDE      ["lunes", ..., "viernes"]. Son las claves del
                             horario de un perfil; van sin tilde para que
                             en JavaScript se pueda escribir horario.miercoles.
NOMBRES_DE_DIAS_CON_TILDE    Diccionario día-sin-tilde → nombre bonito
                             ("miercoles" → "Miércoles"). Se usa para armar
                             los encabezados de columna del CSV.
CAMPOS_PERMITIDOS_EN_PERFIL  Los ÚNICOS campos que puede tener un perfil.
                             Es una protección de privacidad: si aparece
                             otro campo (dirección, teléfono...), no se sube.

--- Encuesta ---
COLUMNAS_DE_LA_ENCUESTA      Diccionario nombre corto → encabezado exacto del
                             CSV. Es lo PRIMERO que hay que ajustar si tu
                             Google Form usa otras palabras.
_dia_de_clase                Variable temporal del ciclo que crea las columnas
                             "Entrada lunes", "Salida lunes", etc.
_flujo_de_salida_terminal    sys.stdout o sys.stderr mientras se cambian a
                             UTF-8 para que se vean tildes y emojis en Windows.

--- Zonas ---
ZONAS_PROVISIONALES_DE_RESPALDO
                             Lista de zonas que se usa SOLO si no existe
                             zonas.geojson (para poder probar antes de la Fase 2).
APODOS_DE_ZONAS_A_ID         Formas "raras" de escribir una zona → id oficial
                             ("zn" → "zona-norte"). Aquí agregas los apodos
                             que el análisis te diga que no reconoció.
lista_de_zonas               Lista de diccionarios {"id": ..., "nombre": ...}.
                             Es el formato con el que trabajan TODAS las
                             funciones de zonas.
zonas_vienen_del_geojson     True si las zonas se leyeron de zonas.geojson,
                             False si se usaron las provisionales.
contenido_geojson            Todo el archivo zonas.geojson ya convertido a
                             diccionario de Python.
zona_en_geojson              Una "feature" (una zona) del GeoJSON.
propiedades_de_zona          El bloque "properties" de esa zona (id, nombre...).
diccionario_zona             Una zona en formato {"id": ..., "nombre": ...}.
texto_escrito_por_estudiante Lo que la persona escribió en la encuesta como zona.
texto_normalizado_buscado    Ese texto ya normalizado ("zonanorte"), listo
                             para comparar.
zona_candidata               La zona oficial que se está comparando en el ciclo.
formas_validas_de_escribir_zona
                             Conjunto de formas aceptadas para esa zona
                             ("zonanorte", "norte").
ids_de_zonas_oficiales       Conjunto con los ids de todas las zonas oficiales;
                             sirve para comprobar que un apodo apunte a una
                             zona que de verdad existe.
id_zona_reconocida           El id oficial encontrado ("zona-norte") o None.
dia_de_clase                 Un día ("lunes"...) mientras se limpian sus horas.

--- Textos y horas ---
texto_a_normalizar           Texto original que llega a normalizar().
texto_normalizado            El mismo texto en minúsculas, sin tildes ni signos.
caracter                     Una letra del texto mientras se le quitan tildes.
_PATRON_PARA_RECONOCER_HORA  Expresión regular que entiende "7:00", "1:30 p.m.",
                             "13h30", etc.
valor_de_celda_hora          Lo que venía en la celda de hora del CSV.
texto_hora_limpio            Ese valor en minúsculas, sin espacios ni puntos.
coincidencia_con_patron      Resultado de aplicar el patrón (o None si no encaja).
hora_en_24h                  La hora como número 0–23.
minutos                      Los minutos como número 0–59.
indicador_am_pm              "a", "p" o None (si no se escribió a. m./p. m.).

--- Avisos y lectura de la encuesta ---
lineas_del_aviso             Lista de textos que se muestran dentro del recuadro.
ancho_del_recuadro           Cuántos caracteres mide el recuadro de "#".
linea_del_aviso              Una de esas líneas mientras se imprime.
ruta_encuesta_usada          Cuál de los dos CSV se terminó leyendo.
encuesta_es_real             True = encuesta real; False = archivo de ejemplo.
                             Importa porque los gráficos y resúmenes avisan
                             cuando los datos NO son reales.
tabla_encuesta               La encuesta como tabla (DataFrame) de pandas.
nombre_columna               Un encabezado de la tabla mientras se le quitan
                             espacios sobrantes.
columnas_faltantes           Encabezados que esperábamos y no están en el CSV.
encabezado_esperado          Un encabezado de COLUMNAS_DE_LA_ENCUESTA.
nombre_corto_columna / encabezado_en_csv
                             Las dos partes de cada par de COLUMNAS_DE_LA_ENCUESTA.
texto_zona                   La zona escrita en una fila, mientras se unifica.

--- Nombres que NO se cambiaron (y por qué) ---
pd                           Apodo estándar de la librería pandas. Todo el
                             mundo lo escribe así; cambiarlo confundiría.
"zona", "transporte", "espera", "interes", "freno", "entrada_lunes"...
                             Son nombres de COLUMNAS de la tabla, no variables.
                             Los usan los tres scripts.
"id", "nombre", "uid", "esDemo"...
                             Son claves de los archivos JSON/GeoJSON y de
                             Firestore. Si se renombraran, la app web y la
                             base de datos dejarían de entenderse.
======================================================================
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
for _flujo_de_salida_terminal in (sys.stdout, sys.stderr):
    try:
        _flujo_de_salida_terminal.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass  # en Colab o terminales viejas simplemente no hace falta

# ----------------------------------------------------------------------
# 1. Rutas (carpetas y archivos)
# ----------------------------------------------------------------------
# Path(__file__) es la ruta de ESTE archivo. .parent es su carpeta (python/).
# Así los scripts funcionan aunque los corras desde otra carpeta.
CARPETA_DE_SCRIPTS_PYTHON = Path(__file__).resolve().parent
CARPETA_DE_DATOS_DE_ENTRADA = CARPETA_DE_SCRIPTS_PYTHON / "data"
CARPETA_DE_RESULTADOS_GENERADOS = CARPETA_DE_SCRIPTS_PYTHON / "salida"   # ignorada por Git
CARPETA_RAIZ_DEL_PROYECTO = CARPETA_DE_SCRIPTS_PYTHON.parent             # carpool-zonas/

RUTA_ENCUESTA_REAL = CARPETA_DE_DATOS_DE_ENTRADA / "encuesta.csv"
RUTA_ENCUESTA_DE_EJEMPLO = CARPETA_DE_DATOS_DE_ENTRADA / "encuesta_ejemplo.csv"
RUTA_ARCHIVO_ZONAS_GEOJSON = CARPETA_RAIZ_DEL_PROYECTO / "web" / "data" / "zonas.geojson"

# ----------------------------------------------------------------------
# 2. Días de la semana
# ----------------------------------------------------------------------
# Las claves van SIN tilde ("miercoles") para que sean fáciles de usar
# en JavaScript: perfil.horario.miercoles
DIAS_DE_CLASE_SIN_TILDE = ["lunes", "martes", "miercoles", "jueves", "viernes"]
NOMBRES_DE_DIAS_CON_TILDE = {"lunes": "Lunes", "martes": "Martes", "miercoles": "Miércoles",
                             "jueves": "Jueves", "viernes": "Viernes"}

# Los ÚNICOS campos que puede tener un perfil de la colección usuarios
# (modelo de datos del plan). No hay dirección, coordenadas, teléfono ni foto.
CAMPOS_PERMITIDOS_EN_PERFIL = {"uid", "nombre", "carrera", "rol", "zonas", "horario",
                               "tolerancia", "esDemo"}

# ----------------------------------------------------------------------
# 3. Columnas del Google Form
# ----------------------------------------------------------------------
# A la IZQUIERDA: el nombre que usan los scripts (no lo cambies).
# A la DERECHA: el encabezado EXACTO de la columna en el CSV.
# ⚠️ Si en tu Google Form escribiste las preguntas con otras palabras,
#    cambia solo el texto de la derecha.
COLUMNAS_DE_LA_ENCUESTA = {
    "zona": "Zona de origen",
    "transporte": "Medio de transporte",
    "espera": "Minutos de espera tolerables",
    "interes": "¿La usarías? (1-5)",
    "freno": "¿Qué te frenaría?",
}
# Las columnas de horario se generan solas: "Entrada lunes", "Salida lunes", ...
for _dia_de_clase in DIAS_DE_CLASE_SIN_TILDE:
    COLUMNAS_DE_LA_ENCUESTA[f"entrada_{_dia_de_clase}"] = \
        f"Entrada {NOMBRES_DE_DIAS_CON_TILDE[_dia_de_clase].lower()}"
    COLUMNAS_DE_LA_ENCUESTA[f"salida_{_dia_de_clase}"] = \
        f"Salida {NOMBRES_DE_DIAS_CON_TILDE[_dia_de_clase].lower()}"

# ----------------------------------------------------------------------
# 4. Zonas
# ----------------------------------------------------------------------
# Los ids y nombres de las zonas se leen de web/data/zonas.geojson (Fase 2).
# Esta lista PROVISIONAL (los mismos ids) solo se usa si ese archivo no existe.
ZONAS_PROVISIONALES_DE_RESPALDO = [
    {"id": "ruta-uvg", "nombre": "Cerca de UVG (zonas 10, 14, 15 y 16)"},
    {"id": "ruta-norte", "nombre": "Norte (zonas 1, 2, 5, 6, 17 y 18)"},
    {"id": "ruta-occidente", "nombre": "Occidente (Mixco y zonas 7, 11 y 12)"},
    {"id": "ruta-sur", "nombre": "Sur (Villa Nueva, Petapa, Villa Canales y zona 13)"},
    {"id": "ruta-oriente", "nombre": "Oriente (Carretera a El Salvador y las Pinulas)"},
]

# Lo que la gente escribió en "Zona de origen" → la RUTA a la que pertenece.
# Las claves van "normalizadas" (minúsculas, sin tildes, espacios ni signos):
# "San Cristóbal, Mixco" → "sancristobalmixco".
# La agrupación salió del análisis de la encuesta real (octubre 2026).
# ⚠️ Si alguien escribe una zona nueva, el análisis te la muestra como
#    "no reconocida": agrégala aquí con su ruta.
APODOS_DE_ZONAS_A_ID = {
    # Cerca de UVG
    "zona10": "ruta-uvg", "zona14": "ruta-uvg", "zona15": "ruta-uvg", "zona16": "ruta-uvg",
    "z10": "ruta-uvg", "z14": "ruta-uvg", "z15": "ruta-uvg", "z16": "ruta-uvg",
    # Norte
    "zona1": "ruta-norte", "zona2": "ruta-norte", "zona5": "ruta-norte",
    "zona6": "ruta-norte", "zona17": "ruta-norte", "zona18": "ruta-norte",
    "z1": "ruta-norte", "z2": "ruta-norte", "z5": "ruta-norte",
    "z6": "ruta-norte", "z17": "ruta-norte", "z18": "ruta-norte",
    # Occidente
    "mixco": "ruta-occidente", "sancristobal": "ruta-occidente",
    "sancristobalmixco": "ruta-occidente",
    "zona7": "ruta-occidente", "zona11": "ruta-occidente", "zona12": "ruta-occidente",
    "z7": "ruta-occidente", "z11": "ruta-occidente", "z12": "ruta-occidente",
    # Sur
    "villanueva": "ruta-sur", "sanmiguelpetapa": "ruta-sur", "petapa": "ruta-sur",
    "villacanales": "ruta-sur", "zona13": "ruta-sur", "z13": "ruta-sur",
    # Oriente
    "carreteraaelsalvador": "ruta-oriente", "caes": "ruta-oriente",
    "fraijanes": "ruta-oriente", "santacatarinapinula": "ruta-oriente",
    "sanjosepinula": "ruta-oriente",
}


def normalizar(texto_a_normalizar):
    """'  Zona 10 ' → 'zona10'. Quita tildes, espacios, puntos y mayúsculas.

    Sirve para comparar textos que la gente escribe distinto.
    """
    if texto_a_normalizar is None:
        return ""
    texto_normalizado = str(texto_a_normalizar).strip().lower()
    # unicodedata separa "á" en "a" + tilde; luego nos quedamos solo con la letra
    texto_normalizado = unicodedata.normalize("NFD", texto_normalizado)
    texto_normalizado = "".join(caracter for caracter in texto_normalizado
                                if unicodedata.category(caracter) != "Mn")
    return re.sub(r"[^a-z0-9]", "", texto_normalizado)  # deja solo letras y números


def cargar_zonas():
    """Devuelve (lista_de_zonas, zonas_vienen_del_geojson).

    Cada zona es un diccionario {"id": ..., "nombre": ...}.
    """
    if RUTA_ARCHIVO_ZONAS_GEOJSON.exists():
        contenido_geojson = json.loads(RUTA_ARCHIVO_ZONAS_GEOJSON.read_text(encoding="utf-8"))
        lista_de_zonas = []
        for zona_en_geojson in contenido_geojson.get("features", []):
            propiedades_de_zona = zona_en_geojson.get("properties", {})
            if propiedades_de_zona.get("id"):
                lista_de_zonas.append({
                    "id": propiedades_de_zona["id"],
                    "nombre": propiedades_de_zona.get("nombre", propiedades_de_zona["id"]),
                })
        if lista_de_zonas:
            return lista_de_zonas, True
    return ZONAS_PROVISIONALES_DE_RESPALDO, False


def nombre_limpio(diccionario_zona):
    """'Zona Norte — ejemplo' → 'Zona Norte' (quita la marca de ejemplo)."""
    return re.split(r"\s+[—–-]\s+ejemplo", diccionario_zona["nombre"], flags=re.I)[0].strip()


def id_de_zona(texto_escrito_por_estudiante, lista_de_zonas):
    """Lo que escribió el estudiante → id de la zona, o None si no se reconoce.

    Ejemplos: 'Zona Norte', 'zona norte', 'NORTE', 'zona-norte' → 'zona-norte'
    """
    texto_normalizado_buscado = normalizar(texto_escrito_por_estudiante)
    if not texto_normalizado_buscado:
        return None
    for zona_candidata in lista_de_zonas:
        formas_validas_de_escribir_zona = {
            normalizar(nombre_limpio(zona_candidata)),                # "zonanorte"
            normalizar(zona_candidata["id"]),                         # "zonanorte"
            normalizar(re.sub(r"^zona-?", "", zona_candidata["id"])),  # "norte"
        }
        if texto_normalizado_buscado in formas_validas_de_escribir_zona:
            return zona_candidata["id"]
    ids_de_zonas_oficiales = {zona_candidata["id"] for zona_candidata in lista_de_zonas}
    if APODOS_DE_ZONAS_A_ID.get(texto_normalizado_buscado) in ids_de_zonas_oficiales:
        return APODOS_DE_ZONAS_A_ID[texto_normalizado_buscado]
    return None


def unificar_zona(texto_escrito_por_estudiante, lista_de_zonas):
    """Convierte lo que escribió el estudiante en el nombre oficial de la zona.

    Si no se reconoce, devuelve el texto limpio (con mayúscula inicial) para
    que igual aparezca en el análisis y puedas agregarlo a APODOS_DE_ZONAS_A_ID.
    """
    if not normalizar(texto_escrito_por_estudiante):
        return None
    id_zona_reconocida = id_de_zona(texto_escrito_por_estudiante, lista_de_zonas)
    if id_zona_reconocida:
        return next(nombre_limpio(diccionario_zona) for diccionario_zona in lista_de_zonas
                    if diccionario_zona["id"] == id_zona_reconocida)
    return str(texto_escrito_por_estudiante).strip().title()


# Reconoce "7:00", "07:00", "7:00:00", "7:00 a. m.", "1:30 p.m.", "13h30", "7"
_PATRON_PARA_RECONOCER_HORA = re.compile(r"^(\d{1,2})(?:[:h.](\d{2}))?(?::\d{2})?\s*([ap])?")


def limpiar_hora(valor_de_celda_hora):
    """Convierte cualquier forma de escribir una hora a 'HH:MM' (24 h).

    Devuelve None si la celda está vacía o no se entiende.
    """
    if valor_de_celda_hora is None:
        return None
    texto_hora_limpio = str(valor_de_celda_hora).strip().lower().replace(" ", "").replace(".", "")
    # replace(".", "") convierte "p. m." en "pm"; "7.30" se trata aparte abajo
    if texto_hora_limpio in ("", "nan", "none", "-", "noaplica", "na"):
        return None
    texto_hora_limpio = re.sub(r"^(\d{1,2})(\d{2})(?=[ap]|$)", r"\1:\2",
                               texto_hora_limpio)  # "730pm"→"7:30pm"
    coincidencia_con_patron = _PATRON_PARA_RECONOCER_HORA.match(texto_hora_limpio)
    if not coincidencia_con_patron:
        return None
    hora_en_24h = int(coincidencia_con_patron.group(1))
    minutos = int(coincidencia_con_patron.group(2) or 0)
    indicador_am_pm = coincidencia_con_patron.group(3)
    if indicador_am_pm == "p" and hora_en_24h < 12:
        hora_en_24h += 12          # 1:30 p. m. → 13:30
    if indicador_am_pm == "a" and hora_en_24h == 12:
        hora_en_24h = 0            # 12:00 a. m. → 00:00
    if hora_en_24h > 23 or minutos > 59:
        return None
    return f"{hora_en_24h:02d}:{minutos:02d}"   # :02d = dos dígitos con cero a la izquierda


def aviso_grande(lineas_del_aviso):
    """Imprime un recuadro llamativo en la terminal."""
    ancho_del_recuadro = max(len(linea_del_aviso) for linea_del_aviso in lineas_del_aviso) + 4
    print("\n" + "#" * ancho_del_recuadro)
    for linea_del_aviso in lineas_del_aviso:
        print("# " + linea_del_aviso.ljust(ancho_del_recuadro - 4) + " #")
    print("#" * ancho_del_recuadro + "\n")


def leer_encuesta():
    """Lee la encuesta y la devuelve LIMPIA como tabla de pandas.

    Devuelve (tabla_encuesta, encuesta_es_real). encuesta_es_real es False
    si se usó el archivo de ejemplo.
    """
    import pandas as pd  # se importa aquí para que comun.py cargue rápido

    if RUTA_ENCUESTA_REAL.exists():
        ruta_encuesta_usada, encuesta_es_real = RUTA_ENCUESTA_REAL, True
    else:
        ruta_encuesta_usada, encuesta_es_real = RUTA_ENCUESTA_DE_EJEMPLO, False
        aviso_grande([
            "⚠️  ATENCIÓN: NO SE ENCONTRÓ data/encuesta.csv",
            "Se está usando data/encuesta_ejemplo.csv (DATOS INVENTADOS).",
            "Los resultados NO son reales: no los presentes como hallazgos.",
            "Cuando tengas la encuesta, expórtala de Google Forms como CSV",
            "y guárdala como python/data/encuesta.csv",
        ])

    # encoding="utf-8-sig" acepta el CSV de Google Forms aunque traiga
    # una marca invisible al inicio (BOM). dtype=str = leer todo como texto.
    tabla_encuesta = pd.read_csv(ruta_encuesta_usada, encoding="utf-8-sig", dtype=str)
    tabla_encuesta.columns = [nombre_columna.strip() for nombre_columna in tabla_encuesta.columns]

    # ¿Están todas las columnas que esperamos?
    columnas_faltantes = [encabezado_esperado
                          for encabezado_esperado in COLUMNAS_DE_LA_ENCUESTA.values()
                          if encabezado_esperado not in tabla_encuesta.columns]
    if columnas_faltantes:
        print("❌ Al CSV le faltan estas columnas:", columnas_faltantes)
        print("   Columnas que sí tiene:", list(tabla_encuesta.columns))
        print("   Ajusta el diccionario COLUMNAS_DE_LA_ENCUESTA en python/comun.py.")
        sys.exit(1)

    # Renombramos las columnas a los nombres cortos (zona, transporte, ...)
    tabla_encuesta = tabla_encuesta.rename(columns={
        encabezado_en_csv: nombre_corto_columna
        for nombre_corto_columna, encabezado_en_csv in COLUMNAS_DE_LA_ENCUESTA.items()
    })
    # nos quedamos solo con esas columnas
    tabla_encuesta = tabla_encuesta[list(COLUMNAS_DE_LA_ENCUESTA.keys())]

    # --- Limpieza ---
    lista_de_zonas, _zonas_vienen_del_geojson_no_se_usa = cargar_zonas()
    tabla_encuesta["zona"] = tabla_encuesta["zona"].apply(
        lambda texto_zona: unificar_zona(texto_zona, lista_de_zonas))
    tabla_encuesta["transporte"] = \
        tabla_encuesta["transporte"].fillna("").str.strip().str.capitalize()
    for dia_de_clase in DIAS_DE_CLASE_SIN_TILDE:
        tabla_encuesta[f"entrada_{dia_de_clase}"] = \
            tabla_encuesta[f"entrada_{dia_de_clase}"].apply(limpiar_hora)
        tabla_encuesta[f"salida_{dia_de_clase}"] = \
            tabla_encuesta[f"salida_{dia_de_clase}"].apply(limpiar_hora)
    # to_numeric convierte "15" → 15; lo que no sea número queda vacío (NaN)
    tabla_encuesta["espera"] = pd.to_numeric(
        tabla_encuesta["espera"].str.extract(r"(\d+)")[0], errors="coerce")
    tabla_encuesta["interes"] = pd.to_numeric(tabla_encuesta["interes"], errors="coerce")
    tabla_encuesta["freno"] = tabla_encuesta["freno"].fillna("").str.strip()

    tabla_encuesta = tabla_encuesta.dropna(subset=["zona"])  # sin zona la respuesta no sirve
    return tabla_encuesta, encuesta_es_real
