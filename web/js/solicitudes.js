// Se encarga de las solicitudes de viaje, las maneja principalmente compara con la base de datos y las une.

import { auth, db } from "./firebase-config.js";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp, //Import funciones de db
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { DIAS } from "./matching.js";
import { botonContacto } from "./whatsapp.js"; //Funciones de otros js
import { dibujarGrupos } from "./agrupar.js"; //Cajas por estado

const NOMBRES_TRAMO = { ida: "Ida a la UVG", regreso: "Regreso a casa" };
const NOMBRES_ESTADO = {
  pendiente: "Pendiente",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
};

//Importo todo lo que voy a usar.
const seccion = document.getElementById("solicitudes");
const mensaje = document.getElementById("solicitudes-mensaje");
const listaRecibidas = document.getElementById("lista-recibidas");
const listaEnviadas = document.getElementById("lista-enviadas");
const formWhatsApp = document.getElementById("form-whatsapp");
const inputWhatsApp = document.getElementById("mi-whatsapp");
const botonGuardarWhatsApp = document.getElementById("whatsapp-guardar");
const checkCompartir = document.getElementById("compartir-whatsapp");

let miPerfil = null;
let puntos = []; // Creo mis datos para que después no truene.
let recibidas = [];
let enviadas = [];
let miTelefono = "";
let miCompartir = false;

// Igual que en viajes.js
function crear(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta); //Crea un objeto con clase.
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

async function leerJSON(ruta, porDefecto) {
  try {
    const respuesta = await fetch(ruta); //Lee las rutas al igual que en viajes.js
    if (!respuesta.ok) throw new Error(respuesta.status);
    return await respuesta.json();
  } catch (error) {
    console.warn(`No se pudo leer ${ruta}`, error);
    return porDefecto;
  }
}

function nombreDia(idDia) {
  return DIAS.find((dia) => dia.id === idDia)?.nombre ?? idDia;
}
function nombrePunto(idPunto) {
  return (
    puntos.find((punto) => punto.id === idPunto)?.nombre ?? "Punto sin nombre"
  );
}

async function solicitar(viaje) {
  const usuario = auth.currentUser;
  seccion.scrollIntoView({ behavior: "smooth" }); // Al solicitar un viaje se revisa el estado y si ya se ha pedido

  // Revisamos antes en lo que ya bajamos, para dar un mensaje claro
  if (enviadas.some((solicitud) => solicitud.viajeId === viaje.id)) {
    mensaje.textContent =
      "Ya pediste lugar en ese viaje. Mira su estado abajo.";
    return;
  }

  if (!miTelefono) {
    mensaje.textContent = "Primero ingresa tu teléfono.";
    inputWhatsApp.focus(); //Para solicitar un viaje se pide número de teléfono
    return;
  }

  const solicitud = {
    viajeId: viaje.id,
    conductorUid: viaje.conductorUid,
    conductorNombre: viaje.conductorNombre,
    pasajeroUid: usuario.uid,
    pasajeroNombre: miPerfil?.nombre || usuario.email.split("@")[0],
    dia: viaje.dia,
    tramo: viaje.tramo, //Se crea el objeto del viaje con toda la info que ya trae importado
    hora: viaje.hora,
    puntoId: viaje.puntoId,
    estado: "pendiente",
    creado: serverTimestamp(),
    esDemo: false,
    pasajeroTelefono: miTelefono,
  };

  mensaje.textContent = "Enviando solicitud...";
  try {
    // setDoc con un id que NOSOTROS armamos (addDoc inventa uno al azar)
    await setDoc(
      doc(db, "solicitudes", `${viaje.id}_${usuario.uid}`),
      solicitud,
    );
    mensaje.textContent = `Solicitud enviada a ${viaje.conductorNombre}. Espera a que la acepte.`;
    await cargarSolicitudes();
  } catch (problema) {
    //Se envía la solicitud, guardándola en la base de datos.
    console.error(problema);
    mensaje.textContent =
      problema.code === "permission-denied"
        ? "Firebase no dejó guardar. Revisa que las reglas nuevas estén publicadas."
        : "No se pudo enviar la solicitud. Revisa tu internet.";
  }
}

