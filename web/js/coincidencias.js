// ==========================================================
// coincidencias.js — sección "Coincidencias" de app.html (Fase 4)
//
// Lo que hace:
//   1. Junta a "los otros": perfiles reales de Firestore (colección usuarios)
//      + los 35 perfiles de prueba de web/data/perfiles-demo.json.
//   2. Espera a que perfil.js anuncie TU perfil (evento "perfil-listo").
//   3. Con el día y el tramo (ida/regreso) elegidos, llama a
//      buscarCoincidencias() de matching.js y dibuja la lista.
//   4. Al tocar una coincidencia, resalta su punto sugerido en el mapa.
//
// Cada vez que guardas tu perfil, perfil.js vuelve a anunciarlo y la lista
// se recalcula sola.
// ==========================================================

import { db } from './firebase-config.js'
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'
import { DIAS, buscarCoincidencias } from './matching.js'
import { resaltarPunto } from './mapa.js'
import { botonContacto } from './whatsapp.js'

const MAXIMO_RESULTADOS = 10   // para no llenar la pantalla

const NOMBRES_ROL = { conductor: 'Conductor', pasajero: 'Pasajero', ambos: 'Conductor o pasajero' }

// ---------- Elementos de la página ----------
const selectDia = document.getElementById('coincidencias-dia')
const selectTramo = document.getElementById('coincidencias-tramo')
const mensaje = document.getElementById('coincidencias-mensaje')
const lista = document.getElementById('lista-coincidencias')

// ---------- Datos (se llenan al cargar) ----------
let miPerfil = null          // llega con el evento "perfil-listo"
let otrosPerfiles = []       // Firestore + demo
let puntos = []              // puntos-encuentro.json
let nombresZonas = {}        // { "ruta-norte": "Norte (zonas 1, 2...)" }
let datosListos = false      // true cuando ya llegaron Firestore + demo + puntos


// ----------------------------------------------------------
// Lee un archivo JSON de web/data/. Si falla, devuelve "porDefecto"
// en vez de romper toda la sección.
// ----------------------------------------------------------
async function leerJSON(ruta, porDefecto) {
  try {
    const respuesta = await fetch(ruta);
    if (!respuesta.ok) throw new Error(respuesta.status);
    return await respuesta.json();
  } catch (error) {
    console.warn(`No se pudo leer ${ruta}`, error);
    return porDefecto;
  }
}


// ----------------------------------------------------------
// Baja todos los documentos de la colección usuarios.
// Las reglas solo dejan leerlos a estudiantes verificados.
// Si falla (sin internet, reglas), seguimos solo con los de prueba.
// ----------------------------------------------------------
async function leerPerfilesFirestore() {
  try {
    const resultado = await getDocs(collection(db, 'usuarios'));
    // resultado.docs es la lista de documentos; .data() saca el objeto de cada uno
    return resultado.docs.map((documento) => documento.data());
  } catch (error) {
    console.warn('No se pudieron leer los perfiles de Firestore', error);
    return [];
  }
}


// ----------------------------------------------------------
// ¿El perfil tiene lo mínimo para compararse? (rol, zonas y horario)
// Las cuentas nuevas que todavía no llenan "Mi perfil" quedan fuera.
// ----------------------------------------------------------
function perfilCompleto(perfil) {
  return Boolean(perfil?.rol)
    && Array.isArray(perfil.zonas) && perfil.zonas.length > 0
    && perfil.horario && Object.keys(perfil.horario).length > 0;
}


// ----------------------------------------------------------
// Llena el <select> de días y elige uno por defecto:
// hoy si es lunes a viernes; si es fin de semana, el lunes.
// También elige "ida" en la mañana y "regreso" en la tarde.
// ----------------------------------------------------------
function prepararFiltros() {
  for (const dia of DIAS) {
    const opcion = document.createElement('option');
    opcion.value = dia.id;
    opcion.textContent = dia.nombre;
    selectDia.append(opcion);
  }
  const ahora = new Date();
  const numeroDia = ahora.getDay();   // 0 = domingo, 1 = lunes ... 6 = sábado
  selectDia.value = numeroDia >= 1 && numeroDia <= 5 ? DIAS[numeroDia - 1].id : 'lunes';
  selectTramo.value = ahora.getHours() < 12 ? 'ida' : 'regreso';

  // "change" se dispara cada vez que el usuario elige otra opción
  selectDia.addEventListener('change', mostrarCoincidencias);
  selectTramo.addEventListener('change', mostrarCoincidencias);
}


// ----------------------------------------------------------
// Crea un elemento con clase y texto en una sola línea
// ----------------------------------------------------------
function crear(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}


