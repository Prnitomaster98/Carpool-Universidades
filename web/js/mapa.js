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
//   5. EXPORTA resaltarPunto(idPuntoBuscado), que usará la Fase 5.
//
// ==========================================================
// GUÍA DE NOMBRES DE VARIABLES (mapa.js)
// ==========================================================
// En JavaScript se acostumbra escribir los nombres "pegados" con mayúscula
// en cada palabra nueva (camelCase): nombrePerfilActual. Las constantes de
// configuración van en MAYÚSCULAS con guion bajo: COLOR_PUNTO_NORMAL.
//
// --- Configuración (constantes) ---
// COORDENADAS_CENTRO_INICIAL_MAPA  [latitud, longitud] donde arranca el mapa
//                                  (Ciudad de Guatemala).
// NIVEL_ACERCAMIENTO_INICIAL       Zoom al abrir: 1 = mundo, 19 = una calle.
// RUTA_ARCHIVO_ZONAS               Dónde está zonas.geojson (relativo a app.html).
// RUTA_ARCHIVO_PUNTOS_ENCUENTRO    Dónde está puntos-encuentro.json.
// COLORES_POR_TIPO_DE_ZONA         tipo de zona ("encuentro"/"paso") → color.
//                                  Deben coincidir con las variables del CSS.
// COLOR_ZONA_TIPO_DESCONOCIDO      Gris para una zona con un tipo no esperado.
// COLOR_PUNTO_NORMAL               Rojo de los puntos de encuentro.
// COLOR_PUNTO_RESALTADO            Morado del punto que marca resaltarPunto().
// DESTINO_UNIVERSIDAD              Nombre y [lat, lng] de la UVG (destino de los viajes).
// COLOR_DESTINO                    Color del marcador de la UVG.
//
// --- Nuevos con las rutas reales ---
// listaLeyendaRutas          El <ul id="leyenda-rutas"> que se llena solo.
// colorDeZona()              Color de una ruta: su "color" del GeoJSON o el de su tipo.
// muestraColor               El cuadrito de color de la leyenda.
// marcadorDestino            El círculo negro de la UVG.
// hayZonasAproximadas        true si alguna ruta tiene esAproximada: true.
// avisos                     Lista de avisos que se juntan en un solo mensaje.
//
// --- Estado del módulo (viven mientras la página está abierta) ---
// mapaDeZonas                El mapa de Leaflet. Empieza en null hasta que
//                            iniciarMapa() lo crea; por eso resaltarPunto()
//                            revisa que exista antes de usarlo.
// capasPorIdZona             Map: id de zona → capa (polígono) de esa zona.
//                            Permite mostrar/ocultar una zona al instante.
// marcadoresPorIdPunto       Map: id de punto → { marcadorPunto, puntoEncuentro }.
//                            Permite encontrar un punto sin recorrer todo.
// idPuntoResaltadoActual     Qué punto está morado ahora (o null). Sirve para
//                            regresarlo a rojo cuando se resalta otro.
// selectorFiltroZona         El <select id="filtro-zona"> del HTML.
// parrafoMensajeMapa         El <p id="mensaje-mapa"> donde se escriben avisos.
//
// --- Parámetros y variables dentro de las funciones ---
// textoMensaje / esMensajeDeError   Qué mostrar y si se pinta en rojo.
// rutaArchivo                Ruta del JSON a descargar.
// respuestaServidor          Lo que devolvió fetch() (incluye .ok y .status).
// textoFecha                 Fecha "AAAA-MM-DD" tal como viene en el JSON.
// numeroAnio / numeroMes / numeroDia   Las partes de esa fecha como números.
// fechaLocal                 Objeto Date creado en la hora de Guatemala.
// etiquetaDatoPrueba         El <span> amarillo "Dato de prueba".
// claseCss / textoParrafo    Clase y texto del <p> que crea crearParrafo().
// parrafoNuevo               Ese <p> recién creado.
// puntoEncuentro             Un punto de puntos-encuentro.json (nombre, lat, lng...).
// contenedorPopup            El <div> que se muestra dentro del popup.
// propiedadesZona            El bloque "properties" de una zona del GeoJSON.
// tipoZonaLegible            "Zona de encuentro" o "Zona de paso" (para leer).
// datosGeoJSONZonas          Todo el contenido de zonas.geojson.
// capaTodasLasZonas          La capa de Leaflet con todos los polígonos.
// zonaGeoJSON                Una zona ("feature") del GeoJSON.
// colorZona                  Color que le toca a esa zona según su tipo.
// capaZona                   El polígono de Leaflet de una zona.
// opcionSelector             Una <option> nueva del filtro.
// listaPuntosEncuentro       Todo el contenido de puntos-encuentro.json.
// marcadorPunto              El círculo de Leaflet de un punto.
// idZonaElegida              La zona elegida en el filtro ("todas" = todas).
// idZona                     El id de una zona mientras se recorren.
// zonaEsVisible / puntoEsVisible   Si esa zona o ese punto debe verse.
// cantidadPuntosVisibles     Cuántos puntos quedaron visibles tras filtrar.
// grupoTodasLasZonas         Todas las capas juntas, para encuadrar la cámara.
// idPuntoBuscado             El id que recibe resaltarPunto() ("punto-3").
// registroPuntoEncontrado    Lo que se encontró en marcadoresPorIdPunto (o undefined).
// hayDatosDePrueba           true si alguna zona o punto tiene esDemo: true.
// errorDeCarga               El error que ocurrió al descargar los archivos.
//
// --- Nombres que NO se cambiaron (y por qué) ---
// L                          Variable global que crea la librería Leaflet.
// resaltarPunto              Función EXPORTADA: la Fase 5 la importa con este nombre.
// lat, lng, zonaId, nombre, notaSeguridad, fechaObservacion, esDemo, tipo, id
//                            Son campos de los archivos JSON/GeoJSON. Si se
//                            cambian aquí, hay que cambiarlos también en los datos.
// radius, color, weight, fillColor, fillOpacity, style, onEachFeature...
//                            Son opciones de Leaflet: la librería solo entiende
//                            esos nombres en inglés.
// ==========================================================

