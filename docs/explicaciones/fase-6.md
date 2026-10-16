# Fase 6 — Python: análisis de encuesta y datos demo

## ✅ Qué se completó

Se crearon los scripts de Python que viven **fuera de la app**: uno analiza la
encuesta y hace gráficos, otro inventa 35 perfiles de demostración a partir de la
encuesta, y otro (opcional) los sube a Firestore.

| Archivo | Para qué sirve |
|---|---|
| `python/requirements.txt` | Lista de paquetes que hay que instalar (pandas, plotly, faker, firebase-admin) |
| `python/comun.py` | Rutas, columnas del formulario, lista de zonas y funciones de limpieza que usan los demás scripts |
| `python/data/encuesta_ejemplo.csv` | 12 respuestas **inventadas** con el mismo formato que exporta Google Forms |
| `python/analisis_encuesta.py` | Limpia la encuesta, imprime un resumen y guarda 5 gráficos de barras en `python/salida/` |
| `python/generar_demo.py` | Crea 35 perfiles ficticios con `esDemo: true` → `python/salida/perfiles_demo.json` y `web/data/perfiles-demo.json` |
| `python/cargar_demo.py` | Sube los perfiles a la colección `usuarios`. **Por defecto solo hace un ensayo**; sube de verdad solo con `--confirmar` |
| `web/data/perfiles-demo.json` | Copia de los perfiles para el modo demo sin internet (Fase 7) |
| `docs/explicaciones/fase-6.md` | Este documento |

---

## Explicación archivo por archivo

### 1. `requirements.txt`

```text
pandas>=2.0
plotly>=5.18
faker>=24.0
firebase-admin>=6.5
```