// Muestra las solicitudes actuales que has mandado.
async function cargarSolicitudes() {
  const uid = auth.currentUser.uid;
  const coleccion = collection(db, "solicitudes");
  try {
    const [deConductor, dePasajero] = await Promise.all([
      getDocs(query(coleccion, where("conductorUid", "==", uid))),
      getDocs(query(coleccion, where("pasajeroUid", "==", uid))),
    ]);
    recibidas = deConductor.docs.map((documento) => ({
      id: documento.id,
      ...documento.data(),
    }));
    enviadas = dePasajero.docs.map((documento) => ({
      id: documento.id,
      ...documento.data(),
    }));
    recibidas.sort(ordenarPorDia);
    enviadas.sort(ordenarPorDia);
  } catch (problema) {
    console.warn("No se pudieron leer las solicitudes", problema);
    mensaje.textContent = "No se pudieron cargar las solicitudes.";
    return;
  }
  mostrarSolicitudes();
  // Le contamos a viajes.js cómo van tus solicitudes, para que agrupe los viajes igual
  document.dispatchEvent(
    new CustomEvent("mis-solicitudes", { detail: enviadas }),
  );
}

// Mismo orden que los viajes: día, luego ida/regreso, luego hora
function ordenarPorDia(a, b) {
  const ordenDia = (idDia) => DIAS.findIndex((dia) => dia.id === idDia);
  return (
    ordenDia(a.dia) - ordenDia(b.dia) ||
    a.tramo.localeCompare(b.tramo) ||
    a.hora.localeCompare(b.hora)
  );
}

// Arma los 3 grupos (pendientes, aceptadas, rechazadas) de una lista.
// Las rechazadas empiezan cerradas para que no estorben.
function separarPorEstado(solicitudes) {
  const conEstado = (estado) =>
    solicitudes.filter((solicitud) => solicitud.estado === estado);
  return [
    { id: "pendiente", titulo: "Pendientes", elementos: conEstado("pendiente"), abierto: true },
    { id: "aceptada", titulo: "Aceptadas", elementos: conEstado("aceptada"), abierto: true },
    { id: "rechazada", titulo: "Rechazadas", elementos: conEstado("rechazada"), abierto: false },
  ];
}

// Dibuja las solicitudes que recibiste (conductor) y las que enviaste (pasajero)
function mostrarSolicitudes() {
  dibujarGrupos(
    listaRecibidas,
    separarPorEstado(recibidas),
    dibujarRecibida,
    "Nadie ha pedido lugar en tus viajes todavía.",
  );
  dibujarGrupos(
    listaEnviadas,
    separarPorEstado(enviadas),
    dibujarEnviada,
    "No has pedido lugar en ningún viaje.",
  );
}

// ----------------------------------------------------------
// Parte común de las dos tarjetas: nombre + estado, y los datos del viaje
// ----------------------------------------------------------
function dibujarBase(solicitud, nombre) {
  const elemento = crear("li", "coincidencia");
  const encabezado = crear("div", "coincidencia-encabezado");
  encabezado.append(
    crear("h3", "coincidencia-nombre", nombre),
    crear(
      "span",
      "coincidencia-puntaje",
      NOMBRES_ESTADO[solicitud.estado] ?? solicitud.estado,
    ),
  );
  elemento.append(
    encabezado,
    crear(
      "p",
      "coincidencia-detalle",
      `${nombreDia(solicitud.dia)} · ${NOMBRES_TRAMO[solicitud.tramo] ?? solicitud.tramo} · ${solicitud.hora}`,
    ),
    crear(
      "p",
      "coincidencia-detalle",
      `Punto: ${nombrePunto(solicitud.puntoId)}`,
    ),
  );
  return elemento;
}

