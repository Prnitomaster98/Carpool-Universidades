// ==========================================================
// mapa.js — mapa de zonas y puntos de encuentro (Fase 2)
//
// Es un ES module: se carga con <script type="module"> en app.html.
// Leaflet NO se importa aquí: app.html lo carga antes con un <script>
// normal, y eso crea la variable global "L" que usamos abajo.
//
// Lo que hace este archivo:
//   1. Crea el mapa con fondo de OpenStreetMap.
//   2. Lee zonas.geojson y dibuja las zonas, con color según su tipo.
//   3. Lee puntos-encuentro.json y pone un marcador por punto, con popup.
//   4. Llena el filtro <select> y muestra solo la zona elegida.
//   5. EXPORTA resaltarPunto(puntoId), que usará la Fase 5.
// ==========================================================

// ---------- 1. Configuración ----------

// Centro del mapa: Ciudad de Guatemala. Leaflet usa el orden [latitud, longitud].
const CENTRO_INICIAL = [14.6349, -90.5069];
const ZOOM_INICIAL = 14; // 1 = el mundo entero, 19 = una calle muy de cerca

// Rutas de los datos. Son relativas a app.html (la página que carga este módulo).
const RUTA_ZONAS = 'data/zonas.geojson';
const RUTA_PUNTOS = 'data/puntos-encuentro.json';

// Colores por tipo de zona. Son los mismos que las variables del CSS.
const COLORES_ZONA = {
  encuentro: '#f97316', // naranja
  paso: '#2563eb',      // azul
};
const COLOR_PUNTO = '#b91c1c';      // rojo
const COLOR_RESALTADO = '#7c3aed';  // morado, para resaltarPunto()

// ---------- 2. Variables del módulo ----------
// Viven mientras la página esté abierta. Las guardamos para que el filtro
// y resaltarPunto() puedan encontrar las capas después.

let mapa = null;                    // el mapa de Leaflet
const capasZona = new Map();        // zonaId  -> capa (polígono) de esa zona
const marcadores = new Map();       // puntoId -> { marcador, punto }
let puntoResaltadoId = null;        // qué punto está resaltado ahora

// Referencias a elementos del HTML
const selectZona = document.getElementById('filtro-zona');
const mensaje = document.getElementById('mensaje-mapa');

// ---------- 3. Funciones de ayuda ----------

// Muestra un texto debajo del filtro. Si esError es true, se ve en rojo.
function mostrarMensaje(texto, esError = false) {
  mensaje.textContent = texto;
  mensaje.classList.toggle('error', esError);
}

// Descarga un archivo JSON. fetch() devuelve una "promesa": con await
// esperamos la respuesta sin congelar la página.
async function cargarJSON(ruta) {
  const respuesta = await fetch(ruta);
  // fetch NO da error si el archivo no existe (404); hay que revisarlo a mano.
  if (!respuesta.ok) {
    throw new Error(`No se pudo cargar ${ruta} (código ${respuesta.status})`);
  }
  return respuesta.json(); // convierte el texto JSON en objetos de JavaScript
}

// Convierte "2026-10-10" en "10 de octubre de 2026".
// OJO: new Date("2026-10-10") se interpreta como medianoche en hora UTC, y en
// Guatemala (UTC-6) eso es todavía el día 9. Por eso separamos año, mes y día
// y creamos la fecha en hora local.
function formatearFecha(textoFecha) {
  const [anio, mes, dia] = textoFecha.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia); // en JavaScript los meses van de 0 a 11
  return fecha.toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Crea la etiqueta amarilla "Dato de prueba".
function crearEtiquetaDemo() {
  const etiqueta = document.createElement('span');
  etiqueta.className = 'etiqueta-demo';
  etiqueta.textContent = 'Dato de prueba';
  return etiqueta;
}

// Crea un <p> con una clase y un texto.
// Usamos textContent (y NO innerHTML) para que, si un dato trae algo como
// "<script>", se muestre como texto y nunca se ejecute como código.
function crearParrafo(clase, texto) {
  const p = document.createElement('p');
  p.className = clase;
  p.textContent = texto;
  return p;
}