// ---------- 1. Configuración ----------

// Centro del mapa: Ciudad de Guatemala. Leaflet usa el orden [latitud, longitud].
const COORDENADAS_CENTRO_INICIAL_MAPA = [14.6349, -90.5069];
const NIVEL_ACERCAMIENTO_INICIAL = 14; // 1 = el mundo entero, 19 = una calle muy de cerca

// Rutas de los datos. Son relativas a app.html (la página que carga este módulo).
const RUTA_ARCHIVO_ZONAS = 'data/zonas.geojson';
const RUTA_ARCHIVO_PUNTOS_ENCUENTRO = 'data/puntos-encuentro.json';

// Colores por tipo de zona. Son los mismos que las variables del CSS.
const COLORES_POR_TIPO_DE_ZONA = {
  encuentro: '#f97316', // naranja
  paso: '#2563eb',      // azul
};
const COLOR_ZONA_TIPO_DESCONOCIDO = '#6b7280'; // gris
const COLOR_PUNTO_NORMAL = '#b91c1c';          // rojo
const COLOR_PUNTO_RESALTADO = '#7c3aed';       // morado, para resaltarPunto()

// Destino de todos los viajes: UVG Campus Central (18 Avenida 11-95, zona 15).
// No es un punto de encuentro: se dibuja aparte y no entra en el filtro.
const DESTINO_UNIVERSIDAD = {
  nombre: 'UVG — Campus Central',
  lat: 14.6049,
  lng: -90.4891,
};
const COLOR_DESTINO = '#111827';               // casi negro, para que resalte

