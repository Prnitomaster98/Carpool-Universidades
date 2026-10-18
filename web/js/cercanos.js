// ==========================================================
// cercanos.js — "¿Cuál punto de encuentro me queda más cerca?"
//
// 1. El usuario da su ubicación de dos formas:
//      a) botón "Usar mi ubicación actual" (GPS del navegador), o
//      b) botón "Marcar mi casa en el mapa" y luego un clic en el mapa.
// 2. Con recomendacion.js medimos la distancia a TODOS los puntos,
//    sin importar en qué ruta pintada esté el usuario.
// 3. Mostramos el más cercano como "Recomendado" y 2 alternativas,
//    cada una con su distancia. Al tocar una, se marca en el mapa.
//
// Privacidad: la ubicación solo se usa aquí, en el navegador.
//    No se guarda en Firebase ni en ningún archivo, y desaparece al
//    cerrar o recargar la página.
// ==========================================================
// GUÍA DE NOMBRES
// COLOR_USUARIO               Azul del círculo "Tú estás aquí".
// botonMiUbicacion / botonMarcarEnMapa   Los dos botones del HTML.
// listaCercanos               El <ol> donde se escriben las 3 opciones.
// parrafoMensajeCercanos      El <p> con avisos ("Buscando tu ubicación…").
// mapa / puntos / nombresDeRutas   Lo que manda mapa.js cuando termina de cargar.
// origenUsuario               { lat, lng } de la casa o ubicación del usuario.
// marcadorUsuario             El círculo azul en el mapa.
// lineaHastaPunto             La línea punteada del usuario al punto elegido.
// recomendaciones             Los 3 puntos más cercanos (con distanciaKm).
// esperandoClicEnMapa         true mientras el usuario está eligiendo su casa.
// posicionGPS                 Lo que devuelve el navegador (coords.latitude...).
// ==========================================================

import { mapaListo, resaltarPunto } from './mapa.js';
import { puntosMasCercanos, formatearDistancia } from './recomendacion.js';

const COLOR_USUARIO = '#2563eb';
const DISTANCIA_LEJANA_KM = 8; // más que esto: avisar que ningún punto le queda cerca

const botonMiUbicacion = document.getElementById('boton-mi-ubicacion');
const botonMarcarEnMapa = document.getElementById('boton-marcar-en-mapa');
const listaCercanos = document.getElementById('lista-cercanos');
const parrafoMensajeCercanos = document.getElementById('mensaje-cercanos');

let mapa = null;
let puntos = [];
let nombresDeRutas = new Map();
let marcadorUsuario = null;
let lineaHastaPunto = null;
let esperandoClicEnMapa = false;

function mostrarMensajeCercanos(texto, esError = false) {
  parrafoMensajeCercanos.textContent = texto;
  parrafoMensajeCercanos.classList.toggle('error', esError);
}

// ---------- 1. Dibujar al usuario y la línea ----------

function dibujarUsuario(origenUsuario) {
  if (marcadorUsuario) marcadorUsuario.remove(); // quitar el anterior
  marcadorUsuario = L.circleMarker([origenUsuario.lat, origenUsuario.lng], {
    radius: 9, color: '#ffffff', weight: 3, fillColor: COLOR_USUARIO, fillOpacity: 1,
  })
    .bindTooltip('Tú', { permanent: true, direction: 'top', offset: [0, -10] })
    .addTo(mapa);
}

function dibujarLinea(origenUsuario, punto) {
  if (lineaHastaPunto) lineaHastaPunto.remove();
  lineaHastaPunto = L.polyline(
    [[origenUsuario.lat, origenUsuario.lng], [punto.lat, punto.lng]],
    { color: COLOR_USUARIO, weight: 3, dashArray: '6 8' }, // dashArray = línea punteada
  ).addTo(mapa);
}

// ---------- 2. Escribir la lista de 3 opciones ----------

function crearElemento(etiqueta, claseCss, texto) {
  const elemento = document.createElement(etiqueta);
  if (claseCss) elemento.className = claseCss;
  if (texto) elemento.textContent = texto; // textContent: nunca se ejecuta como código
  return elemento;
}

// Marca una opción como elegida: línea, resaltado en el mapa y estilo en la lista
function elegirPunto(origenUsuario, punto, elementoLista) {
  dibujarLinea(origenUsuario, punto);
  resaltarPunto(punto.id);
  // Encuadrar al usuario y al punto juntos (no solo el punto)
  mapa.fitBounds(L.latLngBounds([[origenUsuario.lat, origenUsuario.lng], [punto.lat, punto.lng]]), {
    padding: [40, 40], maxZoom: 15,
  });
  for (const otro of listaCercanos.children) otro.classList.remove('elegido');
  elementoLista.classList.add('elegido');
}

