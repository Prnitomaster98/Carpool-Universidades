#Crea perfiles falsos para probar los datos, es importante para el inicio del proyecto

import json
import random

from comun import (CAMPOS_PERMITIDOS_EN_PERFIL, CARPETA_RAIZ_DEL_PROYECTO,
                   CARPETA_DE_RESULTADOS_GENERADOS, DIAS_DE_CLASE_SIN_TILDE,
                   cargar_zonas, id_de_zona, leer_encuesta)

CANTIDAD_PERFILES_DEMO = 35
SEMILLA_ALEATORIA_FIJA = 2026
TOLERANCIAS_PERMITIDAS_MINUTOS = [10, 20, 30]   # las únicas opciones que acepta la app

CARRERAS_UNIVERSITARIAS_DISPONIBLES = [
    "Ingeniería en Sistemas", "Ingeniería Industrial", "Medicina",
    "Derecho", "Arquitectura", "Administración de Empresas", "Psicología",
    "Diseño Gráfico", "Economía", "Ciencias de la Comunicación",
]

# Lista propia por si Faker no está instalado
NOMBRES_DE_RESERVA = ["Ana", "Luis", "María", "José", "Sofía", "Diego", "Valeria",
                      "Carlos", "Lucía", "Andrés", "Camila", "Javier", "Daniela",
                      "Pablo", "Gabriela", "Fernando", "Isabel", "Mateo"]
APELLIDOS_DE_RESERVA = ["López", "García", "Pérez", "Hernández", "Morales",
                        "Castillo", "Rodríguez", "Méndez", "Ramírez", "Flores",
                        "Juárez", "Cruz", "Reyes", "Orellana", "Barrios"]

RUTA_JSON_PERFILES_DEMO_SALIDA = CARPETA_DE_RESULTADOS_GENERADOS / "perfiles_demo.json"
RUTA_JSON_PERFILES_DEMO_WEB = CARPETA_RAIZ_DEL_PROYECTO / "web" / "data" / "perfiles-demo.json"


def preparar_nombres(generador_aleatorio):
    """Devuelve una función que inventa un nombre completo distinto cada vez."""
    try:
        from faker import Faker
        Faker.seed(SEMILLA_ALEATORIA_FIJA)            # semilla fija también para Faker
        generador_faker = Faker("es_MX")
        return lambda: f"{generador_faker.first_name()} {generador_faker.last_name()}"
    except ImportError:
        print("Faker no está instalado: uso la lista de nombres propia.")
        return lambda: (f"{generador_aleatorio.choice(NOMBRES_DE_RESERVA)} "
                        f"{generador_aleatorio.choice(APELLIDOS_DE_RESERVA)}")


def mover_hora(hora_hhmm_original, generador_aleatorio):
    """Mueve una hora 'HH:MM' un poquito (−15, 0 o +15 min) para que no
    todos los perfiles sean copias exactas de la encuesta."""
    if hora_hhmm_original is None:
        return None
    horas, minutos = map(int, hora_hhmm_original.split(":"))
    minutos_totales_ajustados = horas * 60 + minutos + generador_aleatorio.choice([-15, 0, 0, 0, 15])
    # // = división entera, % = residuo
    return f"{minutos_totales_ajustados // 60:02d}:{minutos_totales_ajustados % 60:02d}"


def tolerancia_cercana(minutos_espera_tolerables):
    """15 min de espera → 10 o 20 (la más cercana). Si no hay dato → 20."""
    # NaN es el único valor distinto de sí mismo
    if minutos_espera_tolerables != minutos_espera_tolerables or minutos_espera_tolerables is None:
        return 20
    return min(TOLERANCIAS_PERMITIDAS_MINUTOS,
               key=lambda tolerancia_opcion: abs(tolerancia_opcion - minutos_espera_tolerables))


def elegir_rol(medio_transporte, generador_aleatorio):
    """Quien tiene carro propio puede llevar a otros; el resto suele ser pasajero."""
    if "carro" in medio_transporte.lower():
        return generador_aleatorio.choices(["conductor", "ambos"], weights=[60, 40])[0]
    return generador_aleatorio.choices(["pasajero", "ambos"], weights=[85, 15])[0]