- Cada línea es un paquete. `>=2.0` = "la versión 2.0 o una más nueva".
- `pip install -r requirements.txt` instala todos de una vez (`-r` = "lee la lista
  de este archivo").
- **Por qué versiones mínimas y no exactas:** con versiones exactas, en Colab o en
  otra computadora a veces choca con lo que ya está instalado. La mínima asegura
  que existan las funciones que usamos.

### 2. `data/encuesta_ejemplo.csv`

**ARCHIVO DE EJEMPLO — reemplazar por encuesta.csv real.**

```csv
Marca temporal,Zona de origen,Medio de transporte,Entrada lunes,Salida lunes,...,Minutos de espera tolerables,¿La usarías? (1-5),¿Qué te frenaría?
2026/10/20 8:12:03 p. m.,Zona Sur,Carro propio,7:00,13:00,...,15,4,No conocer a la otra persona
2026/10/20 8:20:41 p. m.,zona sur,Me traen mis papás,07:00,1:00 p. m.,...
```

- CSV = *valores separados por comas*: cada línea es una respuesta y cada coma
  separa una columna. La primera línea son los encabezados (las preguntas).
- Si una respuesta tiene una coma adentro, va entre comillas:
  `"Seguridad, no saber quién maneja"`.
- Está **desordenado a propósito**, como una encuesta real: `zona sur`, `Zona Sur`
  y `sur` son la misma zona; las horas vienen como `7:00`, `07:00`,
  `7:00:00 a. m.`, `1:00 p. m.` o `7.30`; hay días vacíos (sin clase). Así se
  comprueba que la limpieza funciona.
- Las zonas usan los mismos nombres que `web/data/zonas.geojson` (Fase 2).

### 3. `comun.py` — lo compartido

Aquí está **todo lo que probablemente tendrás que ajustar** con la encuesta real.

```python
CARPETA_PYTHON = Path(__file__).resolve().parent
CARPETA_SALIDA = CARPETA_PYTHON / "salida"
```

- `Path` (de `pathlib`) representa rutas de archivos. `/` une partes de una ruta y
  funciona igual en Windows y en Mac/Linux (no hay que pelear con `\` vs `/`).
- `__file__` es la ruta de este mismo archivo; `.parent` es su carpeta. Así los
  scripts encuentran `data/` y `salida/` aunque los corras desde otra carpeta.

```python
COLUMNAS = {
    "zona": "Zona de origen",
    "transporte": "Medio de transporte",
    ...
}
```

- Un **diccionario** (`{clave: valor}`) que traduce el encabezado largo del Google
  Form a un nombre corto. Si en tu formulario la pregunta dice otra cosa, cambias
  **solo el texto de la derecha** y todo lo demás sigue funcionando.
- Las 10 columnas de horario (`Entrada lunes`, `Salida lunes`, …) se agregan con
  un `for` para no escribirlas a mano.

```python
DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes"]
CAMPOS_PERFIL = {"uid", "nombre", "carrera", "rol", "zonas", "horario",
                 "tolerancia", "esDemo"}
```

- `DIAS`: claves de los días **sin tilde** (`miercoles`), para usarlas cómodamente
  en JavaScript (`perfil.horario.miercoles`).
- `CAMPOS_PERFIL`: un **conjunto** (`set`) con los únicos campos permitidos del
  modelo `usuarios`. Los scripts revisan que ningún perfil tenga otro campo, así
  nunca se cuela una dirección, teléfono o foto.

```python
def normalizar(texto):
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", texto)
```

- Convierte `"  Zona Sur "` en `"zonasur"`: minúsculas, sin tildes, sin espacios.
- `NFD` separa la "á" en "a" + tilde; la categoría `"Mn"` son las tildes sueltas,
  y las quitamos.
- `re.sub(r"[^a-z0-9]", "", texto)` es una **expresión regular**: "reemplaza
  todo lo que NO sea letra o número por nada".
- Así `ZONA SUR`, `zona sur` y `Zona  Sur` quedan iguales y se pueden comparar.

```python
def id_de_zona(texto, zonas):
    for z in zonas:
        formas = {normalizar(nombre_limpio(z)), normalizar(z["id"]),
                  normalizar(re.sub(r"^zona-?", "", z["id"]))}
        if clave in formas:
            return z["id"]
```

- Para cada zona arma las formas aceptadas: el nombre (`zonasur`), el id
  (`zona-sur` → `zonasur`) y el id sin "zona" (`sur`). Si lo que escribió el
  estudiante coincide con alguna, devuelve el id (`"zona-sur"`).
- `nombre_limpio` quita la marca `— ejemplo` que tienen las zonas de la Fase 2.
- Si no coincide, se busca en `ALIAS_ZONAS` (apodos que tú agregas a mano, como
  `"zn": "zona-norte"`).

```python
def cargar_zonas():
    if ZONAS_GEOJSON.exists():
        ...
    return ZONAS_PROVISIONALES, False
```

- Lee los ids y nombres de `web/data/zonas.geojson`. **Cuando reemplaces las zonas
  por las reales, los scripts se actualizan solos.** La lista provisional solo se
  usa si el archivo no existe.

```python
_PATRON_HORA = re.compile(r"^(\d{1,2})(?:[:h.](\d{2}))?(?::\d{2})?\s*([ap])?")

def limpiar_hora(valor):
    ...
    if ampm == "p" and hora < 12:
        hora += 12
    return f"{hora:02d}:{minuto:02d}"
```

- La expresión regular reconoce una hora en varias formas. Por partes:
  `(\d{1,2})` = 1 o 2 dígitos (la hora); `(?:[:h.](\d{2}))?` = opcionalmente `:`,
  `h` o `.` y 2 dígitos (los minutos); `(?::\d{2})?` = segundos opcionales
  (Google Forms los pone); `([ap])?` = una `a` o `p` de a. m./p. m.
- `1:30 p. m.` → 13:30 (se suman 12 horas en la tarde).
- `f"{hora:02d}"` escribe el número con 2 dígitos: `7` → `"07"`. Así todas las
  horas quedan en formato `HH:MM`, igual que espera `minutos("HH:MM")` en JavaScript.
- Una celda vacía devuelve `None` (= día sin clase).

```python
def leer_encuesta():
    if ENCUESTA_REAL.exists():
        ruta, es_real = ENCUESTA_REAL, True
    else:
        ruta, es_real = ENCUESTA_EJEMPLO, False
        aviso_grande([...])
    tabla = pd.read_csv(ruta, encoding="utf-8-sig", dtype=str)
```

- Primero busca `data/encuesta.csv` (la real). Si no está, usa la de ejemplo y
  muestra un recuadro grande de advertencia.
- `pd.read_csv` lee el CSV como una **tabla de pandas** (un `DataFrame`: filas y
  columnas, como una hoja de Excel).
- `utf-8-sig` acepta la "marca invisible" (BOM) que a veces trae el CSV de Google.
- `dtype=str` lee todo como texto; nosotros decidimos después qué es número.
- Si falta una columna, el script se detiene y te dice cuáles faltan y cuáles hay.
- Al final limpia cada columna: `apply(función)` aplica la función a cada celda;
  `pd.to_numeric(..., errors="coerce")` convierte a número y deja vacío (NaN) lo
  que no lo sea.

### 4. `analisis_encuesta.py`

```python
def contar_horas(tabla, tipo):
    contador = Counter()
    for dia in DIAS:
        contador.update(tabla[f"{tipo}_{dia}"].dropna())
```

- `Counter` es un diccionario que cuenta: `update` le suma 1 a cada hora que ve.
- Junta los 5 días: alguien que entra a las 7:00 de lunes a viernes suma 5. Por
  eso dice "44 veces" con solo 12 respuestas. `dropna()` salta los días vacíos.

```python
zonas = tabla["zona"].value_counts()
print(f"Medio de transporte predominante: {transportes.idxmax()}")
```

- `value_counts()` cuenta cuántas veces aparece cada valor, ordenado de mayor a menor.
- `idxmax()` = la etiqueta con el valor más alto (la **moda**).
- `{n / total:.0%}` muestra una fracción como porcentaje sin decimales (0.25 → 25%).

```python
figura = px.bar(x=serie.index, y=serie.values, text=serie.values, ...)
figura.update_xaxes(type="category")
figura.write_html(ruta, include_plotlyjs=True)
```

- `plotly.express.bar` crea un gráfico de barras interactivo (al pasar el mouse
  muestra el valor).
- `type="category"` evita que Plotly trate "07:00" como un número o fecha.
- `include_plotlyjs=True` mete la librería **dentro** del HTML: cada archivo pesa
  ~5 MB pero se abre **sin internet**, útil en la feria. (`salida/` está en el
  `.gitignore`, así que no pesa en Git.)
- Si los datos son de ejemplo, el título del gráfico dice "⚠️ DATOS DE EJEMPLO".

```python
if __name__ == "__main__":
    main()
```

- Ejecuta `main()` solo si corres el archivo directamente. Si otro script lo
  importa, no se ejecuta solo.

### 5. `generar_demo.py`

```python
SEMILLA = 2026
azar = random.Random(SEMILLA)
Faker.seed(SEMILLA)
```

- Una **semilla** fija hace que los números "al azar" sean siempre los mismos.
  Correr el script dos veces da **exactamente** el mismo archivo (lo comprobamos
  con `md5sum`). Así la demo no cambia cada vez y Git no ve cambios falsos.

```python
falso = Faker("es_MX")
return lambda: f"{falso.first_name()} {falso.last_name()}"
...
except ImportError:
    return lambda: f"{azar.choice(NOMBRES_RESERVA)} {azar.choice(APELLIDOS_RESERVA)}"
```

- Faker inventa nombres realistas en español. Si no está instalado
  (`ImportError`), se usa una lista propia. Los nombres son **ficticios**.
- `lambda` es una función pequeña sin nombre: aquí, "dame un nombre nuevo".

```python
molde = azar.choice(moldes)
origen = id_de_zona(molde["zona"], zonas) or azar.choices(ids, weights=...)[0]
```

- **Así se "siembra" la distribución con la encuesta:** cada perfil copia una
  respuesta real al azar (el *molde*): su zona, su horario, su tolerancia y su
  medio de transporte. Si en la encuesta Zona Sur aparece 4 de 12 veces, en los
  perfiles demo también será la más común (20 de 35 pasan por ella).
- `azar.choices(lista, weights=pesos)` elige con probabilidades distintas: una
  zona con peso 5 sale 5 veces más que una con peso 1. Se usa para las 0–2 zonas
  extra por las que pasa cada perfil.

```python
def mover_hora(hhmm, azar):
    total = h * 60 + m + azar.choice([-15, 0, 0, 0, 15])
```

- Mueve la hora −15, 0 o +15 minutos para que los perfiles no sean copias
  exactas. El 0 aparece 3 veces en la lista → es el resultado más probable.
- `//` es división entera y `%` el residuo: 435 min → 435 // 60 = 7 h, 435 % 60 = 15 min.

```python
def tolerancia_cercana(minutos):
    return min(TOLERANCIAS, key=lambda t: abs(t - minutos))

def elegir_rol(transporte, azar):
    if "carro" in transporte.lower():
        return azar.choices(["conductor", "ambos"], weights=[60, 40])[0]
    return azar.choices(["pasajero", "ambos"], weights=[85, 15])[0]
```

- La app solo acepta 10, 20 o 30 minutos; "15 minutos de espera" se convierte en
  la opción más cercana.
- Quien tiene carro propio será conductor o "ambos"; los demás, casi siempre pasajeros.

```python
perfiles.append({
    "uid": f"demo-{n:03d}",
    "nombre": nombre, "carrera": ..., "rol": ..., "zonas": mis_zonas,
    "horario": {"lunes": {"entrada": "07:00", "salida": "13:00"}, ..., "jueves": None},
    "tolerancia": 20,
    "esDemo": True,
})
```

- Exactamente los campos del modelo `usuarios` del plan. **No hay** dirección,
  coordenadas de casa, teléfono ni foto.
- `uid` empieza con `demo-` para distinguirlos de los usuarios reales en Firestore.
- Un día sin clase queda en `None`, que en JSON se escribe `null`. La función
  `puntaje` de la Fase 4 debe devolver `null` en ese caso.

```python
assert set(p) == CAMPOS_PERFIL
ARCHIVO_WEB.write_text(texto + "\n", encoding="utf-8")
```

- `assert` = "esto tiene que ser cierto; si no, detente con error". Es la última
  barrera antes de guardar.
- `json.dumps(..., ensure_ascii=False, indent=2)` guarda "María" con su tilde y
  con sangría legible.

### 6. `cargar_demo.py`

```python
grupo = lector.add_mutually_exclusive_group()
grupo.add_argument("--dry-run", action="store_true")
grupo.add_argument("--confirmar", action="store_true")
```

- `argparse` lee las opciones que escribes después del nombre del script.
- `store_true` = si escribes la opción, vale `True`; si no, `False`.
- *Mutuamente excluyentes*: no puedes poner las dos a la vez.
- **Sin `--confirmar` nunca sube nada.** Es un seguro contra subir por accidente.

```python
if CARPETA_PROYECTO in archivo.parents:
    print("⛔ La clave está DENTRO de la carpeta del proyecto...")
```

- Revisa la variable `GOOGLE_APPLICATION_CREDENTIALS` y se **niega** a usar una
  clave guardada dentro de `carpool-zonas/`, para que nunca termine en Git.

```python
lote = db.batch()
for p in perfiles:
    lote.set(db.collection("usuarios").document(p["uid"]), p)
lote.commit()
```

- Un **lote** (*batch*) agrupa las 35 escrituras y las manda juntas: o se guardan
  todas o ninguna.
- El id del documento es el `uid`: si lo corres dos veces, sobrescribe los mismos
  35 documentos en vez de duplicarlos.
- Ojo: firebase-admin **se salta las reglas de Firestore** (tiene permisos de
  administrador). Por eso el script revisa por su cuenta que todo perfil tenga
  `esDemo: true`, uid `demo-…` y solo campos permitidos, y además pide escribir
  `SI` antes de subir.

---

## Conceptos nuevos

1. **Limpieza de datos.** La gente escribe la misma cosa de muchas formas. Antes
   de contar hay que *unificar*; si no, "Zona Sur" y "zona sur" saldrían como dos
   zonas distintas en el gráfico.
2. **DataFrame de pandas.** Una tabla en memoria: puedes elegir una columna
   (`tabla["zona"]`), contar (`value_counts`), aplicar funciones (`apply`) y
   quitar vacíos (`dropna`).
3. **Semilla aleatoria.** El "azar" de la computadora es una fórmula; con la misma
   semilla da siempre la misma secuencia. Sirve para que un resultado sea
   **reproducible**.
4. **Datos simulados "sembrados".** Lo simulado imita la forma de lo real, pero
   **nunca** se presenta como hallazgo. Por eso `esDemo: true` y la etiqueta
   "Dato de prueba".
5. **Modo ensayo (*dry run*).** Antes de una acción difícil de deshacer (escribir
   en una base de datos), el script muestra lo que *haría* sin hacerlo.
6. **Cuenta de servicio.** Un "usuario robot" con permisos de administrador sobre
   tu Firebase. Su clave es como la llave maestra de la base: se guarda fuera del
   proyecto y nunca se comparte.

---

## Cómo replicarlo tú

1. Abre una terminal en `carpool-zonas/python` (en VS Code: clic derecho en la
   carpeta → *Open in Integrated Terminal*).
2. Instala los paquetes (en Windows, si `pip` no funciona, usa `py -m pip`):
   ```bash
   pip install -r requirements.txt
   ```
3. Crea los archivos en este orden: `requirements.txt`, `data/encuesta_ejemplo.csv`,
   `comun.py`, `analisis_encuesta.py`, `generar_demo.py`, `cargar_demo.py`. Escribe
   primero `comun.py`, porque los otros tres lo importan.
4. Prueba cada script apenas lo termines (ver abajo).
5. Guarda en Git:
   ```bash
   git add python web/data/perfiles-demo.json docs/explicaciones/fase-6.md README.md
   git commit -m "Fase 6: análisis de encuesta y datos demo en Python"
   ```

### Correrlo en Google Colab (sin instalar nada)

1. Entra a <https://colab.research.google.com> → *Nuevo cuaderno*.
2. En el panel izquierdo, ícono de carpeta 📁 → crea la carpeta `python` y dentro
   `data`. Sube `comun.py`, `analisis_encuesta.py` y `generar_demo.py` a `python/`,
   y el CSV (`encuesta.csv` o `encuesta_ejemplo.csv`) a `python/data/`.
   - Opcional: crea también `web/data/` (al mismo nivel que `python/`) y sube
     `zonas.geojson`, para usar tus zonas reales. Si no, usa las provisionales.
   - Alternativa cuando el proyecto esté en GitHub: en una celda,
     `!git clone https://github.com/TU_USUARIO/TU_REPO.git` y luego
     `%cd TU_REPO/python`.
3. En una celda:
   ```python
   %cd /content/python
   !pip install -q faker plotly
   !python analisis_encuesta.py
   !python generar_demo.py
   ```
   (`!` ejecuta un comando de terminal dentro de Colab; `%cd` cambia de carpeta.
   pandas ya viene instalado.)
4. Los resultados quedan en `python/salida/` y `web/data/`: clic derecho →
   *Descargar*. Copia `perfiles-demo.json` a `web/data/` de tu proyecto.
5. Para ver un gráfico dentro de Colab: `from IPython.display import HTML;
   HTML(open("salida/horas_entrada.html").read())`.
6. **`cargar_demo.py` córrelo en tu computadora, no en Colab:** así la clave de la
   cuenta de servicio nunca se sube a un servidor de Google ajeno a tu proyecto.

### Subir los perfiles a Firestore (cuando tengas Firebase)

1. Consola de Firebase → ⚙️ *Configuración del proyecto* → *Cuentas de servicio*
   → *Generar nueva clave privada*. Se descarga un `.json`.
2. Muévelo **fuera** del proyecto, por ejemplo `C:\Users\suizo\claves\carpool.json`.
3. En PowerShell (solo dura mientras la terminal esté abierta):
   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\Users\suizo\claves\carpool.json"
   python cargar_demo.py              # ensayo: revisa la lista
   python cargar_demo.py --confirmar  # sube; te pide escribir SI
   ```
4. Para quitarlos después: en la consola de Firestore borra los documentos
   `demo-001` … `demo-035`.

---

## Cómo probarlo

1. Análisis:
   ```bash
   python analisis_encuesta.py
   ```
   Debe salir el recuadro **"ATENCIÓN: NO SE ENCONTRÓ data/encuesta.csv"**, el
   resumen (12 respuestas, 07:00 como entrada más frecuente, Zona Sur como zona
   más común, Carro propio como medio predominante) y 5 archivos en `salida/`.
   Ábrelos con doble clic.
2. Perfiles:
   ```bash
   python generar_demo.py
   ```
   Debe decir `35 PERFILES DEMO GENERADOS` y `Todos con esDemo = true: True`.
   Córrelo otra vez: `web/data/perfiles-demo.json` no debe cambiar (`git status`
   no lo muestra como modificado después del commit).
3. Carga en ensayo:
   ```bash
   python cargar_demo.py
   ```
   Debe decir `MODO ENSAYO (--dry-run): NO se sube nada`, listar
   `usuarios/demo-001` … `usuarios/demo-035` y avisar que falta
   `GOOGLE_APPLICATION_CREDENTIALS`.
4. Prueba la limpieza: cambia en el CSV de ejemplo una zona a `ZONA  sur` o una
   hora a `1:00 p. m.` y vuelve a correr el análisis: el resultado no debe cambiar.

---

## Cuando tengas la encuesta real

1. Google Forms → *Respuestas* → ⋮ → *Descargar respuestas (.csv)*. Ábrelo y
   guárdalo como `python/data/encuesta.csv` (no borres el de ejemplo).
2. Si tus preguntas tienen otro texto, ajusta la derecha de `COLUMNAS` en `comun.py`.
   Lo más fácil: que en el formulario cada día tenga dos preguntas de tipo *Hora*
   llamadas `Entrada lunes`, `Salida lunes`, etc.
3. Corre `python analisis_encuesta.py`. Si aparece "⚠️ No reconocidas", agrega
   esos textos a `ALIAS_ZONAS` en `comun.py`.
4. Cuando reemplaces `web/data/zonas.geojson` por las zonas reales, vuelve a
   correr `python generar_demo.py` (y `cargar_demo.py --confirmar` si ya subiste
   perfiles antes).
5. `data/encuesta.csv` tiene respuestas de personas reales: si el repositorio va a
   ser público, agrégalo al `.gitignore` antes de hacer commit.