// Arma el contenido del popup de un punto de encuentro.
function crearPopupPunto(punto) {
  const caja = document.createElement('div');
  caja.append(
    crearParrafo('popup-titulo', punto.nombre),
    crearParrafo('popup-texto', `🛡️ ${punto.notaSeguridad}`),
    crearParrafo('popup-fecha', `Observado el ${formatearFecha(punto.fechaObservacion)}`),
  );
  if (punto.esDemo) {
    caja.append(crearEtiquetaDemo());
  }
  return caja;
}

// Arma el contenido del popup de una zona.
function crearPopupZona(propiedades) {
  const caja = document.createElement('div');
  const tipoLegible = propiedades.tipo === 'encuentro' ? 'Zona de encuentro' : 'Zona de paso';
  caja.append(
    crearParrafo('popup-titulo', propiedades.nombre),
    crearParrafo('popup-texto', tipoLegible),
  );
  if (propiedades.esDemo) {
    caja.append(crearEtiquetaDemo());
  }
  return caja;
}

// Estilo normal de un marcador de punto (círculo rojo).
function estiloPuntoNormal() {
  return { radius: 10, color: '#ffffff', weight: 2, fillColor: COLOR_PUNTO, fillOpacity: 0.95 };
}

// ---------- 4. Dibujar las zonas ----------

function dibujarZonas(geojson) {
  // L.geoJSON convierte el GeoJSON en capas de Leaflet.
  const capaGeoJSON = L.geoJSON(geojson, {
    // style se llama una vez por zona y decide su color según el tipo.
    style: (feature) => {
      const color = COLORES_ZONA[feature.properties.tipo] ?? '#6b7280'; // gris si el tipo es raro
      return { color, weight: 2, fillColor: color, fillOpacity: 0.25 };
    },
    // onEachFeature también se llama una vez por zona: guardamos la capa y le
    // ponemos su popup.
    onEachFeature: (feature, capa) => {
      capasZona.set(feature.properties.id, capa);
      capa.bindPopup(crearPopupZona(feature.properties));
    },
  });

  capaGeoJSON.addTo(mapa);
  // Ajusta la vista para que se vean todas las zonas
  mapa.fitBounds(capaGeoJSON.getBounds(), { padding: [20, 20] });

  // Llenar el <select> con una opción por zona
  for (const feature of geojson.features) {
    const opcion = document.createElement('option');
    opcion.value = feature.properties.id;
    opcion.textContent = feature.properties.nombre;
    selectZona.append(opcion);
  }
}

// ---------- 5. Dibujar los puntos de encuentro ----------

function dibujarPuntos(puntos) {
  for (const punto of puntos) {
    // circleMarker es un círculo que mantiene su tamaño en pantalla al hacer zoom.
    const marcador = L.circleMarker([punto.lat, punto.lng], estiloPuntoNormal());
    marcador.bindPopup(crearPopupPunto(punto));
    marcador.addTo(mapa);
    marcadores.set(punto.id, { marcador, punto });
  }
}

// ---------- 6. Filtro por zona ----------

// Muestra solo la zona elegida y sus puntos ("todas" = mostrar todo).
function aplicarFiltro(zonaId) {
  // Zonas: agregar o quitar cada polígono del mapa
  for (const [id, capa] of capasZona) {
    const visible = zonaId === 'todas' || id === zonaId;
    if (visible) capa.addTo(mapa);
    else capa.remove();
  }

  // Puntos: igual, según la zona a la que pertenecen
  let puntosVisibles = 0;
  for (const { marcador, punto } of marcadores.values()) {
    const visible = zonaId === 'todas' || punto.zonaId === zonaId;
    if (visible) {
      marcador.addTo(mapa);
      puntosVisibles++;
    } else {
      marcador.remove();
    }
  }

  // Mover la cámara a lo que quedó visible
  if (zonaId === 'todas') {
    const grupo = L.featureGroup([...capasZona.values()]);
    mapa.fitBounds(grupo.getBounds(), { padding: [20, 20] });
  } else if (capasZona.has(zonaId)) {
    mapa.fitBounds(capasZona.get(zonaId).getBounds(), { padding: [20, 20] });
  }

  // Mensaje para el usuario
  if (puntosVisibles === 0) {
    mostrarMensaje('Esta zona es de paso: no tiene puntos de encuentro.');
  } else {
    mostrarMensaje(`${puntosVisibles} punto(s) de encuentro visibles.`);
  }
}