function mostrarRecomendaciones(origenUsuario) {
  const recomendaciones = puntosMasCercanos(origenUsuario, puntos);
  listaCercanos.replaceChildren(); // vaciar la lista anterior
  if (recomendaciones.length === 0) {
    mostrarMensajeCercanos('Todavía no hay puntos de encuentro cargados.', true);
    return;
  }

  recomendaciones.forEach((punto, posicion) => {
    const elementoLista = crearElemento('li', 'opcion-cercana');
    const botonOpcion = crearElemento('button', 'opcion-boton');
    botonOpcion.type = 'button';

    const etiqueta = posicion === 0 ? 'Recomendado' : `Alternativa ${posicion}`;
    const filaSuperior = crearElemento('span', 'opcion-fila');
    filaSuperior.append(
      crearElemento('span', posicion === 0 ? 'opcion-etiqueta principal' : 'opcion-etiqueta', etiqueta),
      crearElemento('span', 'opcion-distancia', formatearDistancia(punto.distanciaKm)),
    );
    botonOpcion.append(
      filaSuperior,
      crearElemento('span', 'opcion-nombre', punto.nombre),
      crearElemento('span', 'opcion-ruta', nombresDeRutas.get(punto.zonaId) ?? ''),
    );
    if (punto.nivel === 'precaucion') {
      botonOpcion.append(crearElemento('span', 'opcion-aviso', 'Usar con precaución'));
    }

    botonOpcion.addEventListener('click', () => elegirPunto(origenUsuario, punto, elementoLista));
    elementoLista.append(botonOpcion);
    listaCercanos.append(elementoLista);
  });

  // Elegir automáticamente el más cercano
  elegirPunto(origenUsuario, recomendaciones[0], listaCercanos.firstElementChild);

  if (recomendaciones[0].distanciaKm > DISTANCIA_LEJANA_KM) {
    mostrarMensajeCercanos(
      `El punto más cercano está a ${formatearDistancia(recomendaciones[0].distanciaKm)}. ` +
      'Todavía no hay puntos cerca de tu ubicación.',
    );
  } else {
    mostrarMensajeCercanos('Distancias en línea recta desde tu ubicación (por calle puede ser más).');
  }
}

// Todo lo que pasa cuando ya sabemos dónde está el usuario
function usarOrigen(origenUsuario) {
  dibujarUsuario(origenUsuario);
  mostrarRecomendaciones(origenUsuario);
}

// ---------- 3. Las dos formas de dar la ubicación ----------

function pedirUbicacionGPS() {
  // navigator.geolocation solo funciona en https:// o en localhost
  if (!('geolocation' in navigator)) {
    mostrarMensajeCercanos('Tu navegador no permite obtener la ubicación. Marca tu casa en el mapa.', true);
    return;
  }
  mostrarMensajeCercanos('Buscando tu ubicación…');
  navigator.geolocation.getCurrentPosition(
    (posicionGPS) => usarOrigen({ lat: posicionGPS.coords.latitude, lng: posicionGPS.coords.longitude }),
    () => mostrarMensajeCercanos(
      'No se pudo obtener tu ubicación (¿diste permiso?). Puedes marcar tu casa en el mapa.', true,
    ),
    { enableHighAccuracy: true, timeout: 10000 },
  );
}

function activarModoMarcar() {
  esperandoClicEnMapa = true;
  mapa.getContainer().classList.add('modo-marcar'); // cambia el cursor a una cruz
  mostrarMensajeCercanos('Haz clic en el mapa donde está tu casa.');
}

// ---------- 4. Arranque ----------

async function iniciarCercanos() {
  ({ mapa, puntos, nombresDeRutas } = await mapaListo); // espera a que mapa.js termine

  botonMiUbicacion.disabled = false;
  botonMarcarEnMapa.disabled = false;
  botonMiUbicacion.addEventListener('click', pedirUbicacionGPS);
  botonMarcarEnMapa.addEventListener('click', activarModoMarcar);

  mapa.on('click', (evento) => {
    if (!esperandoClicEnMapa) return; // un clic normal en el mapa no hace nada
    esperandoClicEnMapa = false;
    mapa.getContainer().classList.remove('modo-marcar');
    usarOrigen({ lat: evento.latlng.lat, lng: evento.latlng.lng });
  });
}

iniciarCercanos();
