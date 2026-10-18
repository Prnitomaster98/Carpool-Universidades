# Fase 2 — Mapa de zonas y puntos de encuentro

## Qué se completó

Se creó la página principal de la app con su menú, los estilos (para celular y para
computadora), el mapa con Leaflet + OpenStreetMap, 5 zonas de ejemplo, 4 puntos de
encuentro de ejemplo, un filtro por zona y la función `resaltarPunto()` que usará la
Fase 5.

| Archivo | Para qué sirve |
|---|---|
| `web/app.html` | Página principal: menú superior y tres secciones (Mi perfil, Coincidencias, Mapa) |
| `web/css/estilos.css` | Estilos de toda la app, *mobile-first*; incluye la clase `.etiqueta-demo` |
| `web/data/zonas.geojson` | 5 zonas de ejemplo (polígonos) alrededor de la Ciudad de Guatemala |
| `web/data/puntos-encuentro.json` | 4 puntos de encuentro de ejemplo en lugares públicos genéricos |
| `web/js/mapa.js` | Crea el mapa, dibuja zonas y puntos, maneja el filtro y exporta `resaltarPunto()` |
| `docs/explicaciones/fase-2.md` | Este documento |
| `README.md` | Fase 2 marcada como Hecho |

> **Zonas de ejemplo:** las 5 zonas son cuadros y pentágonos inventados, solo para
> probar. **Hay que reemplazarlas con zonas reales dibujadas en <https://geojson.io>**
> (ver "Cómo replicarlo", paso 4).

> El enlace "Recomendaciones" del menú todavía da error 404: esa página se crea en
> la Fase 5.

---

## Explicación archivo por archivo

### 1. `web/data/zonas.geojson`

GeoJSON es un formato estándar (es JSON con reglas) para guardar formas en un mapa.
Lo usan Leaflet, Google Maps, geojson.io y casi cualquier herramienta de mapas.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "zona-centro",
        "nombre": "Zona Centro — ejemplo",
        "tipo": "encuentro",
        "esDemo": true
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [-90.5120, 14.6300],
            [-90.5020, 14.6300],
            [-90.5020, 14.6400],
            [-90.5120, 14.6400],
            [-90.5120, 14.6300]
          ]
        ]
      }
    },
    ...