def ejecutar_programa_principal():
    # nuestro propio generador con semilla fija
    generador_aleatorio = random.Random(SEMILLA_ALEATORIA_FIJA)
    inventar_nombre_completo = preparar_nombres(generador_aleatorio)

    lista_de_zonas, zonas_vienen_del_geojson = cargar_zonas()
    if not zonas_vienen_del_geojson:
        print("Todavía no existe web/data/zonas.geojson: uso zonas provisionales")
        print("   (cuando termines la Fase 2, vuelve a correr este script).\n")
    ids_de_zonas = [diccionario_zona["id"] for diccionario_zona in lista_de_zonas]

    tabla_encuesta, encuesta_es_real = leer_encuesta()
    respuestas_molde = tabla_encuesta.to_dict("records")   # cada respuesta → un diccionario

    # Peso de cada zona = cuántas veces aparece en la encuesta (+1 para que
    # ninguna zona quede vacía en la demo).
    peso_por_id_zona = {id_zona: 1 for id_zona in ids_de_zonas}
    for respuesta_molde in respuestas_molde:
        id_zona_del_molde = id_de_zona(respuesta_molde["zona"], lista_de_zonas)
        if id_zona_del_molde:
            peso_por_id_zona[id_zona_del_molde] += 1

    perfiles_demo = []
    nombres_ya_usados = set()
    for numero_perfil in range(1, CANTIDAD_PERFILES_DEMO + 1):
        # una respuesta de la encuesta al azar
        respuesta_molde = generador_aleatorio.choice(respuestas_molde)

        # Nombre sin repetir
        nombre_completo_perfil = inventar_nombre_completo()
        while nombre_completo_perfil in nombres_ya_usados:
            nombre_completo_perfil = inventar_nombre_completo()
        nombres_ya_usados.add(nombre_completo_perfil)

        # Zonas: la de origen del molde + 0 a 2 zonas más por las que pasa
        id_zona_origen = id_de_zona(respuesta_molde["zona"], lista_de_zonas) or \
            generador_aleatorio.choices(
                ids_de_zonas, weights=[peso_por_id_zona[id_zona] for id_zona in ids_de_zonas])[0]
        zonas_del_perfil = [id_zona_origen]
        for _numero_de_zona_extra in range(generador_aleatorio.choice([0, 1, 1, 2])):
            id_zona_extra = generador_aleatorio.choices(
                ids_de_zonas, weights=[peso_por_id_zona[id_zona] for id_zona in ids_de_zonas])[0]
            if id_zona_extra not in zonas_del_perfil:
                zonas_del_perfil.append(id_zona_extra)

        # Horario lunes–viernes copiado del molde, con pequeños cambios.
        # Si el molde no tenía clase ese día, el día queda en null (vacío).
        horario_semanal = {}
        for dia_de_clase in DIAS_DE_CLASE_SIN_TILDE:
            hora_entrada_molde = respuesta_molde[f"entrada_{dia_de_clase}"]
            hora_salida_molde = respuesta_molde[f"salida_{dia_de_clase}"]
            # isinstance(..., str) = "¿es texto?" (una celda vacía no lo es)
            if isinstance(hora_entrada_molde, str) and isinstance(hora_salida_molde, str):
                horario_semanal[dia_de_clase] = {
                    "entrada": mover_hora(hora_entrada_molde, generador_aleatorio),
                    "salida": mover_hora(hora_salida_molde, generador_aleatorio),
                }
            else:
                horario_semanal[dia_de_clase] = None

        perfiles_demo.append({
            "uid": f"demo-{numero_perfil:03d}",          # demo-001, demo-002, ...
            "nombre": nombre_completo_perfil,
            "carrera": generador_aleatorio.choice(CARRERAS_UNIVERSITARIAS_DISPONIBLES),
            "rol": elegir_rol(respuesta_molde["transporte"], generador_aleatorio),
            "zonas": zonas_del_perfil,
            "horario": horario_semanal,
            "tolerancia": tolerancia_cercana(respuesta_molde["espera"]),
            "esDemo": True,
        })

    # --- Revisión de seguridad antes de guardar ---
    for perfil in perfiles_demo:
        assert set(perfil) == CAMPOS_PERMITIDOS_EN_PERFIL, f"Campos inesperados en {perfil['uid']}"
        assert perfil["esDemo"] is True

    # --- Guardar ---
    CARPETA_DE_RESULTADOS_GENERADOS.mkdir(exist_ok=True)
    texto_json_perfiles = json.dumps(perfiles_demo, ensure_ascii=False, indent=2)
    # ensure_ascii=False guarda "María" tal cual (y no "María")
    RUTA_JSON_PERFILES_DEMO_SALIDA.write_text(texto_json_perfiles + "\n", encoding="utf-8")
    RUTA_JSON_PERFILES_DEMO_WEB.write_text(texto_json_perfiles + "\n", encoding="utf-8")

    # --- Resumen ---
    print("=" * 60)
    print(f" {len(perfiles_demo)} PERFILES DEMO GENERADOS (semilla {SEMILLA_ALEATORIA_FIJA})")
    print("=" * 60)
    print("Encuesta usada como molde:", "REAL" if encuesta_es_real else "EJEMPLO")
    print("Zonas:", "web/data/zonas.geojson" if zonas_vienen_del_geojson else "provisionales")
    cantidad_por_rol = {}
    for perfil in perfiles_demo:
        cantidad_por_rol[perfil["rol"]] = cantidad_por_rol.get(perfil["rol"], 0) + 1
    print("Roles:", cantidad_por_rol)
    perfiles_por_zona = {id_zona: sum(id_zona in perfil["zonas"] for perfil in perfiles_demo)
                         for id_zona in ids_de_zonas}
    print("Perfiles que pasan por cada zona:", perfiles_por_zona)
    print("Tolerancias:", {tolerancia_opcion: sum(perfil["tolerancia"] == tolerancia_opcion
                                                  for perfil in perfiles_demo)
                           for tolerancia_opcion in TOLERANCIAS_PERMITIDAS_MINUTOS})
    print("Todos con esDemo = true:", all(perfil["esDemo"] is True for perfil in perfiles_demo))
    print("\nEjemplo (primer perfil):")
    print(json.dumps(perfiles_demo[0], ensure_ascii=False, indent=2))
    print(f"\nGuardado en:\n   {RUTA_JSON_PERFILES_DEMO_SALIDA.relative_to(CARPETA_RAIZ_DEL_PROYECTO)}"
          f"\n   {RUTA_JSON_PERFILES_DEMO_WEB.relative_to(CARPETA_RAIZ_DEL_PROYECTO)}")


if __name__ == "__main__":
    ejecutar_programa_principal()
