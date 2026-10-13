# Fase 1 — Esqueleto del proyecto

## ✅ Qué se completó

Se creó la estructura de carpetas, el README, el `.gitignore` y el repositorio Git
con su primer commit.

Archivos creados:

| Archivo | Para qué sirve |
|---|---|
| `README.md` | Portada del proyecto: qué es, cómo correrlo, cómo desplegar, pasos pendientes |
| `.gitignore` | Lista de archivos que Git nunca debe subir (credenciales, salidas de Python) |
| `web/css/.gitkeep`, `web/js/.gitkeep`, `web/data/.gitkeep`, `firebase/.gitkeep`, `python/data/.gitkeep`, `tests/.gitkeep` | Archivos vacíos que mantienen las carpetas en Git hasta que tengan contenido |
| `docs/explicaciones/fase-1.md` | Este documento |

---

## Explicación archivo por archivo

### 1. Las carpetas

```bash
mkdir -p carpool-zonas/{web/{css,js,data},firebase,python/data,tests,docs/explicaciones}
```

- `mkdir` = *make directory*, crea carpetas.
- `-p` = crea también las carpetas "padre" que falten (sin él, `web/css` falla si
  `web` no existe todavía) y no da error si ya existen.
- `{a,b,c}` = expansión de llaves de la terminal Bash: escribe `a`, `b` y `c` sin
  repetir el resto de la ruta. `web/{css,js,data}` se convierte en
  `web/css web/js web/data`. **Ojo:** esto funciona en Git Bash, no en la terminal
  clásica de Windows (`cmd`). En "Cómo replicarlo" te dejo la versión para PowerShell.

**Por qué esta división:** `web/` es *lo único que se publica*; `python/`,
`firebase/`, `tests/` y `docs/` son herramientas de trabajo. Separarlas evita subir
por error scripts o datos al sitio público.

### 2. Los `.gitkeep`

```bash
for d in web/css web/js web/data firebase python/data tests; do touch "$d/.gitkeep"; done
```

- `for d in ...; do ...; done` = repite el comando para cada carpeta de la lista;
  en cada vuelta `d` vale una carpeta distinta.
- `touch` = crea un archivo vacío.
- `"$d/.gitkeep"` = la ruta del archivo; las comillas evitan problemas con espacios
  (tu carpeta "Feria 2026" tiene uno).

**Por qué:** Git guarda *archivos*, no carpetas. Una carpeta vacía desaparece al
clonar el repo. `.gitkeep` no es nada especial para Git: es solo una convención
para decir "este archivo existe para que la carpeta no se pierda". Los borraremos
cuando cada carpeta tenga su contenido real.

### 3. `README.md` (por partes)

```markdown
# Carpool universitario por zonas

Web app de carpool para **una** universidad (piloto por definir). Los estudiantes:

1. Se registran con su **correo institucional verificado**.
...
> 🔒 **Privacidad:** la app **nunca** guarda ni muestra direcciones de casa,
```

- `#` = título principal (Markdown). `##` es un subtítulo, `###` uno más pequeño.
- `**texto**` = negrita.
- `1.` = lista numerada; `-` = lista con viñetas.
- `>` = cita/recuadro destacado. Lo usé para las dos reglas que nunca se rompen:
  privacidad y la etiqueta "Dato de prueba". Ponerlas al inicio hace que cualquiera
  que abra el proyecto (jurado, compañero) las vea primero.
- `---` = línea horizontal para separar secciones.

```markdown
| Capa | Herramienta |
|---|---|
| Interfaz | HTML + CSS + JavaScript sin framework ... |
```

- Una tabla en Markdown: la primera fila son los encabezados, la segunda (`|---|---|`)
  le dice a Markdown "lo de arriba es encabezado", y cada fila siguiente es una fila
  de datos. Sirve para resumir el stack de un vistazo.

````markdown
```bash
cd carpool-zonas
python -m http.server 8000
```
````

- Tres comillas invertidas abren un **bloque de código**; `bash` indica el lenguaje
  para colorearlo.
- `python -m http.server 8000` = ejecuta el módulo `http.server` que ya viene con
  Python y sirve la carpeta actual en `http://localhost:8000`.
- **Por qué hace falta:** si abres `index.html` con doble clic, el navegador usa
  `file://` y por seguridad bloquea los ES modules y `fetch()` (que usaremos para
  leer `zonas.geojson`). Con un servidor local la página se carga por `http://`
  como en internet.

```markdown
- [ ] Crear el proyecto en <https://console.firebase.google.com>.
```

- `- [ ]` = casilla de verificación (en GitHub se ve como checklist). La sección
  "Pasos manuales que te quedan" es tu lista de pendientes: lo que yo no puedo hacer
  por ti (crear Firebase, elegir universidad, dibujar zonas reales).
- `<https://...>` = enlace automático.

La tabla final "Fases de desarrollo" la iremos actualizando (⏳ → ✅) en cada commit.

### 4. `.gitignore`

```gitignore
# --- Credenciales y secretos (¡nunca al repositorio!) ---
*serviceAccount*.json
*service-account*.json
*-firebase-adminsdk-*.json
credenciales/
.env
.env.*
```

- `#` = comentario; Git lo ignora.
- `*` = comodín: "cualquier cantidad de caracteres". `*serviceAccount*.json`
  bloquea `miServiceAccount.json`, `serviceAccount-prueba.json`, etc.
- `*-firebase-adminsdk-*.json` = el nombre que Firebase le pone automáticamente a
  la clave que descargas (ej. `carpool-1234-firebase-adminsdk-abc12.json`). La
  usaremos en la fase 6 con `cargar_demo.py`.