```

- `FeatureCollection` = "colección de elementos". Su lista `features` tiene una
  `Feature` (elemento) por zona.
- Cada `Feature` tiene dos partes:
  - `properties` = **nuestros datos**: `id` (para encontrarla desde el código),
    `nombre` (lo que ve el usuario), `tipo` y `esDemo`.
  - `geometry` = **la forma**: aquí un `Polygon` (polígono).
- `tipo`:
  - `"encuentro"` = zona donde hay puntos de encuentro seguros para subirse al carro.
  - `"paso"` = zona por la que el conductor solo pasa (sirve para el matching de la
    Fase 4, pero no tiene puntos de encuentro).
- `esDemo: true` = regla del proyecto: todo dato inventado lo lleva, para que la
  interfaz muestre "Dato de prueba".

**La trampa más importante del archivo: el orden de las coordenadas.**

| Dónde | Orden |
|---|---|
| GeoJSON (este archivo) | `[longitud, latitud]` → `[-90.51, 14.63]` |
| Leaflet (`mapa.js`), Google Maps | `[latitud, longitud]` → `[14.63, -90.51]` |

GeoJSON usa el orden matemático (x, y): la longitud es el eje horizontal (x). Si los
inviertes, tus zonas aparecen en la Antártida. `L.geoJSON` hace la conversión solo;
tú solo tienes que cuidar el orden cuando escribas coordenadas a mano.

- `coordinates` tiene **tres** niveles de corchetes: `[ [ [lng, lat], ... ] ]`.
  El nivel de afuera es la lista de "anillos" del polígono. El primer anillo es el
  borde; si hubiera más, serían huecos (por ejemplo, un lago dentro de la zona).
- El **último punto es igual al primero**: el anillo debe "cerrarse".
- Los puntos van en sentido **contrario a las agujas del reloj** (lo recomienda el
  estándar). geojson.io lo hace solo.
- Las zonas comparten bordes pero **no se encimen**: así un punto de encuentro
  pertenece a una sola zona.

### 2. `web/data/puntos-encuentro.json`

```json
[
  {
    "id": "punto-1",
    "nombre": "Parqueo de centro comercial — ejemplo",
    "zonaId": "zona-centro",
    "lat": 14.6345,
    "lng": -90.5085,
    "notaSeguridad": "Lugar público, iluminado y con vigilancia. ...",
    "fechaObservacion": "2026-10-10",
    "esDemo": true
  },
  ...
]
```

- Es una **lista** (`[...]`) de objetos, uno por punto. No es GeoJSON porque los
  puntos son simples y así es más fácil de leer y editar.
- `zonaId` = el `id` de la zona a la que pertenece. **Conecta los dos archivos**: el
  filtro lo usa para saber qué puntos mostrar al elegir una zona.
- `lat` y `lng` con nombre: así no hay confusión con el orden.
- `notaSeguridad` = por qué el lugar es seguro (iluminado, con vigilancia, horario).
- `fechaObservacion` = cuándo alguien revisó el lugar. Formato `AAAA-MM-DD` (ISO),
  que se ordena bien y no se confunde entre 10/05 (¿mayo u octubre?).
- **Privacidad:** son lugares **públicos genéricos** (parqueo, gasolinera, parada de
  bus). No hay ni habrá direcciones de casa, teléfonos ni fotos.
- Los 4 puntos están en las 2 zonas de tipo `"encuentro"` (Centro y Este).

### 3. `web/app.html`

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

- Sin esta línea, el celular "finge" ser una pantalla de 980px y muestra todo en
  miniatura. Con ella, usa su ancho real (ej. 375px) y nuestro CSS *mobile-first*
  funciona.

```html
<link rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin="">
<link rel="stylesheet" href="css/estilos.css">
```

- `unpkg.com` = una **CDN**: un servidor público que entrega librerías. Así no
  necesitamos npm.
- `leaflet@1.9.4` = **versión fijada**. Si pusiéramos solo `leaflet`, el día que
  salga una versión nueva con cambios, tu app podría romperse justo el día de la feria.
- `integrity="sha256-..."` = la "huella digital" del archivo. El navegador calcula la
  huella de lo que descarga y, si no coincide, **no lo usa**. Protege contra alguien
  que modifique el archivo en la CDN. (La comprobé contra el paquete oficial de
  Leaflet 1.9.4.)
- `crossorigin=""` = necesario para que la comprobación de `integrity` funcione con
  archivos de otro dominio.
- Nuestros estilos van **después** de los de Leaflet: en CSS, si dos reglas empatan,
  gana la última.

```html
<header class="barra-superior">
  <a class="marca" href="app.html">Carpool por zonas</a>
  <nav aria-label="Menú principal">
    <ul class="menu">
      <li><a href="app.html" aria-current="page">Mi panel</a></li>
      <li><a href="recomendaciones.html">Recomendaciones</a></li>
    </ul>
  </nav>
</header>
```

- `<header>`, `<nav>`, `<main>`, `<section>` = etiquetas **semánticas**: dicen *qué
  es* cada parte. Ayudan a lectores de pantalla y a Google.
- El menú es una lista (`<ul>`) de enlaces: es la forma estándar.
- `aria-current="page"` marca la página actual; el CSS la pinta de azul.

```html
<section id="perfil" class="tarjeta" aria-labelledby="titulo-perfil">
  <h2 id="titulo-perfil">Mi perfil</h2>
  <p class="texto-vacio">Aquí vas a elegir tus zonas y tu horario. (Disponible pronto.)</p>
</section>
```

- Las secciones "Mi perfil" y "Coincidencias" están **vacías a propósito**; la
  Fase 4 las llena desde JavaScript usando sus `id`.
- `aria-labelledby` conecta la sección con su título (accesibilidad).

```html
<select id="filtro-zona">
  <option value="todas">Todas las zonas</option>