// ----------------------------------------------------------
// Dibuja UNA coincidencia como <li>:
//   Nombre                          85 % compatible
//   Carrera · Conductor
//   Zonas en común: Norte
//   Entran con 5 min de diferencia
//   Punto sugerido: Portales (toca para verlo en el mapa)
//   [Dato de prueba]
// ----------------------------------------------------------
function dibujarCoincidencia(resultado, tramo, nombreDia) {
  const elemento = crear('li', 'coincidencia');

  const encabezado = crear('div', 'coincidencia-encabezado');
  encabezado.append(
    crear('h3', 'coincidencia-nombre', resultado.nombre),
    crear('span', 'coincidencia-puntaje', `${Math.round(resultado.puntaje * 100)} % compatible`),
  );
  elemento.append(encabezado);

  const rol = NOMBRES_ROL[resultado.rol] ?? resultado.rol;
  const carrera = resultado.carrera ? `${resultado.carrera} · ` : '';
  elemento.append(crear('p', 'coincidencia-detalle', `${carrera}${rol}`));

  const zonas = resultado.zonasComunes.map((id) => nombresZonas[id] ?? id).join(', ');
  elemento.append(crear('p', 'coincidencia-detalle', `Zonas en común: ${zonas}`));

  const verbo = tramo === 'ida' ? 'Entran' : 'Salen';
  const textoHora = resultado.diferencia === 0
    ? `${verbo} a la misma hora`
    : `${verbo} con ${resultado.diferencia} min de diferencia`;
  elemento.append(crear('p', 'coincidencia-detalle', textoHora));

  if (resultado.puntoSugerido) {
    // Es un <button> para que se pueda usar con teclado y lector de pantalla
    const boton = crear('button', 'boton-enlace', `Punto sugerido: ${resultado.puntoSugerido.nombre} (ver en el mapa)`);
    boton.type = 'button';
    boton.addEventListener('click', () => {
      if (resaltarPunto(resultado.puntoSugerido.id)) {
        document.getElementById('mapa-seccion').scrollIntoView({ behavior: 'smooth' });
      }
    });
    elemento.append(boton);
  } else {
    elemento.append(crear('p', 'coincidencia-detalle', 'Sin punto de encuentro sugerido en esas zonas.'));
  }

  if (!resultado.esDemo){
    const viaje = tramo === 'ida' ? 'ida a la UVG' : 'regreso a casa'
    const texto = `Carpool UVG: hola ${resultado.nombre}, la app dice que coincidimos el ${nombreDia} (${viaje}). ¿Te interesa compartir viaje?`
    elemento.append(botonContacto({uid:resultado.uid, nombre: resultado.nombre, texto}))
  }

  if (resultado.esDemo) {
    elemento.append(crear('span', 'etiqueta-demo', 'Dato de prueba'));
  }
  return elemento;
}


// ----------------------------------------------------------
// Calcula y dibuja la lista con el día y el tramo elegidos
// ----------------------------------------------------------
function mostrarCoincidencias() {
  lista.replaceChildren();
  if (!miPerfil || !datosListos) return;   // falta algo: el mensaje de "cargando" sigue

  if (!perfilCompleto(miPerfil)) {
    mensaje.textContent = 'Llena y guarda "Mi perfil" (rol, zonas y horario) para ver con quién coincides.';
    return;
  }

  const dia = selectDia.value;
  const tramo = selectTramo.value;
  const nombreDia = DIAS.find((d) => d.id === dia).nombre.toLowerCase();

  if (!miPerfil.horario[dia]) {
    mensaje.textContent = `No tienes horario el ${nombreDia}. Elige otro día o agrégalo en tu perfil.`;
    return;
  }

  const resultados = buscarCoincidencias(miPerfil, otrosPerfiles, dia, tramo, puntos);

  if (resultados.length === 0) {
    mensaje.textContent = `Nadie coincide contigo el ${nombreDia} de ${tramo}. Prueba con otro día, el otro tramo o una tolerancia mayor.`;
    return;
  }

  const mostrados = resultados.slice(0, MAXIMO_RESULTADOS);   // slice = los primeros N
  mensaje.textContent = resultados.length > MAXIMO_RESULTADOS
    ? `${resultados.length} compañeros coinciden contigo. Estos son los ${MAXIMO_RESULTADOS} mejores:`
    : `${resultados.length} compañero(s) coinciden contigo:`;
  for (const resultado of mostrados) {
    lista.append(dibujarCoincidencia(resultado, tramo, nombreDia));
  }
}


// ---------- Arranque ----------
prepararFiltros();

// El "oído" se pone ANTES de cualquier await, para no perder el primer anuncio
document.addEventListener('perfil-listo', (evento) => {
  miPerfil = evento.detail;
  mostrarCoincidencias();
});

mensaje.textContent = 'Buscando compañeros…';

// Promise.all = hacer las 4 cargas AL MISMO TIEMPO y esperar a que terminen todas
const [deFirestore, deDemo, listaPuntos, zonasGeojson] = await Promise.all([
  leerPerfilesFirestore(),
  leerJSON('data/perfiles-demo.json', []),
  leerJSON('data/puntos-encuentro.json', []),
  leerJSON('data/zonas.geojson', { features: [] }),
]);

// Si un uid aparece en Firestore Y en demo (porque se subieron con cargar_demo.py),
// nos quedamos con uno solo. Un Map guarda un valor por cada llave (aquí, el uid).
const porUid = new Map();
for (const perfil of [...deDemo, ...deFirestore]) {
  if (perfilCompleto(perfil)) porUid.set(perfil.uid, perfil);
}
otrosPerfiles = [...porUid.values()];
puntos = listaPuntos;
for (const zona of zonasGeojson.features) {
  nombresZonas[zona.properties.id] = zona.properties.nombre;
}
datosListos = true;

if (miPerfil) {
  mostrarCoincidencias();
} else {
  mensaje.textContent = 'Cargando tu perfil…';
}
