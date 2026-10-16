"""
analisis_encuesta.py — resume la encuesta de movilidad y hace gráficos.

Cómo correrlo (desde la carpeta python/):
    python analisis_encuesta.py

Lee data/encuesta.csv (la encuesta REAL exportada de Google Forms).
Si todavía no existe, usa data/encuesta_ejemplo.csv y lo avisa en grande.

Resultado:
  - Un resumen impreso en la terminal.
  - Gráficos de barras interactivos en salida/*.html (ábrelos con doble clic;
    funcionan sin internet).
"""

from collections import Counter

import pandas as pd
import plotly.express as px

from comun import (CARPETA_SALIDA, DIAS, aviso_grande, cargar_zonas,
                   id_de_zona, leer_encuesta)


def contar_horas(tabla, tipo):
    """Cuenta cuántas veces aparece cada hora de 'entrada' o 'salida'.

    Junta los 5 días: si alguien entra a las 7:00 de lunes a viernes,
    esa persona suma 5 a las 7:00. Las celdas vacías (días sin clase)
    no se cuentan.
    """
    contador = Counter()
    for dia in DIAS:
        # dropna() quita los vacíos; update() suma cada hora al contador
        contador.update(tabla[f"{tipo}_{dia}"].dropna())
    # Lo convertimos en una tabla ordenada por hora (07:00, 07:30, 09:00, ...)
    serie = pd.Series(contador, name="veces").sort_index()
    serie.index.name = "hora"
    return serie


def grafico_barras(serie, titulo, eje_x, archivo, es_real):
    """Guarda un gráfico de barras de Plotly como HTML en salida/."""
    if not es_real:
        titulo += "  —  ⚠️ DATOS DE EJEMPLO"
    figura = px.bar(
        x=serie.index, y=serie.values, text=serie.values,
        labels={"x": eje_x, "y": "Cantidad de respuestas"},
        title=titulo,
    )
    figura.update_xaxes(type="category")  # que no trate 07:00 como número
    # include_plotlyjs=True mete la librería DENTRO del HTML: así el
    # gráfico se abre aunque en la feria no haya internet.
    ruta = CARPETA_SALIDA / archivo
    figura.write_html(ruta, include_plotlyjs=True)
    return ruta


def main():
    tabla, es_real = leer_encuesta()
    CARPETA_SALIDA.mkdir(exist_ok=True)   # crea salida/ si no existe

    total = len(tabla)
    entradas = contar_horas(tabla, "entrada")
    salidas = contar_horas(tabla, "salida")
    zonas = tabla["zona"].value_counts()           # cuenta cada zona
    transportes = tabla["transporte"].value_counts()
    interes = tabla["interes"].value_counts().sort_index()

    # idxmax() = la etiqueta del valor más grande (la moda)
    print("=" * 60)
    print(" RESUMEN DE LA ENCUESTA" + ("" if es_real else "  (⚠️ EJEMPLO, NO REAL)"))
    print("=" * 60)
    print(f"Respuestas válidas: {total}\n")

    print("Horas de ENTRADA más frecuentes (sumando lunes a viernes):")
    for hora, veces in entradas.sort_values(ascending=False).head(3).items():
        print(f"   {hora}  →  {veces} veces")
    print("\nHoras de SALIDA más frecuentes (sumando lunes a viernes):")
    for hora, veces in salidas.sort_values(ascending=False).head(3).items():
        print(f"   {hora}  →  {veces} veces")

    print("\nZonas de origen más comunes:")
    for zona, n in zonas.items():
        print(f"   {zona:<26} {n} ({n / total:.0%})")   # :.0% = porcentaje sin decimales

    # Zonas escritas de una forma que no reconocimos: agrégalas a ALIAS_ZONAS
    lista_zonas, _ = cargar_zonas()
    raras = [z for z in zonas.index if id_de_zona(z, lista_zonas) is None]
    if raras:
        print("   ⚠️ No reconocidas (agrégalas a ALIAS_ZONAS en comun.py):", raras)

    print(f"\nMedio de transporte predominante: {transportes.idxmax()} "
          f"({transportes.max()} de {total})")
    for medio, n in transportes.items():
        print(f"   {medio:<26} {n}")

    print(f"\nMinutos de espera tolerables: promedio {tabla['espera'].mean():.0f}, "
          f"mínimo {tabla['espera'].min():.0f}, máximo {tabla['espera'].max():.0f}")
    print(f"¿La usarías? (1-5): promedio {tabla['interes'].mean():.1f}; "
          f"respondieron 4 o 5: {(tabla['interes'] >= 4).sum()} de {total}")

    print("\n¿Qué te frenaría? (respuestas abiertas):")
    for texto in tabla["freno"]:
        if texto:
            print(f"   - {texto}")

    # --- Gráficos ---
    archivos = [
        grafico_barras(entradas, "Horas de entrada (lunes a viernes)", "Hora",
                       "horas_entrada.html", es_real),
        grafico_barras(salidas, "Horas de salida (lunes a viernes)", "Hora",
                       "horas_salida.html", es_real),
        grafico_barras(zonas, "Zonas de origen", "Zona",
                       "zonas_origen.html", es_real),
        grafico_barras(transportes, "Medio de transporte", "Medio",
                       "medio_transporte.html", es_real),
        grafico_barras(interes, "¿Usarías la app? (1 = nada, 5 = mucho)", "Respuesta",
                       "interes.html", es_real),
    ]
    print("\nGráficos guardados:")
    for ruta in archivos:
        print(f"   {ruta.relative_to(CARPETA_SALIDA.parent)}")

    if not es_real:
        aviso_grande(["Recuerda: todo lo anterior salió del ARCHIVO DE EJEMPLO."])


# Esta línea hace que main() se ejecute solo si corres el archivo
# directamente (python analisis_encuesta.py), no si otro script lo importa.
if __name__ == "__main__":
    main()