</select>
<p id="mensaje-mapa" class="mensaje-mapa" aria-live="polite"></p>
<div id="mapa" class="mapa"></div>
```

- El `<select>` solo trae "Todas las zonas"; **`mapa.js` agrega una opción por
  zona** leyendo el GeoJSON. Así, si cambias las zonas, el filtro se actualiza solo.
- `aria-live="polite"` = cuando el texto cambia, un lector de pantalla lo anuncia.
- `<div id="mapa">` = el lugar donde Leaflet dibuja. Está vacío en el HTML.

```html
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="..." crossorigin=""></script>
<script type="module" src="js/mapa.js"></script>
```

- Leaflet se carga como **script clásico**: crea una variable global llamada `L`.
- `mapa.js` se carga como **módulo** (`type="module"`), lo que permite usar
  `export`/`import`. Los módulos esperan a que todo el HTML esté listo antes de
  correr, y como Leaflet está antes, `L` ya existe cuando `mapa.js` empieza.
- Los scripts van al final del `<body>`: así la página se dibuja primero.

### 4. `web/css/estilos.css`

```css
:root {
  --color-encuentro: #f97316;     /* naranja: zonas de encuentro */
  --color-paso: #2563eb;          /* azul: zonas de paso */
  ...
}
```

- **Variables CSS**: se definen una vez en `:root` y se usan con
  `var(--color-paso)`. Cambias un color en un solo lugar y cambia en toda la app.

```css
*, *::before, *::after { box-sizing: border-box; }
```

- Hace que `width: 100%` incluya el relleno y el borde. Sin esto, una caja con
  `width: 100%` + `padding` queda más ancha que la pantalla y aparece scroll horizontal
  en el celular.

```css
.barra-superior {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 1000;
}
```

- `display: flex` = pone los hijos (marca y menú) en fila.
- `flex-wrap: wrap` = si no caben (celular), el menú baja a otra línea.
- `space-between` = marca a la izquierda, menú a la derecha.
- `position: sticky; top: 0` = el menú se queda pegado arriba al bajar.
- `z-index: 1000` = el menú queda **encima** del mapa. Leaflet usa z-index de hasta
  ~800 en sus capas; con menos que eso, el mapa taparía el menú al hacer scroll.

```css
.mapa {
  height: 60vh;
  min-height: 320px;
}
```

- **Leaflet necesita que su contenedor tenga altura.** Un `<div>` vacío mide 0px de
  alto, así que sin esta regla el mapa "no aparece" (es el error más común con
  Leaflet).
- `60vh` = 60 % del alto de la ventana. `min-height` evita que quede diminuto en
  pantallas bajitas.

```css
.etiqueta-demo {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--color-demo-fondo);
  color: var(--color-demo-texto);
}
```

- La etiqueta amarilla "Dato de prueba". `border-radius: 999px` le da forma de
  pastilla. Esta misma clase se usará en perfiles y coincidencias de prueba.

```css
.leaflet-popup-content .popup-titulo { margin: 0 0 4px; }
```

- Leaflet ya le pone márgenes grandes a los `<p>` de sus popups. Para ganarle,
  nuestra regla es **más específica** (dos clases en vez de una etiqueta y una clase).

**Mobile-first con `@media`:**

```css
/* Sin @media: celular → una columna, todo apilado */

@media (min-width: 768px) {          /* tablet */
  .contenido { grid-template-columns: 1fr 1fr; }
  .tarjeta-mapa { grid-column: 1 / -1; }
}