// Tarjeta de una solicitud que RECIBISTE (eres el conductor)
function dibujarRecibida(solicitud) {
  const elemento = dibujarBase(
    solicitud,
    `${solicitud.pasajeroNombre} quiere ir contigo`,
  );

  if (solicitud.estado === "aceptada") {
    elemento.append(botonWhatsApp(solicitud, true));
  }
  if (solicitud.estado === "pendiente") {
    const botonAceptar = crear("button", "boton boton-principal", "Aceptar");
    botonAceptar.type = "button";
    botonAceptar.addEventListener("click", () =>
      responder(solicitud, "aceptada"),
    );

    const botonRechazar = crear("button", "boton-enlace", "Rechazar");
    botonRechazar.type = "button";
    botonRechazar.addEventListener("click", () =>
      responder(solicitud, "rechazada"),
    );

    elemento.append(botonAceptar, botonRechazar);
  }
  return elemento;
}

// Tarjeta de una solicitud que ENVIASTE (eres el pasajero)
function dibujarEnviada(solicitud) {
  const elemento = dibujarBase(
    solicitud,
    `Viaje de ${solicitud.conductorNombre}`,
  );

  if (solicitud.estado === "aceptada") {
    elemento.append(
      crear(
        "p",
        "coincidencia-detalle",
        "Te aceptaron. Llega al punto de encuentro a tiempo.",
      ),
    );
    elemento.append(botonWhatsApp(solicitud, false));
  }
  // Si te rechazaron, la puedes quitar de la lista (se borra igual que al cancelar)
  const botonCancelar = crear(
    "button",
    "boton-enlace",
    solicitud.estado === "rechazada" ? "Quitar de la lista" : "Cancelar solicitud",
  );
  botonCancelar.type = "button";
  botonCancelar.addEventListener("click", () => cancelar(solicitud));
  elemento.append(botonCancelar);
  return elemento;
}

// ----------------------------------------------------------
//La app si guarda whats :)
// ----------------------------------------------------------
function botonWhatsApp(solicitud, soyConductor) {
  const detalle =
    `${nombreDia(solicitud.dia).toLowerCase()} ` + //Toma la información de día, horario y punto de encuentro.
    `(${(NOMBRES_TRAMO[solicitud.tramo] ?? solicitud.tramo).toLowerCase()}) a las ${solicitud.hora}, ` +
    `punto de encuentro: ${nombrePunto(solicitud.puntoId)}.`;

  const texto = soyConductor
    ? `Carpool UVG: hola ${solicitud.pasajeroNombre}, te acepté en mi viaje del ${detalle}`
    : `Carpool UVG: hola ${solicitud.conductorNombre}, gracias por aceptarme en tu viaje del ${detalle}`;

  return botonContacto({
    uid: soyConductor ? solicitud.pasajeroUid : solicitud.conductorUid,
    nombre: soyConductor ? solicitud.pasajeroNombre : solicitud.conductorNombre,
    telefono: soyConductor
      ? solicitud.pasajeroTelefono
      : solicitud.conductorTelefono,
    texto,
  });
}

// ----------------------------------------------------------
// El conductor acepta o rechaza.
// Antes de aceptar revisamos que el viaje exista y que queden lugares:
// aceptadas de ESE viaje < cupos del viaje.
// ----------------------------------------------------------
async function responder(solicitud, nuevoEstado) {
  try {
    if (nuevoEstado === "aceptada") {
      if (!miTelefono) {
        mensaje.textContent =
          "Guarda tu número de Whatsapp para aceptar solicitudes.";
        inputWhatsApp.focus();
        return;
      }

      const viaje = await getDoc(doc(db, "viajes", solicitud.viajeId));
      if (!viaje.exists()) {
        mensaje.textContent = "Ese viaje ya fue borrado.";
        return;
      }

      const aceptadas = recibidas.filter(
        (otra) =>
          otra.viajeId === solicitud.viajeId && otra.estado === "aceptada",
      ).length;
      if (aceptadas >= viaje.data().cupos) {
        mensaje.textContent = "Ya no te quedan lugares en ese viaje.";
        return;
      }
    }
    // updateDoc cambia SOLO los campos que le pasas; lo demás queda igual
    const cambios = { estado: nuevoEstado };
    // Al aceptar, le pasamos tu número al pasajero (solo él y tú pueden leer la solicitud)
    if (nuevoEstado === "aceptada") cambios.conductorTelefono = miTelefono;
    await updateDoc(doc(db, "solicitudes", solicitud.id), cambios);
    mensaje.textContent =
      nuevoEstado === "aceptada"
        ? `Aceptaste a ${solicitud.pasajeroNombre}.`
        : `Rechazaste a ${solicitud.pasajeroNombre}.`;
    await cargarSolicitudes();
  } catch (problema) {
    console.error(problema);
    mensaje.textContent =
      problema.code === "permission-denied"
        ? "Firebase no dejó responder. Revisa que las reglas nuevas estén publicadas en la consola."
        : `No se pudo responder la solicitud (${problema.code ?? problema.message}).`;
  }
}

