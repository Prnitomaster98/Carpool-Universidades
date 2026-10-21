//La idea de este JS es manejar los viajes creados y publicados por gente que usa la app
// a. Publicar un viaje y que se guarde en firestore
// b.Muestra viajes publicados
// c. Te deja publicar tu viaje con contacto de whatsapp
// d. Solicita un viaje de solicitudes .js
// e. Muestra las estrellas del conductor y un link a su perfil (calificaciones.js)
//   viajes/{id automático} = {
//     conductorUid, conductorNombre, zonaId, puntoId,
//     dia: 'lunes', tramo: 'ida', hora: '07:15', cupos: 3,
//     creado: (fecha del servidor), esDemo: false

import { auth, db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import { DIAS } from "./matching.js";
import { escucharResenas, dibujarRating } from "./calificaciones.js"; //Estrellas del conductor

const NOMBRES_TRAMO = { ida: "Ida a la UVG", regreso: "Regreso a casa" };
const MAXIMO_CUPOS = 4;

const formulario = document.getElementById("form-viaje");
const selectZona = document.getElementById("viaje-zona");
const selectPunto = document.getElementById("viaje-punto");
const selectDia = document.getElementById("viaje-dia"); //Toma todos los datos/ objetos que se utilizarán en cada parte.
const selectTramo = document.getElementById("viaje-tramo");
const inputHora = document.getElementById("viaje-hora");
const selectCupos = document.getElementById("viaje-cupos");
const mensajeFormulario = document.getElementById("viaje-mensaje");
const botonPublicar = document.getElementById("viaje-publicar");
const mensajeLista = document.getElementById("viajes-mensaje");
const lista = document.getElementById("lista-viajes");

let miPerfil = null; //Lo creo para que después no truene
let zonas = [];
let puntos = [];
let viajes = [];
let resenas = []; //Calificaciones de todos (llegan en tiempo real)

//Crea el elemento con su clase y su texto.
function crear(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto; //Agrega una etiqueta con texto, de distintas clases.
  return elemento;
}

async function leerJSON(ruta, porDefecto) {
  try {
    const respuesta = await fetch(ruta);
    if (!respuesta.ok) throw new Error(respuesta.status);
    return await respuesta.json();
  } catch (error) {
    //Lee JSON de perfiles y viajes actuales
    console.warn(`No se pudo leer ${ruta}`, error);
    return porDefecto;
  }
}

function llenarSelect(select, opciones) {
  select.replaceChildren();
  for (const { valor, texto } of opciones) {
    const opcion = document.createElement("option");
    opcion.value = valor; //Mete las opciones del select
    opcion.textContent = texto;
    select.append(opcion);
  }
}

function nombreDia(idDia) {
  return DIAS.find((dia) => dia.id === idDia)?.nombre ?? idDia;
}

function nombreZona(idZona) {
  return zonas.find((zona) => zona.id === idZona)?.nombre ?? idZona;
}

function nombrePunto(idPunto) {
  return (
    puntos.find((punto) => punto.id === idPunto)?.nombre ?? "Punto sin nombre"
  ); //Recibe los nombres de dia, zona y punto para colocarlos.
}

function prepararFormulario() {
  llenarSelect(
    selectDia,
    DIAS.map((dia) => ({ valor: dia.id, texto: dia.nombre })),
  ); //Llena los datos de nombre y dia

  const cupos = [];
  for (let numero = 1; numero <= MAXIMO_CUPOS; numero++) {
    cupos.push({
      valor: numero,
      texto: numero === 1 ? "1 lugar" : `${numero} lugares`,
    });
  }
  llenarSelect(selectCupos, cupos);

  selectZona.addEventListener("change", llenarPuntos);
  selectDia.addEventListener("change", sugerirHora);
  selectTramo.addEventListener("change", sugerirHora);
  formulario.addEventListener("submit", publicar);
}
//Llena las zonas, primero tomando la más importante
function llenarZonas() {
  llenarSelect(
    selectZona,
    zonas.map((zona) => ({ valor: zona.id, texto: zona.nombre })),
  );
  const miZona = miPerfil?.zonas?.[0];
  if (miZona && zonas.some((zona) => zona.id === miZona))
    selectZona.value = miZona;
  llenarPuntos();
}
//Lleno puntos
function llenarPuntos() {
  const deEstaRuta = puntos.filter(
    (punto) => punto.zonaId === selectZona.value,
  );
  if (deEstaRuta.length === 0) {
    llenarSelect(selectPunto, [
      { valor: "", texto: "Esta ruta no tiene puntos" },
    ]);
    return;
  }
  llenarSelect(
    selectPunto,
    deEstaRuta.map((punto) => ({ valor: punto.id, texto: punto.nombre })),
  );
}
//Seleeciono la hora y pongo el horario
function sugerirHora() {
  const horarioDelDia = miPerfil?.horario?.[selectDia.value];
  if (!horarioDelDia) return;
  inputHora.value =
    selectTramo.value === "ida" ? horarioDelDia.entrada : horarioDelDia.salida;
}
//Digo que rol es
function aplicarRol() {
  formulario.hidden = miPerfil?.rol === "pasajero";
}

//Valida que este completo el viaje
function validar(viaje) {
  if (!viaje.puntoId) return "Elige un punto de encuentro (esta ruta no tiene)";
  if (!viaje.hora) return "Pon la hora del viaje";
  return null;
}
//Guarda los viajes en la base de datos con todos sus datos después de validarlos
async function publicar(evento) {
  evento.preventDefault(); //evita que se recargue la página

  const usuario = auth.currentUser;
  const viaje = {
    conductorUid: usuario.uid,
    conductorNombre: miPerfil?.nombre || usuario.email.split("@")[0],
    zonaId: selectZona.value,
    puntoId: selectPunto.value,
    dia: selectDia.value,
    tramo: selectTramo.value,
    hora: inputHora.value,
    cupos: Number(selectCupos.value), //Utiliza el objeto del usuario para publicar un viaje.
    creado: serverTimestamp(),
    esDemo: false,
  };

  const error = validar(viaje);
  if (error) {
    mensajeFormulario.textContent = error;
    return;
  }

  botonPublicar.disabled = true;
  mensajeFormulario.textContent = "Publicando...";
  try {
    await addDoc(collection(db, "viajes"), viaje); //Async para publicar un viaje(await también)
    mensajeFormulario.textContent = "Viaje publicado";
    await cargarViajes();
  } catch (problema) {
    console.error(problema);
    mensajeFormulario.textContent =
      problema.code === "permission-denied"
        ? "Firebase no dejó guardar. Revisa que las reglas nuevas estén publicadas."
        : "No se pudo publicar. Revisa tu internet e intenta otra vez.";
  } finally {
    botonPublicar.disabled = false;
  }
}

async function cargarViajes() {
  //Muestra los viajes guardados en el documento
  try {
    const resultado = await getDocs(collection(db, "viajes"));
    viajes = resultado.docs.map((documento) => ({
      id: documento.id,
      ...documento.data(),
    }));
  } catch (problema) {
    console.warn("No se pudieron leer los viajes", problema);
    viajes = [];
    mensajeLista.textContent = "No se pudieron cargar los viajes";
    lista.replaceChildren();
    return;
  }

  const ordenDia = (idDia) => DIAS.findIndex((dia) => dia.id === idDia);
  viajes.sort(
    (a, b) =>
      ordenDia(a.dia) - ordenDia(b.dia) ||
      a.tramo.localeCompare(b.tramo) ||
      a.hora.localeCompare(b.hora),
  );
  mostrarViajes();
}

function dibujarViaje(viaje) {
  const elemento = crear("li", "coincidencia");
  const esMio = viaje.conductorUid === auth.currentUser?.uid;
  //Ingresa la info del viaje a donde la tengo que utilizar
  const encabezado = crear("div", "coincidencia-encabezado");
  const textoCupos = viaje.cupos === 1 ? "1 lugar" : `${viaje.cupos} lugares`;

  encabezado.append(
    crear(
      "h3",
      "coincidencia-nombre",
      esMio ? `${viaje.conductorNombre} (tú)` : viaje.conductorNombre,
    ),
    crear("span", "coincidencia-puntaje", textoCupos),
  );
  elemento.append(encabezado);

  //Estrellas del conductor + link a su perfil (pestaña Perfiles)
  const conductor = crear("div", "viaje-conductor");
  const enlacePerfil = crear(
    "a",
    "enlace-perfil",
    esMio ? "Ver mi perfil" : `Ver perfil de ${viaje.conductorNombre}`,
  );
  enlacePerfil.href = `perfiles.html?uid=${encodeURIComponent(viaje.conductorUid)}`;
  conductor.append(dibujarRating(resenas, viaje.conductorUid), enlacePerfil);
  elemento.append(conductor);

  elemento.append(
    crear(
      "p",
      "coincidencia-detalle",
      `${nombreDia(viaje.dia)} · ${NOMBRES_TRAMO[viaje.tramo]} · ${viaje.hora}`,
    ),
    crear("p", "coincidencia-detalle", `Ruta: ${nombreZona(viaje.zonaId)}`),
    crear("p", "coincidencia-detalle", `Punto: ${nombrePunto(viaje.puntoId)}`),
  );
  if (esMio) {
    const botonWhatsApp = crear(
      "button",
      "boton boton-secundario",
      "Compartir por Whatsapp",
    );
    botonWhatsApp.type = "button";
    botonWhatsApp.addEventListener("click", () => compartirPorWhatsApp(viaje));

    const botonBorrar = crear("button", "boton-enlace", "Borrar viaje");
    botonBorrar.type = "button";
    botonBorrar.addEventListener("click", () => borrarViaje(viaje));

    elemento.append(botonWhatsApp, botonBorrar);
  } else {
    const botonSolicitar = crear(
      "button",
      "boton boton-principal",
      "Solicitar lugar",
    );
    botonSolicitar.type = "button";
    botonSolicitar.addEventListener("click", () => {
      document.dispatchEvent(
        new CustomEvent("solicitar-viaje", { detail: viaje }),
      ); //Crea un viaje y avisa a la demás aplicación
    });
    elemento.append(botonSolicitar);
  }
  if (viaje.esDemo)
    elemento.append(crear("span", "etiqueta-demo", "Dato de prueba"));
  return elemento;
}

//Muestra los viajes qeu existen actualmente
function mostrarViajes() {
  lista.replaceChildren();
  if (viajes.length === 0) {
    mensajeLista.textContent = "Todavía no hay viajes publicados.";
    return;
  }
  mensajeLista.textContent =
    viajes.length === 1
      ? "1 viaje publicado:"
      : `${viajes.length} viajes publicados:`;
  for (const viaje of viajes) {
    lista.append(dibujarViaje(viaje));
  }
}

//Función para compartir un viaje por Whats
function compartirPorWhatsApp(viaje) {
  const texto =
    `Carpool UVG: el ${nombreDia(viaje.dia).toLowerCase()} ` +
    `(${NOMBRES_TRAMO[viaje.tramo].toLowerCase()}) a las ${viaje.hora}. ` +
    `Ruta ${nombreZona(viaje.zonaId)}, punto de encuentro: ${nombrePunto(viaje.puntoId)}. ` +
    `Me quedan ${viaje.cupos} lugar(es). Pídelo en la app.`;
  window.open(
    `https://wa.me/?text=${encodeURIComponent(texto)}`,
    "_blank",
    "noopener",
  );
}

//Borra un viaje, sus registros y lo vuelve a cargar
async function borrarViaje(viaje) {
  if (!confirm("¿Borrar este viaje?")) return;
  try {
    await deleteDoc(doc(db, "viajes", viaje.id));
    await cargarViajes();
  } catch (problema) {
    console.error(problema);
    mensajeLista.textContent = "No se pudo borrar el viaje";
  }
}

//Funciones que comienzan todo

prepararFormulario();

document.addEventListener("perfil-listo", (evento) => {
  miPerfil = evento.detail;
  aplicarRol();
  sugerirHora();
  if (zonas.length > 0) llenarZonas();
});

mensajeLista.textContent = "Cargando viajes...";

const [listaPuntos, zonasGeojson] = await Promise.all([
  leerJSON("data/puntos-encuentro.json", []),
  leerJSON("data/zonas.geojson", { features: [] }),
]);
puntos = listaPuntos;
zonas = zonasGeojson.features.map((zona) => ({
  id: zona.properties.id,
  nombre: zona.properties.nombre,
}));

llenarZonas();
botonPublicar.disabled = false;

// Esperamos a que Firebase sepa quién eres: sin sesión, las reglas
// no dejan leer "viajes" y la lista saldría vacía con error.
await auth.authStateReady();
await cargarViajes();

//Cuando alguien califica, las estrellas de los viajes se actualizan solas
escucharResenas((lista) => {
  resenas = lista;
  mostrarViajes();
});
