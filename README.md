# Carpool universitario por zonas

Web app de carpool para **una** universidad. Universidad piloto: **Universidad del Valle de Guatemala (UVG)**,
Campus Central, zona 15, Ciudad de Guatemala. Correo institucional permitido: `@uvg.edu.gt` [verificar con un estudiante].
Los estudiantes:

1. Se registran con su **correo institucional verificado**.
2. Eligen las **zonas** por las que pasan y su **horario** por día.
3. Ven **compañeros compatibles** ordenados por puntaje.
4. Ven un **punto de encuentro público** en el mapa.

> 🔒 **Privacidad:** la app **nunca** guarda ni muestra direcciones de casa,
> coordenadas de casa, teléfonos ni fotos. El perfil solo elige zonas de una lista.

> 🧪 Todo dato de demostración lleva `esDemo = true` y se muestra en la interfaz
> con la etiqueta **"Dato de prueba"**.

---

## Stack

| Capa | Herramienta |
|---|---|
| Interfaz | HTML + CSS + JavaScript sin framework (ES modules nativos, sin bundler) |
| Mapa | Leaflet + OpenStreetMap (sin clave de API), zonas en `web/data/zonas.geojson` |
| Cuentas y datos | Firebase Authentication (correo + contraseña + verificación) y Cloud Firestore, SDK web modular desde la CDN de Firebase |
| Seguridad | Reglas de Firestore en `firebase/firestore.rules` |
| Análisis y datos demo | Python (pandas + Plotly, random / Faker opcional), **fuera de la app** |
| Publicación | GitHub Pages o Firebase Hosting |
| Versiones | Git |

---

## Estructura

```
carpool-zonas/
├── README.md
├── .gitignore
├── web/                      ← la app (lo que se publica)
│   ├── index.html            login / registro
│   ├── app.html              perfil, coincidencias, mapa
│   ├── recomendaciones.html
│   ├── css/estilos.css
│   ├── js/                   módulos de JavaScript
│   └── data/zonas.geojson    polígonos de las zonas
├── firebase/firestore.rules  reglas de seguridad
├── python/                   análisis de encuesta y datos demo
├── tests/matching.test.html  pruebas del matching en el navegador
└── docs/explicaciones/       una explicación por fase
```

---

## Cómo correrlo en local

Los ES modules (`<script type="module">`) y `fetch()` **no funcionan** si abres el
HTML con doble clic (`file://`). Hay que usar un servidor local:

```bash
cd carpool-zonas
python -m http.server 8000
```

Luego abre en el navegador:

- App: <http://localhost:8000/web/index.html>
- Mapa: <http://localhost:8000/web/app.html>
- Pruebas: <http://localhost:8000/tests/matching.test.html>

(En Windows, si `python` no funciona, prueba `py -m http.server 8000`.)

### Python (análisis y datos demo)

```bash
cd carpool-zonas/python
pip install -r requirements.txt
python analisis_encuesta.py
python generar_demo.py
python cargar_demo.py      # ensayo: no sube nada (subir: --confirmar)
```

Los archivos generados quedan en `python/salida/` (ignorada por Git).

---

## Cómo desplegar

**Opción A – GitHub Pages**
1. Crea un repositorio en GitHub y sube el proyecto (`git remote add origin ...`, `git push`).
2. En el repositorio: *Settings → Pages → Deploy from a branch*, rama `main`, carpeta `/ (root)`.
3. La app quedará en `https://TU_USUARIO.github.io/TU_REPO/web/index.html`.
4. Agrega ese dominio en Firebase: *Authentication → Settings → Authorized domains*.

**Opción B – Firebase Hosting**
1. Instala la CLI: `npm install -g firebase-tools` y luego `firebase login`.
2. `firebase init hosting` → carpeta pública: `web`.
3. `firebase deploy`.

Las reglas de seguridad se publican con `firebase deploy --only firestore:rules`
(o copiándolas a mano en la consola de Firebase → Firestore → Reglas).

---

## ✋ Pasos manuales que te quedan

- [x] Elegir la universidad piloto → **UVG** (dominio `uvg.edu.gt`).
- [ ] Crear el proyecto en <https://console.firebase.google.com>.
- [ ] Activar **Authentication → Correo/contraseña**.
- [ ] Crear la base **Cloud Firestore**.
- [ ] Registrar una app web y pegar su configuración en `web/js/firebase-config.js`
      (reemplazando `"TU_API_KEY"`, etc.).
- [ ] Poner `DOMINIO_UNIVERSIDAD = "uvg.edu.gt"` en `web/js/auth.js` **y** en `firebase/firestore.rules`.
- [ ] Quitar el dominio de prueba marcado con **"QUITAR ANTES DE LA DEMO"**.
- [ ] Publicar las reglas de `firebase/firestore.rules`.
- [x] Zonas reales: 5 rutas sacadas de la encuesta en `web/data/zonas.geojson` (límites **aproximados**:
      corregirlos en <https://geojson.io> si algún borde está mal).
- [ ] Elegir y visitar un punto de encuentro real por ruta y reemplazar los "Punto por definir"
      de `web/data/puntos-encuentro.json` (agregar `fechaObservacion` y quitar `esDemo`).
- [ ] Para `cargar_demo.py`: descargar una clave de cuenta de servicio, guardarla
      **fuera del repositorio** y poner su ruta en la variable de entorno
      `GOOGLE_APPLICATION_CREDENTIALS`. **Nunca** la subas a Git.

---

## Fases de desarrollo

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Esqueleto: carpetas, README, .gitignore, git init | ✅ |
| 2 | Mapa: HTML base, estilos, mapa.js, zonas.geojson | ✅ |
| 3 | Autenticación: firebase-config.js, auth.js, firestore.rules | ⏳ |
| 4 | Perfil y matching: perfil.js, matching.js, pruebas | ⏳ |
| 5 | Solicitudes y recomendaciones | ⏳ |
| 6 | Python: análisis de encuesta y datos demo | ✅ |

Cada fase tiene su explicación en `docs/explicaciones/fase-N.md`.
