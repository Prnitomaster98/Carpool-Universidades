"""
generar_demo.py — crea 35 perfiles de DEMOSTRACIÓN (ficticios) para la app.

Cómo correrlo (desde la carpeta python/):
    python generar_demo.py

Qué hace:
  1. Lee la encuesta (la real si existe; si no, la de ejemplo).
  2. Usa sus respuestas como "molde": las zonas y horarios que más se
     repiten en la encuesta también se repiten en los perfiles demo.
  3. Inventa nombre, carrera y rol, y marca cada perfil con esDemo: true.
  4. Guarda:
       salida/perfiles_demo.json            (para cargar_demo.py)
       ../web/data/perfiles-demo.json       (copia para el modo demo sin internet)

La semilla fija (SEMILLA) hace que SIEMPRE salgan los mismos perfiles:
si lo corres dos veces, el resultado es idéntico.
"""

import json
import random

from comun import (CAMPOS_PERFIL, CARPETA_PROYECTO, CARPETA_SALIDA, DIAS,
                   cargar_zonas, id_de_zona, leer_encuesta)

CANTIDAD = 35
SEMILLA = 2026
TOLERANCIAS = [10, 20, 30]   # las únicas opciones que acepta la app

CARRERAS = [
    "Ingeniería en Sistemas", "Ingeniería Industrial", "Medicina",
    "Derecho", "Arquitectura", "Administración de Empresas", "Psicología",
    "Diseño Gráfico", "Economía", "Ciencias de la Comunicación",
]

# Lista propia por si Faker no está instalado
NOMBRES_RESERVA = ["Ana", "Luis", "María", "José", "Sofía", "Diego", "Valeria",
                   "Carlos", "Lucía", "Andrés", "Camila", "Javier", "Daniela",
                   "Pablo", "Gabriela", "Fernando", "Isabel", "Mateo"]
APELLIDOS_RESERVA = ["López", "García", "Pérez", "Hernández", "Morales",
                     "Castillo", "Rodríguez", "Méndez", "Ramírez", "Flores",
                     "Juárez", "Cruz", "Reyes", "Orellana", "Barrios"]

ARCHIVO_SALIDA = CARPETA_SALIDA / "perfiles_demo.json"
ARCHIVO_WEB = CARPETA_PROYECTO / "web" / "data" / "perfiles-demo.json"


def preparar_nombres(azar):
    """Devuelve una función que inventa un nombre completo distinto cada vez."""
    try:
        from faker import Faker
        Faker.seed(SEMILLA)            # semilla fija también para Faker
        falso = Faker("es_MX")
        return lambda: f"{falso.first_name()} {falso.last_name()}"
    except ImportError:
        print("ℹ️  Faker no está instalado: uso la lista de nombres propia.")
        return lambda: f"{azar.choice(NOMBRES_RESERVA)} {azar.choice(APELLIDOS_RESERVA)}"


def mover_hora(hhmm, azar):
    """Mueve una hora 'HH:MM' un poquito (−15, 0 o +15 min) para que no
    todos los perfiles sean copias exactas de la encuesta."""
    if hhmm is None:
        return None
    h, m = map(int, hhmm.split(":"))
    total = h * 60 + m + azar.choice([-15, 0, 0, 0, 15])
    return f"{total // 60:02d}:{total % 60:02d}"   # // = división entera, % = residuo


def tolerancia_cercana(minutos):
    """15 min de espera → 10 o 20 (la más cercana). Si no hay dato → 20."""
    if minutos != minutos or minutos is None:   # NaN es el único valor distinto de sí mismo
        return 20
    return min(TOLERANCIAS, key=lambda t: abs(t - minutos))


def elegir_rol(transporte, azar):
    """Quien tiene carro propio puede llevar a otros; el resto suele ser pasajero."""
    if "carro" in transporte.lower():
        return azar.choices(["conductor", "ambos"], weights=[60, 40])[0]
    return azar.choices(["pasajero", "ambos"], weights=[85, 15])[0]