// ---------- 2. Variables del módulo ----------
// Viven mientras la página esté abierta. Las guardamos para que el filtro
// y resaltarPunto() puedan encontrar las capas después.

let mapaDeZonas = null;                       // el mapa de Leaflet
const capasPorIdZona = new Map();             // idZona  -> capa (polígono) de esa zona
const marcadoresPorIdPunto = new Map();       // idPunto -> { marcadorPunto, puntoEncuentro }
let idPuntoResaltadoActual = null;            // qué punto está resaltado ahora

// Referencias a elementos del HTML
const selectorFiltroZona = document.getElementById('filtro-zona');
const parrafoMensajeMapa = document.getElementById('mensaje-mapa');
const listaLeyendaRutas = document.getElementById('leyenda-rutas');

// ---------- 3. Funciones de ayuda ----------

// Muestra un texto debajo del filtro. Si esMensajeDeError es true, se ve en rojo.
function mostrarMensaje(textoMensaje, esMensajeDeError = false) {
  parrafoMensajeMapa.textContent = textoMensaje;
  parrafoMensajeMapa.classList.toggle('error', esMensajeDeError);
}

// Descarga un archivo JSON. fetch() devuelve una "promesa": con await
// esperamos la respuesta sin congelar la página.
async function cargarJSON(rutaArchivo) {
  const respuestaServidor = await fetch(rutaArchivo);
  // fetch NO da error si el archivo no existe (404); hay que revisarlo a mano.
  if (!respuestaServidor.ok) {
    throw new Error(`No se pudo cargar ${rutaArchivo} (código ${respuestaServidor.status})`);
  }
  return respuestaServidor.json(); // convierte el texto JSON en objetos de JavaScript
}