// El pasajero cancela su solicitud (se borra)
async function cancelar(solicitud) {
  const esRechazada = solicitud.estado === "rechazada";
  if (!confirm(esRechazada ? "¿Quitar esta solicitud de la lista?" : "¿Cancelar esta solicitud?")) return;
  try {
    await deleteDoc(doc(db, "solicitudes", solicitud.id));
    mensaje.textContent = esRechazada ? "Solicitud quitada." : "Solicitud cancelada.";
    await cargarSolicitudes();
  } catch (problema) {
    console.error(problema);
    mensaje.textContent = "No se pudo cancelar la solicitud.";
  }
}

function limpiarTelefono(texto) {
  let numero = texto.replace(/\D/g, ""); // \D = todo lo que NO es dígito (espacios, guiones, +)
  if (numero.length === 11 && numero.startsWith("502"))
    numero = numero.slice(3);
  return numero;
}

async function cargarMiTelefono() {
  try {
    const documento = await getDoc(doc(db, "contactos", auth.currentUser.uid));
    if (documento.exists()) {
      miTelefono = documento.data().telefono;
      miCompartir = documento.data().compartir === true;
    }
  } catch (problema) {
    console.warn("No se pudo leer tu WhatsApp", problema);
  }
  inputWhatsApp.value = miTelefono;
  checkCompartir.checked = miCompartir;
  botonGuardarWhatsApp.disabled = false;
}

async function guardarTelefono(evento) {
  evento.preventDefault(); // sin esto, el formulario recarga la página
  const numero = limpiarTelefono(inputWhatsApp.value);
  if (!/^[0-9]{8}$/.test(numero)) {
    //expresión en regex
    mensaje.textContent =
      "Escribe tu número de WhatsApp de 8 dígitos (por ejemplo 5555 1234).";
    checkCompartir.checked = miCompartir;
    return;
  }
  try {
    const compartir = checkCompartir.checked;
    await setDoc(doc(db, "contactos", auth.currentUser.uid), {
      telefono: numero,
      compartir,
    });
    miTelefono = numero;
    miCompartir = compartir;
    inputWhatsApp.value = numero;
    mensaje.textContent = compartir
      ? "Número guardado. Solo lo verá quien comparta un viaje contigo y tus coincidencias."
      : "Número guardado. Solo lo verá quien comparta un viaje contigo";
  } catch (problema) {
    console.error(problema);
    mensaje.textContent =
      problema.code === "permission-denied"
        ? "Firebase no dejó guardar el número. Revisa que las reglas nuevas estén publicadas."
        : "No se pudo guardar el número. Revisa tu internet.";
  }
}

// ---------- Arranque ----------
//Los que reciben los eventos antes de los awaits
document.addEventListener("perfil-listo", (evento) => {
  miPerfil = evento.detail;
});
document.addEventListener("solicitar-viaje", (evento) => {
  solicitar(evento.detail);
});
// seguridad.js avisa cuando llega o cambia una solicitud: recargamos la lista sola
document.addEventListener("solicitudes-cambiaron", () => {
  if (auth.currentUser) cargarSolicitudes();
});

formWhatsApp.addEventListener("submit", guardarTelefono);
// Al tocar el switch se guarda de una vez (requestSubmit = como si presionaras "Guardar")
checkCompartir.addEventListener("change", () => formWhatsApp.requestSubmit());

mensaje.textContent = "Cargando solicitudes...";

//Se revisa la identidad del usuario antes de comenzar
await auth.authStateReady();
puntos = await leerJSON("data/puntos-encuentro.json", []);
await cargarMiTelefono();
await cargarSolicitudes();
mensaje.textContent = "";