def main():
    azar = random.Random(SEMILLA)     # nuestro propio generador con semilla fija
    nuevo_nombre = preparar_nombres(azar)

    zonas, del_geojson = cargar_zonas()
    if not del_geojson:
        print("ℹ️  Todavía no existe web/data/zonas.geojson: uso zonas provisionales")
        print("   (cuando termines la Fase 2, vuelve a correr este script).\n")
    ids = [z["id"] for z in zonas]

    encuesta, es_real = leer_encuesta()
    moldes = encuesta.to_dict("records")   # cada respuesta → un diccionario

    # Peso de cada zona = cuántas veces aparece en la encuesta (+1 para que
    # ninguna zona quede vacía en la demo).
    pesos = {i: 1 for i in ids}
    for molde in moldes:
        zid = id_de_zona(molde["zona"], zonas)
        if zid:
            pesos[zid] += 1

    perfiles = []
    usados = set()
    for n in range(1, CANTIDAD + 1):
        molde = azar.choice(moldes)          # una respuesta de la encuesta al azar

        # Nombre sin repetir
        nombre = nuevo_nombre()
        while nombre in usados:
            nombre = nuevo_nombre()
        usados.add(nombre)

        # Zonas: la de origen del molde + 0 a 2 zonas más por las que pasa
        origen = id_de_zona(molde["zona"], zonas) or \
            azar.choices(ids, weights=[pesos[i] for i in ids])[0]
        mis_zonas = [origen]
        for _ in range(azar.choice([0, 1, 1, 2])):
            otra = azar.choices(ids, weights=[pesos[i] for i in ids])[0]
            if otra not in mis_zonas:
                mis_zonas.append(otra)

        # Horario lunes–viernes copiado del molde, con pequeños cambios.
        # Si el molde no tenía clase ese día, el día queda en null (vacío).
        horario = {}
        for dia in DIAS:
            entrada = molde[f"entrada_{dia}"]
            salida = molde[f"salida_{dia}"]
            # isinstance(..., str) = "¿es texto?" (una celda vacía no lo es)
            if isinstance(entrada, str) and isinstance(salida, str):
                horario[dia] = {"entrada": mover_hora(entrada, azar),
                                "salida": mover_hora(salida, azar)}
            else:
                horario[dia] = None

        perfiles.append({
            "uid": f"demo-{n:03d}",          # demo-001, demo-002, ...
            "nombre": nombre,
            "carrera": azar.choice(CARRERAS),
            "rol": elegir_rol(molde["transporte"], azar),
            "zonas": mis_zonas,
            "horario": horario,
            "tolerancia": tolerancia_cercana(molde["espera"]),
            "esDemo": True,
        })

    # --- Revisión de seguridad antes de guardar ---
    for p in perfiles:
        assert set(p) == CAMPOS_PERFIL, f"Campos inesperados en {p['uid']}"
        assert p["esDemo"] is True

    # --- Guardar ---
    CARPETA_SALIDA.mkdir(exist_ok=True)
    texto = json.dumps(perfiles, ensure_ascii=False, indent=2)
    # ensure_ascii=False guarda "María" tal cual (y no "María")
    ARCHIVO_SALIDA.write_text(texto + "\n", encoding="utf-8")
    ARCHIVO_WEB.write_text(texto + "\n", encoding="utf-8")

    # --- Resumen ---
    print("=" * 60)
    print(f" {len(perfiles)} PERFILES DEMO GENERADOS (semilla {SEMILLA})")
    print("=" * 60)
    print("Encuesta usada como molde:", "REAL" if es_real else "⚠️ EJEMPLO")
    print("Zonas:", "web/data/zonas.geojson" if del_geojson else "provisionales")
    roles = {}
    for p in perfiles:
        roles[p["rol"]] = roles.get(p["rol"], 0) + 1
    print("Roles:", roles)
    conteo_zonas = {i: sum(i in p["zonas"] for p in perfiles) for i in ids}
    print("Perfiles que pasan por cada zona:", conteo_zonas)
    print("Tolerancias:", {t: sum(p["tolerancia"] == t for p in perfiles)
                           for t in TOLERANCIAS})
    print("Todos con esDemo = true:", all(p["esDemo"] is True for p in perfiles))
    print("\nEjemplo (primer perfil):")
    print(json.dumps(perfiles[0], ensure_ascii=False, indent=2))
    print(f"\nGuardado en:\n   {ARCHIVO_SALIDA.relative_to(CARPETA_PROYECTO)}"
          f"\n   {ARCHIVO_WEB.relative_to(CARPETA_PROYECTO)}")


if __name__ == "__main__":
    main()