// Convierte "2026-10-10" en "10 de octubre de 2026".
// OJO: new Date("2026-10-10") se interpreta como medianoche en hora UTC, y en
// Guatemala (UTC-6) eso es todavía el día 9. Por eso separamos año, mes y día
// y creamos la fecha en hora local.
function formatearFecha(textoFecha) {
  const [numeroAnio, numeroMes, numeroDia] = textoFecha.split('-').map(Number);
  // en JavaScript los meses van de 0 a 11
  const fechaLocal = new Date(numeroAnio, numeroMes - 1, numeroDia);
  return fechaLocal.toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Crea la etiqueta amarilla "Dato de prueba".
function crearEtiquetaDemo() {
  const etiquetaDatoPrueba = document.createElement('span');
  etiquetaDatoPrueba.className = 'etiqueta-demo';
  etiquetaDatoPrueba.textContent = 'Dato de prueba';
  return etiquetaDatoPrueba;
}

// Crea un <p> con una clase y un texto.
// Usamos textContent (y NO innerHTML) para que, si un dato trae algo como
// "<script>", se muestre como texto y nunca se ejecute como código.
function crearParrafo(claseCss, textoParrafo) {
  const parrafoNuevo = document.createElement('p');
  parrafoNuevo.className = claseCss;
  parrafoNuevo.textContent = textoParrafo;
  return parrafoNuevo;
}

// Arma el contenido del popup de un punto de encuentro.
function crearPopupPunto(puntoEncuentro) {
  const contenedorPopup = document.createElement('div');
  contenedorPopup.append(
    crearParrafo('popup-titulo', puntoEncuentro.nombre),
    crearParrafo('popup-texto', `🛡️ ${puntoEncuentro.notaSeguridad}`),
  );
  // La fecha solo aparece cuando alguien del equipo ya visitó el lugar.
  // Un punto "por definir" no tiene fecha, y no hay que inventarle una.
  if (puntoEncuentro.fechaObservacion) {
    contenedorPopup.append(
      crearParrafo('popup-fecha', `Observado el ${formatearFecha(puntoEncuentro.fechaObservacion)}`),
    );
  }
  if (puntoEncuentro.esDemo) {
    contenedorPopup.append(crearEtiquetaDemo());
  }
  return contenedorPopup;
}

// Arma el contenido del popup de una zona.
function crearPopupZona(propiedadesZona) {
  const contenedorPopup = document.createElement('div');
  const tipoZonaLegible = propiedadesZona.tipo === 'encuentro' ? 'Zona de encuentro' : 'Zona de paso';
  contenedorPopup.append(
    crearParrafo('popup-titulo', propiedadesZona.nombre),
    crearParrafo('popup-texto', tipoZonaLegible),
  );
  if (propiedadesZona.esAproximada) {
    contenedorPopup.append(crearParrafo('popup-fecha', 'Límites aproximados'));
  }
  if (propiedadesZona.esDemo) {
    contenedorPopup.append(crearEtiquetaDemo());
  }
  return contenedorPopup;
}

// Estilo normal de un marcador de punto (círculo rojo).
function estiloPuntoNormal() {
  return { radius: 10, color: '#ffffff', weight: 2, fillColor: COLOR_PUNTO_NORMAL, fillOpacity: 0.95 };
}

// ---------- 4. Dibujar las zonas ----------

function dibujarZonas(datosGeoJSONZonas) {
  // L.geoJSON convierte el GeoJSON en capas de Leaflet.
  const capaTodasLasZonas = L.geoJSON(datosGeoJSONZonas, {
    // style se llama una vez por zona y decide su color según el tipo.
    style: (zonaGeoJSON) => ({
      color: colorDeZona(zonaGeoJSON.properties),
      weight: 2,
      fillColor: colorDeZona(zonaGeoJSON.properties),
      fillOpacity: 0.25,
    }),
    // onEachFeature también se llama una vez por zona: guardamos la capa y le
    // ponemos su popup.
    onEachFeature: (zonaGeoJSON, capaZona) => {
      capasPorIdZona.set(zonaGeoJSON.properties.id, capaZona);
      capaZona.bindPopup(crearPopupZona(zonaGeoJSON.properties));
    },
  });

  capaTodasLasZonas.addTo(mapaDeZonas);
  // Ajusta la vista para que se vean todas las zonas
  mapaDeZonas.fitBounds(capaTodasLasZonas.getBounds(), { padding: [20, 20] });

  // Llenar el <select> con una opción por zona
  for (const zonaGeoJSON of datosGeoJSONZonas.features) {
    const opcionSelector = document.createElement('option');
    opcionSelector.value = zonaGeoJSON.properties.id;
    opcionSelector.textContent = zonaGeoJSON.properties.nombre;
    selectorFiltroZona.append(opcionSelector);
  }

  dibujarLeyendaRutas(datosGeoJSONZonas);
}

// Cada ruta trae su propio color en el GeoJSON ("color": "#7c3aed").
// Si una zona no lo trae, usamos el color de su tipo, como antes.
function colorDeZona(propiedadesZona) {
  return propiedadesZona.color
    ?? COLORES_POR_TIPO_DE_ZONA[propiedadesZona.tipo]
    ?? COLOR_ZONA_TIPO_DESCONOCIDO;
}

// Escribe la leyenda de rutas leyendo el GeoJSON: si mañana agregan una
// sexta ruta, aparece sola en la leyenda sin tocar el HTML.
function dibujarLeyendaRutas(datosGeoJSONZonas) {
  if (!listaLeyendaRutas) return; // por si app.html no tiene la leyenda
  listaLeyendaRutas.replaceChildren();
  for (const zonaGeoJSON of datosGeoJSONZonas.features) {
    const elementoLeyenda = document.createElement('li');
    const muestraColor = document.createElement('span');
    muestraColor.className = 'muestra muestra-ruta';
    muestraColor.style.backgroundColor = colorDeZona(zonaGeoJSON.properties);
    elementoLeyenda.append(muestraColor, zonaGeoJSON.properties.nombre);
    listaLeyendaRutas.append(elementoLeyenda);
  }
}

// ---------- 4b. Dibujar el destino (la universidad) ----------

function dibujarDestino() {
  const marcadorDestino = L.circleMarker([DESTINO_UNIVERSIDAD.lat, DESTINO_UNIVERSIDAD.lng], {
    radius: 12, color: '#ffffff', weight: 3, fillColor: COLOR_DESTINO, fillOpacity: 1,
  });
  const contenedorPopup = document.createElement('div');
  contenedorPopup.append(
    crearParrafo('popup-titulo', `🎓 ${DESTINO_UNIVERSIDAD.nombre}`),
    crearParrafo('popup-texto', 'Destino de todos los viajes'),
  );
  marcadorDestino.bindPopup(contenedorPopup);
  marcadorDestino.addTo(mapaDeZonas);
}

// ---------- 5. Dibujar los puntos de encuentro ----------

function dibujarPuntos(listaPuntosEncuentro) {
  for (const puntoEncuentro of listaPuntosEncuentro) {
    // circleMarker es un círculo que mantiene su tamaño en pantalla al hacer zoom.
    const marcadorPunto = L.circleMarker([puntoEncuentro.lat, puntoEncuentro.lng], estiloPuntoNormal());
    marcadorPunto.bindPopup(crearPopupPunto(puntoEncuentro));
    marcadorPunto.addTo(mapaDeZonas);
    marcadoresPorIdPunto.set(puntoEncuentro.id, { marcadorPunto, puntoEncuentro });
  }
}

// ---------- 6. Filtro por zona ----------

// Muestra solo la zona elegida y sus puntos ("todas" = mostrar todo).
function aplicarFiltro(idZonaElegida) {
  // Zonas: agregar o quitar cada polígono del mapa
  for (const [idZona, capaZona] of capasPorIdZona) {
    const zonaEsVisible = idZonaElegida === 'todas' || idZona === idZonaElegida;
    if (zonaEsVisible) capaZona.addTo(mapaDeZonas);
    else capaZona.remove();
  }

  // Puntos: igual, según la zona a la que pertenecen
  let cantidadPuntosVisibles = 0;
  for (const { marcadorPunto, puntoEncuentro } of marcadoresPorIdPunto.values()) {
    const puntoEsVisible = idZonaElegida === 'todas' || puntoEncuentro.zonaId === idZonaElegida;
    if (puntoEsVisible) {
      marcadorPunto.addTo(mapaDeZonas);
      cantidadPuntosVisibles++;
    } else {
      marcadorPunto.remove();
    }
  }

  // Mover la cámara a lo que quedó visible
  if (idZonaElegida === 'todas') {
    const grupoTodasLasZonas = L.featureGroup([...capasPorIdZona.values()]);
    mapaDeZonas.fitBounds(grupoTodasLasZonas.getBounds(), { padding: [20, 20] });
  } else if (capasPorIdZona.has(idZonaElegida)) {
    mapaDeZonas.fitBounds(capasPorIdZona.get(idZonaElegida).getBounds(), { padding: [20, 20] });
  }

  // Mensaje para el usuario
  if (cantidadPuntosVisibles === 0) {
    mostrarMensaje('Esta zona es de paso: no tiene puntos de encuentro.');
  } else {
    mostrarMensaje(`${cantidadPuntosVisibles} punto(s) de encuentro visibles.`);
  }
}

// ---------- 7. Función exportada para la Fase 5 ----------

/**
 * Resalta un punto de encuentro en el mapa: lo pinta de morado, lo agranda,
 * centra la cámara en él y abre su popup.
 * Ejemplo de uso en otro módulo:
 *   import { resaltarPunto } from './mapa.js';
 *   resaltarPunto('punto-3');
 * @param {string} idPuntoBuscado - el "id" del punto en puntos-encuentro.json
 * @returns {boolean} true si lo encontró, false si no existe o el mapa no ha cargado
 */
export function resaltarPunto(idPuntoBuscado) {
  const registroPuntoEncontrado = marcadoresPorIdPunto.get(idPuntoBuscado);
  if (!mapaDeZonas || !registroPuntoEncontrado) {
    console.warn(`resaltarPunto: no encontré el punto "${idPuntoBuscado}"`);
    return false;
  }

  // 1) Quitar el resaltado del punto anterior, si había uno
  if (idPuntoResaltadoActual && marcadoresPorIdPunto.has(idPuntoResaltadoActual)) {
    marcadoresPorIdPunto.get(idPuntoResaltadoActual).marcadorPunto.setStyle(estiloPuntoNormal());
  }

  // 2) Si el filtro está ocultando ese punto, cambiar el filtro a su zona
  const { marcadorPunto, puntoEncuentro } = registroPuntoEncontrado;
  if (selectorFiltroZona.value !== 'todas' && selectorFiltroZona.value !== puntoEncuentro.zonaId) {
    selectorFiltroZona.value = puntoEncuentro.zonaId;
    aplicarFiltro(puntoEncuentro.zonaId);
  }

  // 3) Resaltar, traer al frente, centrar y abrir el popup
  marcadorPunto.setStyle({ radius: 14, fillColor: COLOR_PUNTO_RESALTADO, color: '#ffffff', weight: 3 });
  marcadorPunto.bringToFront();
  mapaDeZonas.setView([puntoEncuentro.lat, puntoEncuentro.lng], Math.max(mapaDeZonas.getZoom(), 16));
  marcadorPunto.openPopup();

  idPuntoResaltadoActual = idPuntoBuscado;
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
  mapaDeZonas = L.map('mapa').setView(COORDENADAS_CENTRO_INICIAL_MAPA, NIVEL_ACERCAMIENTO_INICIAL);

  // Capa de fondo: imágenes ("tiles") de OpenStreetMap. No necesita clave de API.
  // La atribución (el texto abajo a la derecha) es OBLIGATORIA por la licencia de OSM.
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapaDeZonas);

  try {
    // Promise.all descarga los dos archivos al mismo tiempo y espera a ambos.
    const [datosGeoJSONZonas, listaPuntosEncuentro] = await Promise.all([
      cargarJSON(RUTA_ARCHIVO_ZONAS),
      cargarJSON(RUTA_ARCHIVO_PUNTOS_ENCUENTRO),
    ]);
    dibujarZonas(datosGeoJSONZonas);
    dibujarPuntos(listaPuntosEncuentro);
    dibujarDestino();

    const hayDatosDePrueba =
      datosGeoJSONZonas.features.some((zonaGeoJSON) => zonaGeoJSON.properties.esDemo) ||
      listaPuntosEncuentro.some((puntoEncuentro) => puntoEncuentro.esDemo);
    const hayZonasAproximadas =
      datosGeoJSONZonas.features.some((zonaGeoJSON) => zonaGeoJSON.properties.esAproximada);
    const avisos = [];
    if (hayZonasAproximadas) avisos.push('Los límites de las rutas son aproximados.');
    if (hayDatosDePrueba) avisos.push('Los puntos de encuentro todavía son de prueba.');
    mostrarMensaje(avisos.length
      ? avisos.join(' ')
      : `${listaPuntosEncuentro.length} punto(s) de encuentro.`);
  } catch (errorDeCarga) {
    console.error(errorDeCarga);
    mostrarMensaje(
      'No se pudieron cargar las zonas o los puntos. Revisa que los archivos existan ' +
      'en web/data/ y que el JSON no tenga errores (python -m json.tool).',
      true,
    );
    return;
  }

  // Cuando el usuario cambie el <select>, aplicar el filtro
  selectorFiltroZona.addEventListener('change', () => aplicarFiltro(selectorFiltroZona.value));
}

iniciarMapa();
