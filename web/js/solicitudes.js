// ==========================================================
// solicitudes.js — sección "Solicitudes" de app.html (Fase 5)
//
// Lo que hace:
//   1. Escucha el evento "solicitar-viaje" que lanza viajes.js y guarda
//      una solicitud "pendiente" en Firestore (colección "solicitudes").
//   2. Muestra dos listas:
//      - Recibidas: las que otros mandaron a TUS viajes (aceptar / rechazar)
//      - Enviadas: las que TÚ mandaste (ver estado / cancelar)
//
// Forma de una solicitud en Firestore:
//   solicitudes/{viajeId}_{pasajeroUid} = {
//     viajeId, conductorUid, conductorNombre, pasajeroUid, pasajeroNombre,
//     dia, tramo, hora, puntoId,            <- copiados del viaje
//     estado: 'pendiente' | 'aceptada' | 'rechazada',
//     creado: (fecha del servidor), esDemo: false
//   }
// El id junta viaje + pasajero: así nadie pide dos veces el mismo viaje.
// ==========================================================

import { auth, db } from './firebase-config.js'
import {
    collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
    query, where, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'
import { DIAS } from './matching.js'

const NOMBRES_TRAMO = { ida: 'Ida a la UVG', regreso: 'Regreso a casa' }
const NOMBRES_ESTADO = { pendiente: 'Pendiente', aceptada: 'Aceptada', rechazada: 'Rechazada' }

// ---------- Elementos de la página ----------
const seccion = document.getElementById('solicitudes')
const mensaje = document.getElementById('solicitudes-mensaje')
const listaRecibidas = document.getElementById('lista-recibidas')
const listaEnviadas = document.getElementById('lista-enviadas')
const formWhatsApp = document.getElementById('form-whatsapp')
const inputWhatsApp = document.getElementById('mi-whatsapp')
const botonGuardarWhatsApp = document.getElementById('whatsapp-guardar')

// ---------- Datos ----------
let miPerfil = null   // llega con "perfil-listo" (lo usamos para tu nombre)
let puntos = []       // para mostrar el nombre del punto
let recibidas = []
let enviadas = []
let miTelefono = ''


// Igual que en viajes.js
function crear(etiqueta, clase, texto) {
    const elemento = document.createElement(etiqueta)
    if (clase) elemento.className = clase
    if (texto !== undefined) elemento.textContent = texto
    return elemento
}

async function leerJSON(ruta, porDefecto) {
    try {
        const respuesta = await fetch(ruta)
        if (!respuesta.ok) throw new Error(respuesta.status)
        return await respuesta.json()
    } catch (error) {
        console.warn(`No se pudo leer ${ruta}`, error)
        return porDefecto
    }
}

function nombreDia(idDia) {
    return DIAS.find((dia) => dia.id === idDia)?.nombre ?? idDia
}
function nombrePunto(idPunto) {
    return puntos.find((punto) => punto.id === idPunto)?.nombre ?? 'Punto sin nombre'
}


// ----------------------------------------------------------
// El pasajero tocó "Solicitar lugar" en un viaje
// ----------------------------------------------------------
async function solicitar(viaje) {
    const usuario = auth.currentUser
    seccion.scrollIntoView({ behavior: 'smooth' })   // para que vea el mensaje

    // Revisamos antes en lo que ya bajamos, para dar un mensaje claro
    if (enviadas.some((solicitud) => solicitud.viajeId === viaje.id)) {
        mensaje.textContent = 'Ya pediste lugar en ese viaje. Mira su estado abajo.'
        return
    }

    const solicitud = {
        viajeId: viaje.id,
        conductorUid: viaje.conductorUid,
        conductorNombre: viaje.conductorNombre,
        pasajeroUid: usuario.uid,
        pasajeroNombre: miPerfil?.nombre || usuario.email.split('@')[0],
        dia: viaje.dia,
        tramo: viaje.tramo,
        hora: viaje.hora,
        puntoId: viaje.puntoId,
        estado: 'pendiente',
        creado: serverTimestamp(),
        esDemo: false,
    }

    if (miTelefono) solicitud.pasajeroTelefono = miTelefono

    mensaje.textContent = 'Enviando solicitud...'
    try {
        // setDoc con un id que NOSOTROS armamos (addDoc inventa uno al azar)
        await setDoc(doc(db, 'solicitudes', `${viaje.id}_${usuario.uid}`), solicitud)
        mensaje.textContent = `Solicitud enviada a ${viaje.conductorNombre}. Espera a que la acepte.`
        await cargarSolicitudes()
    } catch (problema) {
        console.error(problema)
        mensaje.textContent = problema.code === 'permission-denied'
            ? 'Firebase no dejó guardar. Revisa que las reglas nuevas estén publicadas.'
            : 'No se pudo enviar la solicitud. Revisa tu internet.'
    }
}


// ----------------------------------------------------------
// Baja tus solicitudes. Son DOS consultas:
//   - donde tú eres el conductor (recibidas)
//   - donde tú eres el pasajero (enviadas)
// "where" filtra en Firebase; las reglas OBLIGAN a filtrar así,
// porque nadie puede leer solicitudes que no son suyas.
// ----------------------------------------------------------
async function cargarSolicitudes() {
    const uid = auth.currentUser.uid
    const coleccion = collection(db, 'solicitudes')
    try {
        const [deConductor, dePasajero] = await Promise.all([
            getDocs(query(coleccion, where('conductorUid', '==', uid))),
            getDocs(query(coleccion, where('pasajeroUid', '==', uid))),
        ])
        recibidas = deConductor.docs.map((documento) => ({ id: documento.id, ...documento.data() }))
        enviadas = dePasajero.docs.map((documento) => ({ id: documento.id, ...documento.data() }))
    } catch (problema) {
        console.warn('No se pudieron leer las solicitudes', problema)
        mensaje.textContent = 'No se pudieron cargar las solicitudes.'
        return
    }
    mostrarSolicitudes()
}


// ----------------------------------------------------------
// Dibuja las dos listas
// ----------------------------------------------------------
function mostrarSolicitudes() {
    listaRecibidas.replaceChildren()
    listaEnviadas.replaceChildren()

    if (recibidas.length === 0) {
        listaRecibidas.append(crear('li', 'coincidencia-detalle', 'Nadie ha pedido lugar en tus viajes todavía.'))
    }
    for (const solicitud of recibidas) listaRecibidas.append(dibujarRecibida(solicitud))

    if (enviadas.length === 0) {
        listaEnviadas.append(crear('li', 'coincidencia-detalle', 'No has pedido lugar en ningún viaje.'))
    }
    for (const solicitud of enviadas) listaEnviadas.append(dibujarEnviada(solicitud))
}


// ----------------------------------------------------------
// Parte común de las dos tarjetas: nombre + estado, y los datos del viaje
// ----------------------------------------------------------
function dibujarBase(solicitud, nombre) {
    const elemento = crear('li', 'coincidencia')
    const encabezado = crear('div', 'coincidencia-encabezado')
    encabezado.append(
        crear('h3', 'coincidencia-nombre', nombre),
        crear('span', 'coincidencia-puntaje', NOMBRES_ESTADO[solicitud.estado] ?? solicitud.estado),
    )
    elemento.append(
        encabezado,
        crear('p', 'coincidencia-detalle',
            `${nombreDia(solicitud.dia)} · ${NOMBRES_TRAMO[solicitud.tramo] ?? solicitud.tramo} · ${solicitud.hora}`),
        crear('p', 'coincidencia-detalle', `Punto: ${nombrePunto(solicitud.puntoId)}`),
    )
    return elemento
}


// Tarjeta de una solicitud que RECIBISTE (eres el conductor)
function dibujarRecibida(solicitud) {
    const elemento = dibujarBase(solicitud, `${solicitud.pasajeroNombre} quiere ir contigo`)

    if (solicitud.estado === 'aceptada') {
        elemento.append(botonWhatsApp(solicitud, true))
    }
    if (solicitud.estado === 'pendiente') {
        const botonAceptar = crear('button', 'boton boton-principal', 'Aceptar')
        botonAceptar.type = 'button'
        botonAceptar.addEventListener('click', () => responder(solicitud, 'aceptada'))

        const botonRechazar = crear('button', 'boton-enlace', 'Rechazar')
        botonRechazar.type = 'button'
        botonRechazar.addEventListener('click', () => responder(solicitud, 'rechazada'))

        elemento.append(botonAceptar, botonRechazar)
    }
    return elemento
}


// Tarjeta de una solicitud que ENVIASTE (eres el pasajero)
function dibujarEnviada(solicitud) {
    const elemento = dibujarBase(solicitud, `Viaje de ${solicitud.conductorNombre}`)

    if (solicitud.estado === 'aceptada') {
        elemento.append(crear('p', 'coincidencia-detalle', 'Te aceptaron. Llega al punto de encuentro a tiempo.'))
        elemento.append(botonWhatsApp(solicitud, false))
    }
    if (solicitud.estado !== 'rechazada') {
        const botonCancelar = crear('button', 'boton-enlace', 'Cancelar solicitud')
        botonCancelar.type = 'button'
        botonCancelar.addEventListener('click', () => cancelar(solicitud))
        elemento.append(botonCancelar)
    }
    return elemento
}


// ----------------------------------------------------------
// Botón "Avisar por WhatsApp" (solo en solicitudes aceptadas)
// La app NO guarda teléfonos: wa.me/?text=... abre WhatsApp con el
// mensaje ya escrito y TÚ eliges a quién mandarlo.
// soyConductor = true si la tarjeta es de una solicitud que recibiste.
// ----------------------------------------------------------
function botonWhatsApp(solicitud, soyConductor) {
    const telefono = soyConductor ? solicitud.pasajeroTelefono : solicitud.conductorTelefono
    const otroNombre = soyConductor ? solicitud.pasajeroNombre : solicitud.conductorNombre
    const boton = crear('button', 'boton boton-secundario', telefono ? `Escribir a ${otroNombre} por WhatsApp` : 'Avisar por WhatsApp')
    boton.addEventListener('click', () => {
        const detalle = `${nombreDia(solicitud.dia).toLowerCase()} `
            + `(${(NOMBRES_TRAMO[solicitud.tramo] ?? solicitud.tramo).toLowerCase()}) a las ${solicitud.hora}, `
            + `punto de encuentro: ${nombrePunto(solicitud.puntoId)}.`
        const texto = soyConductor
            ? `Carpool UVG: hola ${solicitud.pasajeroNombre}, te acepté en mi viaje del ${detalle}`
            : `Carpool UVG: hola ${solicitud.conductorNombre}, gracias por aceptarme en tu viaje del ${detalle}`
        // encodeURIComponent cambia espacios, tildes y : por códigos que sí caben en un link
        // Con número: abre el chat de la otra persona (502 = Guatemala). Sin número se da a elegir
        const destino = telefono ? `https://wa.me/502${telefono}` : 'https://wa.me/'
        window.open(`${destino}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
    })
    return boton
}


// ----------------------------------------------------------
// El conductor acepta o rechaza.
// Antes de aceptar revisamos que el viaje exista y que queden lugares:
// aceptadas de ESE viaje < cupos del viaje.
// ----------------------------------------------------------
async function responder(solicitud, nuevoEstado) {
    try {
        if (nuevoEstado === 'aceptada') {
            const viaje = await getDoc(doc(db, 'viajes', solicitud.viajeId))
            if (!viaje.exists()) {
                mensaje.textContent = 'Ese viaje ya fue borrado.'
                return
            }
            const aceptadas = recibidas.filter((otra) =>
                otra.viajeId === solicitud.viajeId && otra.estado === 'aceptada').length
            if (aceptadas >= viaje.data().cupos) {
                mensaje.textContent = 'Ya no te quedan lugares en ese viaje.'
                return
            }
        }
        // updateDoc cambia SOLO los campos que le pasas; lo demás queda igual
        const cambios = { estado: nuevoEstado }
        // Al aceptar, le pasamos tu número al pasajero (solo él y tú pueden leer la solicitud)
        if (nuevoEstado === 'aceptada' && miTelefono) cambios.conductorTelefono = miTelefono
        await updateDoc(doc(db, 'solicitudes', solicitud.id), cambios)
        mensaje.textContent = nuevoEstado === 'aceptada'
            ? `Aceptaste a ${solicitud.pasajeroNombre}.`
            : `Rechazaste a ${solicitud.pasajeroNombre}.`
        await cargarSolicitudes()
    } catch (problema) {
        console.error(problema)
        mensaje.textContent = 'No se pudo responder la solicitud.'
    }
}


// El pasajero cancela su solicitud (se borra)
async function cancelar(solicitud) {
    if (!confirm('¿Cancelar esta solicitud?')) return
    try {
        await deleteDoc(doc(db, 'solicitudes', solicitud.id))
        mensaje.textContent = 'Solicitud cancelada.'
        await cargarSolicitudes()
    } catch (problema) {
        console.error(problema)
        mensaje.textContent = 'No se pudo cancelar la solicitud.'
    }
}

function limpiarTelefono(texto) {
    let numero = texto.replace(/\D/g, '')   // \D = todo lo que NO es dígito (espacios, guiones, +)
    if (numero.length === 11 && numero.startsWith('502')) numero = numero.slice(3)
    return numero
}

async function cargarMiTelefono() {
    try {
        const documento = await getDoc(doc(db, 'contactos', auth.currentUser.uid))
        if (documento.exists()) miTelefono = documento.data().telefono
    } catch (problema) {
        console.warn('No se pudo leer tu WhatsApp', problema)
    }
    inputWhatsApp.value = miTelefono
    botonGuardarWhatsApp.disabled = false
}

async function guardarTelefono(evento) {
    evento.preventDefault()   // sin esto, el formulario recarga la página
    const numero = limpiarTelefono(inputWhatsApp.value)
    if (!/^[0-9]{8}$/.test(numero)) { //expresión en regex
        mensaje.textContent = 'Escribe tu número de WhatsApp de 8 dígitos (por ejemplo 5555 1234).'
        return
    }
    try {
        await setDoc(doc(db, 'contactos', auth.currentUser.uid), { telefono: numero })
        miTelefono = numero
        inputWhatsApp.value = numero
        mensaje.textContent = 'Número guardado. Solo lo verá quien comparta un viaje contigo.'
    } catch (problema) {
        console.error(problema)
        mensaje.textContent = problema.code === 'permission-denied'
            ? 'Firebase no dejó guardar el número. Revisa que las reglas nuevas estén publicadas.'
            : 'No se pudo guardar el número. Revisa tu internet.'
    }
}

// ---------- Arranque ----------
//Los que reciben los eventos antes de los awaits
document.addEventListener('perfil-listo', (evento) => {
    miPerfil = evento.detail
})
document.addEventListener('solicitar-viaje', (evento) => {
    solicitar(evento.detail)
})

formWhatsApp.addEventListener('submit', guardarTelefono)

mensaje.textContent = 'Cargando solicitudes...'

//Se revisa la identidad del usuario antes de comenzar
await auth.authStateReady()
puntos = await leerJSON('data/puntos-encuentro.json', [])
await cargarMiTelefono()
await cargarSolicitudes()
mensaje.textContent = ''