// ---------- 7. Función exportada para la Fase 5 ----------

/**
 * Resalta un punto de encuentro en el mapa: lo pinta de morado, lo agranda,
 * centra la cámara en él y abre su popup.
 * Ejemplo de uso en otro módulo:
 *   import { resaltarPunto } from './mapa.js';
 *   resaltarPunto('punto-3');
 * @param {string} puntoId - el "id" del punto en puntos-encuentro.json
 * @returns {boolean} true si lo encontró, false si no existe o el mapa no ha cargado
 */
export function resaltarPunto(puntoId) {
  const encontrado = marcadores.get(puntoId);
  if (!mapa || !encontrado) {
    console.warn(`resaltarPunto: no encontré el punto "${puntoId}"`);
    return false;
  }

  // 1) Quitar el resaltado del punto anterior, si había uno
  if (puntoResaltadoId && marcadores.has(puntoResaltadoId)) {
    marcadores.get(puntoResaltadoId).marcador.setStyle(estiloPuntoNormal());
  }

  // 2) Si el filtro está ocultando ese punto, cambiar el filtro a su zona
  const { marcador, punto } = encontrado;
  if (selectZona.value !== 'todas' && selectZona.value !== punto.zonaId) {
    selectZona.value = punto.zonaId;
    aplicarFiltro(punto.zonaId);
  }

  // 3) Resaltar, traer al frente, centrar y abrir el popup
  marcador.setStyle({ radius: 14, fillColor: COLOR_RESALTADO, color: '#ffffff', weight: 3 });
  marcador.bringToFront();
  mapa.setView([punto.lat, punto.lng], Math.max(mapa.getZoom(), 16));
  marcador.openPopup();

  puntoResaltadoId = puntoId;
  return true;
}

// ---------- 8. Arranque ----------

async function iniciarMapa() {
  // Si Leaflet no cargó (sin internet, CDN bloqueada), "L" no existe.
  if (typeof L === 'undefined') {
    mostrarMensaje('No se pudo cargar la librería del mapa. Revisa tu conexión a internet.', true);
    return;
  }

  // Crear el mapa dentro de <div id="mapa">
  mapa = L.map('mapa').setView(CENTRO_INICIAL, ZOOM_INICIAL);

  // Capa de fondo: imágenes ("tiles") de OpenStreetMap. No necesita clave de API.
  // La atribución (el texto abajo a la derecha) es OBLIGATORIA por la licencia de OSM.
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);

  try {
    // Promise.all descarga los dos archivos al mismo tiempo y espera a ambos.
    const [zonas, puntos] = await Promise.all([cargarJSON(RUTA_ZONAS), cargarJSON(RUTA_PUNTOS)]);
    dibujarZonas(zonas);
    dibujarPuntos(puntos);

    const hayDemo = zonas.features.some((f) => f.properties.esDemo) || puntos.some((p) => p.esDemo);
    mostrarMensaje(hayDemo
      ? 'Las zonas y puntos actuales son datos de prueba.'
      : `${puntos.length} punto(s) de encuentro.`);
  } catch (error) {
    console.error(error);
    mostrarMensaje(
      'No se pudieron cargar las zonas o los puntos. Revisa que los archivos existan ' +
      'en web/data/ y que el JSON no tenga errores (python -m json.tool).',
      true,
    );
    return;
  }

  // Cuando el usuario cambie el <select>, aplicar el filtro
  selectZona.addEventListener('change', () => aplicarFiltro(selectZona.value));
}

iniciarMapa();