- `credenciales/` = la barra final significa "esta carpeta completa".
- `.env` = archivo típico donde se guardan variables secretas en local.

**Por qué es lo más importante del archivo:** una clave de cuenta de servicio da
**control total** sobre tu base de datos. Si se sube a GitHub (aunque sea un minuto),
bots la encuentran y la pueden usar. Mejor bloquearla antes de que exista.

```gitignore
python/salida/
__pycache__/
*.pyc
.venv/
venv/
.ipynb_checkpoints/
```

- `python/salida/` = donde los scripts de Python guardarán gráficos y
  `demo_usuarios.json`. Son archivos que se pueden **regenerar**, así que no hace
  falta versionarlos.
- `__pycache__/` y `*.pyc` = versiones compiladas que Python crea solo para
  arrancar más rápido.
- `.venv/`, `venv/` = entornos virtuales de Python (pesan cientos de MB).
- `.ipynb_checkpoints/` = copias automáticas si abres algo en Jupyter.

```gitignore
.firebase/
firebase-debug.log
firestore-debug.log
.DS_Store
Thumbs.db
desktop.ini
.vscode/
```

- `.firebase/`, `*-debug.log` = caché y registros que crea la CLI de Firebase.
- `.DS_Store` (Mac), `Thumbs.db` y `desktop.ini` (Windows) = archivos ocultos del
  sistema operativo, no tienen nada que ver con el proyecto.
- `.vscode/` = configuración personal de tu editor.

### 5. Git

```bash
git init -b main
git config user.name "Paolo"
git config user.email "tu-correo@ejemplo.com"
git add -A
git commit -m "Fase 1: esqueleto del proyecto"
```

- `git init` = convierte la carpeta en un repositorio: crea la carpeta oculta
  `.git/`, donde Git guarda toda la historia.
- `-b main` = la rama principal se llama `main` (lo que espera GitHub).
- `git config user.name/email` = quién firma los commits. Sin `--global` solo
  aplica a este repositorio.
- `git add -A` = pasa **todos** los cambios al "área de preparación" (*staging*).
  Los archivos que coinciden con `.gitignore` se saltan solos.
- `git commit -m "..."` = guarda una "foto" de lo preparado con un mensaje que
  describe el cambio.

---

## Conceptos nuevos

1. **Repositorio y commit.** Un repositorio es una carpeta con memoria. Cada commit
   es una foto completa del proyecto en un momento; si rompes algo en la fase 4,
   puedes volver a la foto de la fase 3 (`git log` para ver la lista,
   `git checkout <id> -- archivo` para recuperar un archivo).
2. **Staging (área de preparación).** Git separa "lo que cambié" de "lo que voy a
   guardar". `git add` elige qué entra en la próxima foto; `git commit` la toma.
   Así puedes hacer commits pequeños y ordenados.
3. **`.gitignore` como cinturón de seguridad.** Se escribe *antes* de que existan
   los archivos peligrosos. Si un archivo ya se subió una vez, agregarlo después al
   `.gitignore` **no** lo borra de la historia.
4. **Separar lo publicable de lo de trabajo.** `web/` es el sitio; todo lo demás
   son herramientas. Esa separación es una decisión de arquitectura y de seguridad.

---

## Cómo replicarlo tú

Necesitas Git instalado (<https://git-scm.com>) — al instalarlo viene **Git Bash**.

**Con Git Bash:**

1. Abre Git Bash en la carpeta donde quieres el proyecto
   (clic derecho → "Open Git Bash here").
2. Crea las carpetas:
   ```bash
   mkdir -p carpool-zonas/{web/{css,js,data},firebase,python/data,tests,docs/explicaciones}
   cd carpool-zonas
   ```
3. Crea los `.gitkeep`:
   ```bash
   for d in web/css web/js web/data firebase python/data tests; do touch "$d/.gitkeep"; done
   ```
4. Crea `README.md` y `.gitignore` en VS Code (`code .` abre la carpeta) y copia o
   reescribe su contenido.
5. Inicia Git y haz el primer commit:
   ```bash
   git init -b main
   git config user.name "Tu Nombre"
   git config user.email "tu-correo@ejemplo.com"
   git add -A
   git status
   git commit -m "Fase 1: esqueleto del proyecto"
   ```

**Con PowerShell** (si no usas Git Bash), el paso 2 y 3 serían:

```powershell
$carpetas = "web/css","web/js","web/data","firebase","python/data","tests","docs/explicaciones"
foreach ($c in $carpetas) { New-Item -ItemType Directory -Force -Path "carpool-zonas/$c" }
cd carpool-zonas
foreach ($c in "web/css","web/js","web/data","firebase","python/data","tests") { New-Item -ItemType File -Force -Path "$c/.gitkeep" }
```

---

## Cómo probarlo

1. Abre una terminal en `carpool-zonas` y ejecuta:
   ```bash
   git log --oneline
   ```
   Debe aparecer **un** commit: `Fase 1: esqueleto del proyecto`.
2. Ejecuta `git status`. Debe decir `nothing to commit, working tree clean`.
3. Prueba que el `.gitignore` funciona:
   ```bash
   echo "{}" > prueba-firebase-adminsdk-x.json
   git status
   ```
   El archivo **no** debe aparecer en la lista. Luego bórralo:
   `rm prueba-firebase-adminsdk-x.json` (PowerShell: `del prueba-firebase-adminsdk-x.json`).
4. Abre `README.md` en VS Code y presiona `Ctrl+Shift+V` para verlo con formato.
