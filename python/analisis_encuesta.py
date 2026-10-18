# Regresa un análisis de la encuesta, junto con los datos y mensajes de prueba importantes.


from collections import Counter

import pandas as pd
import plotly.express as px

from comun import (CARPETA_DE_RESULTADOS_GENERADOS, DIAS_DE_CLASE_SIN_TILDE,
                aviso_grande, cargar_zonas, id_de_zona, leer_encuesta)


def contar_horas(tabla_encuesta, tipo_de_hora):
    """Cuenta cuántas veces aparece cada hora de 'entrada' o 'salida'.
    Junta los 5 días: si alguien entra a las 7:00 de lunes a viernes,
    esa persona suma 5 a las 7:00. Las celdas vacías (días sin clase)
    no se cuentan.
    """
    contador_de_horas = Counter()
    for dia_de_clase in DIAS_DE_CLASE_SIN_TILDE:
        # dropna() quita los vacíos; update() suma cada hora al contador
        contador_de_horas.update(tabla_encuesta[f"{tipo_de_hora}_{dia_de_clase}"].dropna())
    # Lo convertimos en una tabla ordenada por hora (07:00, 07:30, 09:00, ...)
    serie_veces_por_hora = pd.Series(contador_de_horas, name="veces").sort_index()
    serie_veces_por_hora.index.name = "hora"
    return serie_veces_por_hora


def grafico_barras(serie_de_datos, titulo_del_grafico, etiqueta_eje_x,
                nombre_archivo_html, encuesta_es_real):
    """Guarda un gráfico de barras de Plotly como HTML en salida/."""
    if not encuesta_es_real:
        titulo_del_grafico += "  —  DATOS DE EJEMPLO"
    figura_plotly = px.bar(
        x=serie_de_datos.index, y=serie_de_datos.values, text=serie_de_datos.values,
        labels={"x": etiqueta_eje_x, "y": "Cantidad de respuestas"},
        title=titulo_del_grafico,
    )
    figura_plotly.update_xaxes(type="category")  # que no trate 07:00 como número
    # include_plotlyjs=True mete la librería DENTRO del HTML: así el
    # gráfico se abre aunque en la feria no haya internet.
    ruta_archivo_guardado = CARPETA_DE_RESULTADOS_GENERADOS / nombre_archivo_html
    figura_plotly.write_html(ruta_archivo_guardado, include_plotlyjs=True)
    return ruta_archivo_guardado


def ejecutar_programa_principal():
    tabla_encuesta, encuesta_es_real = leer_encuesta()
    CARPETA_DE_RESULTADOS_GENERADOS.mkdir(exist_ok=True)   # crea salida/ si no existe

    total_respuestas_validas = len(tabla_encuesta)
    conteo_horas_entrada = contar_horas(tabla_encuesta, "entrada")
    conteo_horas_salida = contar_horas(tabla_encuesta, "salida")
    conteo_por_zona = tabla_encuesta["zona"].value_counts()           # cuenta cada zona
    conteo_por_transporte = tabla_encuesta["transporte"].value_counts()
    conteo_por_nivel_interes = tabla_encuesta["interes"].value_counts().sort_index()

    # idxmax() = la etiqueta del valor más grande (la moda)
    print("=" * 60)
    print(" RESUMEN DE LA ENCUESTA" + ("" if encuesta_es_real else "  (EJEMPLO, NO REAL)"))
    print("=" * 60)
    print(f"Respuestas válidas: {total_respuestas_validas}\n")

    print("Horas de ENTRADA más frecuentes (sumando lunes a viernes):")
    for hora_frecuente, cantidad_de_veces in \
            conteo_horas_entrada.sort_values(ascending=False).head(3).items():
        print(f"   {hora_frecuente}  →  {cantidad_de_veces} veces")
    print("\nHoras de SALIDA más frecuentes (sumando lunes a viernes):")
    for hora_frecuente, cantidad_de_veces in \
            conteo_horas_salida.sort_values(ascending=False).head(3).items():
        print(f"   {hora_frecuente}  →  {cantidad_de_veces} veces")

    print("\nZonas de origen más comunes:")
    for nombre_zona, cantidad_respuestas in conteo_por_zona.items():
        # :.0% = porcentaje sin decimales
        print(f"   {nombre_zona:<26} {cantidad_respuestas} "
              f"({cantidad_respuestas / total_respuestas_validas:.0%})")

    # Zonas escritas de una forma que no reconocimos: agrégalas a APODOS_DE_ZONAS_A_ID
    lista_de_zonas_oficiales, _zonas_vienen_del_geojson_no_se_usa = cargar_zonas()
    zonas_no_reconocidas = [zona_escrita for zona_escrita in conteo_por_zona.index
                            if id_de_zona(zona_escrita, lista_de_zonas_oficiales) is None]
    if zonas_no_reconocidas:
        print("   No reconocidas (agrégalas a APODOS_DE_ZONAS_A_ID en comun.py):",
              zonas_no_reconocidas)

    print(f"\nMedio de transporte predominante: {conteo_por_transporte.idxmax()} "
          f"({conteo_por_transporte.max()} de {total_respuestas_validas})")
    for medio_transporte, cantidad_respuestas in conteo_por_transporte.items():
        print(f"   {medio_transporte:<26} {cantidad_respuestas}")

    print(f"\nMinutos de espera tolerables: promedio {tabla_encuesta['espera'].mean():.0f}, "
          f"mínimo {tabla_encuesta['espera'].min():.0f}, "
          f"máximo {tabla_encuesta['espera'].max():.0f}")
    print(f"¿La usarías? (1-5): promedio {tabla_encuesta['interes'].mean():.1f}; "
          f"respondieron 4 o 5: {(tabla_encuesta['interes'] >= 4).sum()} "
          f"de {total_respuestas_validas}")

    print("\n¿Qué te frenaría? (respuestas abiertas):")
    for respuesta_abierta in tabla_encuesta["freno"]:
        if respuesta_abierta:
            print(f"   - {respuesta_abierta}")

    # --- Gráficos ---
    rutas_graficos_guardados = [
        grafico_barras(conteo_horas_entrada, "Horas de entrada (lunes a viernes)", "Hora",
                       "horas_entrada.html", encuesta_es_real),
        grafico_barras(conteo_horas_salida, "Horas de salida (lunes a viernes)", "Hora",
                       "horas_salida.html", encuesta_es_real),
        grafico_barras(conteo_por_zona, "Zonas de origen", "Zona",
                       "zonas_origen.html", encuesta_es_real),
        grafico_barras(conteo_por_transporte, "Medio de transporte", "Medio",
                       "medio_transporte.html", encuesta_es_real),
        grafico_barras(conteo_por_nivel_interes, "¿Usarías la app? (1 = nada, 5 = mucho)",
                       "Respuesta", "interes.html", encuesta_es_real),
    ]
    print("\nGráficos guardados:")
    for ruta_grafico in rutas_graficos_guardados:
        print(f"   {ruta_grafico.relative_to(CARPETA_DE_RESULTADOS_GENERADOS.parent)}")

    if not encuesta_es_real:
        aviso_grande(["Recuerda: todo lo anterior salió del ARCHIVO DE EJEMPLO."])


# Esta línea hace que ejecutar_programa_principal() se ejecute solo si corres
# el archivo directamente (python analisis_encuesta.py), no si otro script lo importa.
if __name__ == "__main__":
    ejecutar_programa_principal()