@media (min-width: 1024px) {         /* computadora */
  .contenido { grid-template-columns: 340px 1fr; }
  .tarjeta-mapa { grid-column: 2; grid-row: 1 / span 2; }
}
```

- Primero se escriben los estilos del celular (sin `@media`). Luego cada `@media
  (min-width: ...)` **agrega** cambios cuando la pantalla es *al menos* así de ancha.
- `display: grid` + `grid-template-columns` divide el contenido en columnas.
  `1fr` = "una fracción del espacio que sobra".
- `grid-column: 1 / -1` = "de la primera línea a la última": ocupa todo el ancho.
- En computadora: columna izquierda de 340px (perfil y coincidencias) y el mapa grande
  a la derecha ocupando las dos filas (`span 2`).
- `.tarjeta { min-width: 0; }` = evita que el mapa estire la columna y cause scroll
  horizontal (detalle raro de grid: por defecto una celda no se encoge menos que su
  contenido).

### 5. `web/js/mapa.js`

Está dividido en 8 partes numeradas en los comentarios. Las importantes:

**Parte 1 — Configuración**

```js
const CENTRO_INICIAL = [14.6349, -90.5069];
const RUTA_ZONAS = 'data/zonas.geojson';
const COLORES_ZONA = { encuentro: '#f97316', paso: '#2563eb' };
```

- `const` = valor que no se reasigna. Ponerlos arriba con MAYÚSCULAS es una
  convención: "esto es configuración, cámbialo aquí".
- Las rutas son **relativas a `app.html`**, no a `mapa.js`: `fetch` resuelve rutas
  desde la página que está abierta.

**Parte 2 — Variables del módulo**

```js
const capasZona = new Map();   // zonaId  -> capa (polígono)
const marcadores = new Map();  // puntoId -> { marcador, punto }
```

- Un `Map` es un "diccionario": guardas algo con una clave y lo recuperas al
  instante con `marcadores.get('punto-3')`. Así `resaltarPunto()` y el filtro
  encuentran cada marcador sin recorrer todo.
- Estas variables **no se exportan**: solo este archivo las toca. Los otros
  módulos solo ven lo que lleva `export`.

**Parte 3 — `cargarJSON()`**

```js
async function cargarJSON(ruta) {
  const respuesta = await fetch(ruta);
  if (!respuesta.ok) {
    throw new Error(`No se pudo cargar ${ruta} (código ${respuesta.status})`);
  }
  return respuesta.json();
}
```

- `fetch(ruta)` pide el archivo al servidor. Tarda, así que devuelve una **promesa**
  (un "te lo doy cuando llegue").
- `async` / `await` = esperar la promesa sin congelar la página.
- **`fetch` no da error con un 404** (archivo no encontrado): solo falla si no hay
  conexión. Por eso revisamos `respuesta.ok` y lanzamos el error nosotros con `throw`.
- `` `texto ${variable}` `` = *template string*: mete variables dentro de un texto.

**Parte 3 — `formatearFecha()` (trampa de zona horaria)**

```js
const [anio, mes, dia] = textoFecha.split('-').map(Number);
const fecha = new Date(anio, mes - 1, dia);
return fecha.toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' });
```

- `new Date("2026-10-10")` se interpreta como medianoche en hora **UTC**. Guatemala
  está 6 horas atrás, así que se mostraría **"9 de octubre"**. Error real y muy común.
- Solución: `split('-')` corta el texto en `["2026","10","10"]`, `map(Number)` los
  vuelve números, y `new Date(año, mes, día)` crea la fecha en hora **local**.
- `mes - 1` porque en JavaScript **los meses van de 0 (enero) a 11 (diciembre)**.
- `toLocaleDateString('es-GT', ...)` la escribe en español de Guatemala.

**Parte 3 — `crearParrafo()` y por qué `textContent`**

```js
const p = document.createElement('p');
p.textContent = texto;
```

- Creamos los elementos con `createElement` y les ponemos texto con `textContent`,
  **no** con `innerHTML`. Si algún día un dato trae `<script>` o `<img onerror=...>`
  (por ejemplo, un nombre escrito por un usuario en la Fase 4), `textContent` lo
  muestra como texto; `innerHTML` lo ejecutaría. Esto se llama prevenir **XSS**.

**Parte 4 — `dibujarZonas()`**

```js
const capaGeoJSON = L.geoJSON(geojson, {
  style: (feature) => {
    const color = COLORES_ZONA[feature.properties.tipo] ?? '#6b7280';
    return { color, weight: 2, fillColor: color, fillOpacity: 0.25 };
  },
  onEachFeature: (feature, capa) => {
    capasZona.set(feature.properties.id, capa);
    capa.bindPopup(crearPopupZona(feature.properties));
  },
});
```

- `L.geoJSON` lee el GeoJSON y crea un polígono por zona (y convierte `[lng, lat]`
  al orden de Leaflet).
- `style` = función que Leaflet llama **una vez por zona**; devuelve su estilo.
  Busca el color según `tipo`. `??` significa "si lo de la izquierda no existe, usa
  lo de la derecha": gris si el tipo está mal escrito.
- `{ color, ... }` es atajo de `{ color: color, ... }`.
- `color` = borde, `fillColor` = relleno, `fillOpacity: 0.25` = relleno transparente
  para ver las calles debajo.
- `onEachFeature` = también una vez por zona: guardamos la capa en el `Map` y le
  ponemos su popup.
- `fitBounds(...getBounds())` = mueve la cámara para que se vean todas las zonas.
- Después, un `for...of` recorre las zonas y agrega una `<option>` al filtro por cada
  una.

**Parte 5 — `dibujarPuntos()`**

```js
const marcador = L.circleMarker([punto.lat, punto.lng], estiloPuntoNormal());
marcador.bindPopup(crearPopupPunto(punto));
```

- `L.circleMarker` = un círculo que mide lo mismo en pantalla con cualquier zoom.
  Lo elegí en vez del "pin" clásico porque se le cambia el color con una línea
  (`setStyle`), y eso es justo lo que necesita `resaltarPunto()`.
- Aquí el orden es `[lat, lng]` (orden de Leaflet).
- `bindPopup` = la ventanita al tocarlo: nombre, nota de seguridad, fecha y la
  etiqueta "Dato de prueba" si `esDemo` es `true`.

**Parte 6 — `aplicarFiltro(zonaId)`**

```js
for (const [id, capa] of capasZona) {
  const visible = zonaId === 'todas' || id === zonaId;
  if (visible) capa.addTo(mapa);
  else capa.remove();
}
```

- Recorre todas las zonas: si está elegida (o se eligió "todas") la agrega al mapa,
  si no, la quita. Lo mismo con los puntos, comparando `punto.zonaId`.
- `===` = "exactamente igual"; `||` = "o".
- Quitar del mapa **no borra** la capa: sigue guardada en el `Map` y se puede
  volver a agregar.
- Al final mueve la cámara a la zona y escribe un mensaje (ej. "Esta zona es de paso:
  no tiene puntos de encuentro.").

**Parte 7 — `resaltarPunto(puntoId)` (exportada para la Fase 5)**

```js
export function resaltarPunto(puntoId) {
  const encontrado = marcadores.get(puntoId);
  if (!mapa || !encontrado) { console.warn(...); return false; }
  // 1) quitar el resaltado anterior
  // 2) si el filtro oculta el punto, cambiar el filtro a su zona
  // 3) pintarlo de morado, agrandarlo, centrar la cámara y abrir el popup
  marcador.setStyle({ radius: 14, fillColor: COLOR_RESALTADO, ... });
  mapa.setView([punto.lat, punto.lng], Math.max(mapa.getZoom(), 16));
  marcador.openPopup();
  return true;
}
```

- `export` = otros módulos pueden usarla con
  `import { resaltarPunto } from './mapa.js';`.
- Devuelve `true` o `false` para que quien la llame sepa si funcionó.
- `Math.max(mapa.getZoom(), 16)` = acerca la cámara al menos a zoom 16, pero no la
  aleja si ya estaba más cerca.
- **Nota para la Fase 5:** los datos se cargan con `fetch`, que tarda un poco. Si
  alguien llama `resaltarPunto()` antes de que termine, devuelve `false`. En la
  Fase 5 se llama cuando el usuario hace clic, así que para entonces ya cargó.
- Un módulo se ejecuta **una sola vez** aunque varios archivos lo importen; por eso
  la Fase 5 usará el mismo mapa, no uno nuevo.

**Parte 8 — `iniciarMapa()`**

```js
if (typeof L === 'undefined') { mostrarMensaje('No se pudo cargar...', true); return; }
mapa = L.map('mapa').setView(CENTRO_INICIAL, ZOOM_INICIAL);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(mapa);
const [zonas, puntos] = await Promise.all([cargarJSON(RUTA_ZONAS), cargarJSON(RUTA_PUNTOS)]);
```

- `typeof L === 'undefined'` = si Leaflet no cargó (sin internet), muestra un mensaje
  en vez de un error confuso.
- `L.map('mapa')` = crea el mapa dentro del `<div id="mapa">`.
- `tileLayer` = el fondo del mapa, hecho de "baldosas" (*tiles*) de 256×256px.
  `{z}/{x}/{y}` se reemplaza por el zoom y la posición de cada baldosa.
- La **atribución** a OpenStreetMap es **obligatoria** por su licencia.
- `Promise.all([...])` = descarga los dos archivos **al mismo tiempo** y espera a
  ambos. Más rápido que uno después del otro.
- `try { ... } catch (error) { ... }` = si algo falla dentro del `try`, salta al
  `catch` y muestra un mensaje útil (archivo con otro nombre o JSON con un error).
- Al final, `addEventListener('change', ...)` ejecuta el filtro cada vez que el
  usuario cambia el `<select>`.

---

## Conceptos nuevos

1. **GeoJSON y el orden `[lng, lat]`.** Estándar para formas en mapas. Leaflet usa
   `[lat, lng]`; GeoJSON al revés.
2. **CDN con versión fijada e `integrity`.** Usar librerías sin npm, de forma estable
   y segura.
3. **Mobile-first.** CSS base para celular; `@media (min-width)` agrega cambios para
   pantallas grandes.
4. **ES modules: `export` / `import`.** Cada archivo es privado salvo lo que exporta.
   Un módulo se ejecuta una sola vez.
5. **`fetch` + `async`/`await` + promesas.** Leer archivos sin congelar la página.
   `fetch` no falla con 404: hay que revisar `respuesta.ok`.
6. **`textContent` vs `innerHTML`.** Mostrar datos como texto evita ejecutar código
   ajeno (XSS).
7. **Fechas y zonas horarias.** `new Date("AAAA-MM-DD")` es UTC; en Guatemala
   resta un día.

---

## Cómo replicarlo tú

1. **Abre la carpeta en VS Code** (`code .` dentro de `carpool-zonas`).
2. **Crea los archivos de datos** en `web/data/`:
   - `zonas.geojson` y `puntos-encuentro.json`. Copia la estructura de arriba.
   - Revisa que el JSON sea válido:
     ```bash
     python -m json.tool web/data/zonas.geojson
     python -m json.tool web/data/puntos-encuentro.json
     ```
     Si imprime el contenido ordenado, está bien. Si dice `Expecting ',' delimiter:
     line 12`, te falta una coma en esa línea (o sobra una al final de una lista).
3. **Crea `web/app.html`, `web/css/estilos.css` y `web/js/mapa.js`.** Te recomiendo
   escribir `mapa.js` por partes, en el orden de los comentarios (1 a 8), probando en
   el navegador después de cada parte.
4. **(Pendiente) Dibuja las zonas reales:**
   1. Abre <https://geojson.io> y busca tu universidad.
   2. Con la herramienta de polígono (el pentágono a la derecha), dibuja cada zona.
      Doble clic para cerrar.
   3. Haz clic en cada zona y, en la tabla de propiedades, agrega `id`, `nombre`,
      `tipo` (`paso` o `encuentro`) y `esDemo` (`false` si es real).
   4. Copia el texto del panel derecho y reemplaza `web/data/zonas.geojson`.
   5. Actualiza los `zonaId` de `puntos-encuentro.json` para que coincidan.
5. **Commit:**
   ```bash
   git add -A
   git commit -m "Fase 2: mapa con zonas y puntos de encuentro"
   ```

---

## Cómo probarlo

1. En una terminal, dentro de `carpool-zonas`:
   ```bash
   python -m http.server 8000
   ```
   (En Windows, si no funciona: `py -m http.server 8000`.)
2. Abre <http://localhost:8000/web/app.html>.
3. Revisa:
   - [ ] Se ven 5 zonas: 2 **naranjas** (encuentro) y 3 **azules** (paso).
   - [ ] Se ven 4 círculos rojos (puntos de encuentro).
   - [ ] Al tocar un círculo: nombre, nota de seguridad, "Observado el 10 de octubre
         de 2026" (¡no el 9!) y la etiqueta amarilla **Dato de prueba**.
   - [ ] Al tocar una zona: su nombre, su tipo y **Dato de prueba**.
   - [ ] Filtro → "Zona Norte — ejemplo": solo queda esa zona y dice que no tiene
         puntos de encuentro.
   - [ ] Filtro → "Zona Este — ejemplo": 1 zona y 2 puntos.
   - [ ] Filtro → "Todas las zonas": vuelve todo.
4. **Consola** (F12 → pestaña *Console*): no debe haber errores rojos.
5. **Probar `resaltarPunto()`** desde la consola:
   ```js
   const m = await import('./js/mapa.js');
   m.resaltarPunto('punto-3');   // → true, el punto se pone morado y se abre su popup
   m.resaltarPunto('no-existe'); // → false y un aviso amarillo en la consola
   ```
6. **Celular y computadora:** en F12, presiona `Ctrl+Shift+M` (modo dispositivo) y  
   elige un ancho de **375px**: todo en una columna, sin scroll horizontal. Luego
   prueba **1440px**: perfil y coincidencias a la izquierda, mapa grande a la derecha.
7. **Prueba de error 1:** abre `app.html` con doble clic (`file://`). El mapa queda
   vacío y en la consola sale un error de **CORS**: el navegador ni siquiera carga
   `mapa.js` como módulo. Por eso siempre hay que usar `python -m http.server`.
8. **Prueba de error 2:** con el servidor corriendo, cambia temporalmente
   `RUTA_ZONAS` a `'data/zonas-mal.geojson'` y recarga. Debe salir el mensaje rojo
   del `catch`. Luego déjalo como estaba.
