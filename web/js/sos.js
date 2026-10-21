// ==========================================================
// sos.js — botón rojo de emergencia. Sale en TODAS las páginas con sesión.
//
// No necesita HTML: este archivo crea el botón y el panel. Para ponerlo
// en una página basta con: <script type="module" src="js/sos.js"></script>
//
// Al tocar SOS se abre un panel (<dialog>) con tres opciones:
//   1. Llamar a la PNC (110)
//   2. Escribir a tu contacto (WhatsApp, o SMS si no tienes datos)
//   3. Las dos: primero le escribe a tu contacto y luego te deja
//      el botón de llamar a la PNC grande, listo para tocar.
// Al abrirlo empieza a buscar tu ubicación para mandarla en el mensaje.
//
// Guatemala NO tiene 911: cada servicio tiene su número.
// La página no puede mandar mensajes sola (no tenemos servidor): abre
// WhatsApp o SMS con el mensaje ya escrito y tú solo tocas "Enviar".
// ==========================================================

import { auth } from './firebase-config.js'
import {
    leerContacto, enlaceWhatsApp, enlaceSMS, enlaceMapa, vigilarUbicacion,
    explicarErrorUbicacion, abrirConEspera, estado,
} from './emergencia.js'

const OTROS_NUMEROS = [
    { numero: '122', nombre: 'Bomberos Voluntarios' },
    { numero: '123', nombre: 'Bomberos Municipales' },
    { numero: '125', nombre: 'Cruz Roja' },
]

const ESPERA_UBICACION = 6000   // si tocas "Escribir" antes de tenerla, la esperamos hasta 6 s

let ubicacion = null
let errorUbicacion = null       // por qué no se pudo (si no se pudo)
let contacto = null
let dejarDeVigilar = () => {}
let esperando = []              // funciones que quieren saber cuando llegue la ubicación


function crear(etiqueta, clase, texto) {
    const elemento = document.createElement(etiqueta)
    if (clase) elemento.className = clase
    if (texto !== undefined) elemento.textContent = texto
    return elemento
}

function crearBoton(clase, texto) {
    const boton = crear('button', clase, texto)
    boton.type = 'button'
    return boton
}


// ---------- Crear el botón y el panel ----------
const botonSOS = crearBoton('boton-sos', 'SOS')
botonSOS.setAttribute('aria-label', 'Emergencia: abrir opciones de SOS')

const panel = crear('dialog', 'panel-sos')
panel.setAttribute('aria-labelledby', 'sos-titulo')

const titulo = crear('h2', '', 'Emergencia')
titulo.id = 'sos-titulo'
const pregunta = crear('p', 'sos-pregunta', '¿Qué quieres hacer?')
const estadoUbicacion = crear('p', 'sos-ubicacion')
estadoUbicacion.setAttribute('aria-live', 'polite')
const botonReintentar = crearBoton('boton-enlace', 'Buscar mi ubicación otra vez')
botonReintentar.hidden = true

// <a href="tel:110"> abre la app de llamadas del celular con el número puesto
const llamarPNC = crear('a', 'boton boton-sos-llamar', 'Llamar a la PNC (110)')
llamarPNC.href = 'tel:110'

const botonEscribir = crearBoton('boton boton-sos-contacto', 'Escribir a mi contacto')
const botonAmbas = crearBoton('boton boton-sos-ambas', 'Las dos: escribir y llamar a la PNC')
const botonSMS = crearBoton('boton-enlace', '¿Sin datos? Mándalo por SMS')
const sinContacto = crear('p', 'sos-nota')

// Paso 2 de "Las dos": aparece después de abrir WhatsApp
const pasoLlamar = crear('p', 'sos-paso')
pasoLlamar.hidden = true

const otros = crear('ul', 'sos-otros')
for (const servicio of OTROS_NUMEROS) {
    const item = crear('li')
    const enlace = crear('a', '', `${servicio.nombre}: ${servicio.numero}`)
    enlace.href = `tel:${servicio.numero}`
    item.append(enlace)
    otros.append(item)
}

const botonCerrar = crearBoton('boton-enlace', 'Cerrar')

const acciones = crear('div', 'sos-acciones')
acciones.append(pasoLlamar, llamarPNC, botonEscribir, botonAmbas, botonSMS, sinContacto)

// "interior" lleva el relleno. Así, si tocas FUERA de él, el click cae
// en el <dialog> mismo (lo oscuro) y sabemos que hay que cerrarlo.
const interior = crear('div', 'sos-interior')
interior.append(titulo, pregunta, estadoUbicacion, botonReintentar, acciones, crear('h3', '', 'Otros números'), otros, botonCerrar)
panel.append(interior)
document.body.append(botonSOS, panel)


// ---------- El mensaje de SOS ----------
function textoSOS() {
    const nombre = auth.currentUser?.displayName ?? 'Un estudiante'
    const hora = new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })
    let texto = `SOS - Carpool UVG. ${nombre} necesita ayuda (${hora}).`
    texto += ubicacion
        ? ` Ubicación: ${enlaceMapa(ubicacion)} (precisión aprox. ${ubicacion.precision} m).`
        : ' No se pudo obtener su ubicación.'
    if (estado.viajeEnCurso) texto += ` Viaje: ${estado.viajeEnCurso}`
    return texto
}

// Espera a que llegue la ubicación (máximo ESPERA_UBICACION ms).
// Si ya la tenemos, sigue de inmediato.
function esperarUbicacion() {
    // Ya la tenemos, o ya sabemos que no va a llegar (sin permiso, apagada...)
    if (ubicacion || (errorUbicacion !== null && errorUbicacion !== 3)) return Promise.resolve()
    return new Promise((resolve) => {
        esperando.push(resolve)
        setTimeout(resolve, ESPERA_UBICACION)
    })
}

function escribirAlContacto() {
    if (ubicacion) {
        window.open(enlaceWhatsApp(contacto.telefono, textoSOS()), '_blank', 'noopener')
        return
    }
    // Todavía no llega: abrimos la pestaña ya y le ponemos el link al tenerla
    if (errorUbicacion === null) estadoUbicacion.textContent = 'Esperando tu ubicación para ponerla en el mensaje...'
    abrirConEspera(esperarUbicacion().then(() => enlaceWhatsApp(contacto.telefono, textoSOS())))
}


// ---------- Buscar la ubicación mientras el panel está abierto ----------
// Despierta a los que estaban esperando la ubicación
function despertarEsperando() {
    for (const avisar of esperando) avisar()
    esperando = []
}

function buscarUbicacion() {
    dejarDeVigilar()
    errorUbicacion = null
    botonReintentar.hidden = true
    estadoUbicacion.textContent = 'Buscando tu ubicación...'
    dejarDeVigilar = vigilarUbicacion(({ ubicacion: nueva, error }) => {
        if (nueva) {
            ubicacion = nueva
            errorUbicacion = null
            estadoUbicacion.textContent = `Ubicación lista (precisión aprox. ${nueva.precision} m). Va en el mensaje.`
            botonReintentar.hidden = true
            despertarEsperando()
            return
        }
        errorUbicacion = error
        estadoUbicacion.textContent = explicarErrorUbicacion(error)
        // Si no va a llegar, no tiene caso esperar: el mensaje sale sin ubicación
        if (error !== 3) despertarEsperando()
        botonReintentar.hidden = error === 3   // en "tardó mucho" sigue buscando solo
        console.warn('Ubicación del SOS: error', error)
    })
}


// ---------- Abrir el panel ----------
async function abrirPanel() {
    pasoLlamar.hidden = true
    llamarPNC.classList.remove('resaltado')
    panel.showModal()   // showModal = encima de todo y bloquea lo de atrás

    // Ubicación: la buscamos al abrir para tenerla lista al tocar un botón.
    // Borramos la de la vez pasada: puede que ya te hayas movido.
    ubicacion = null
    buscarUbicacion()

    contacto = await leerContacto()
    // Sin contacto solo queda llamar
    botonEscribir.hidden = !contacto
    botonAmbas.hidden = !contacto
    botonSMS.hidden = !contacto
    if (contacto) {
        botonEscribir.textContent = `Escribir a ${contacto.nombre}`
        botonAmbas.textContent = `Las dos: escribir a ${contacto.nombre} y llamar a la PNC`
        sinContacto.textContent = ''
    } else {
        sinContacto.textContent = 'No tienes contacto de emergencia. Agrégalo en Mi panel, sección Seguridad.'
    }
}

botonSOS.addEventListener('click', abrirPanel)
botonReintentar.addEventListener('click', buscarUbicacion)
botonCerrar.addEventListener('click', () => panel.close())
// Al cerrar el panel (por cualquier lado) dejamos de usar el GPS
panel.addEventListener('close', () => dejarDeVigilar())
// Tocar fuera del panel (en lo oscuro) también lo cierra
panel.addEventListener('click', (evento) => {
    if (evento.target === panel) panel.close()
})

botonEscribir.addEventListener('click', escribirAlContacto)

// "Las dos": no se pueden abrir WhatsApp y la llamada al mismo tiempo
// (una tapa a la otra). Primero WhatsApp; al regresar, el botón de llamar
// queda arriba y resaltado.
botonAmbas.addEventListener('click', () => {
    escribirAlContacto()
    pasoLlamar.textContent = `Ya abrimos WhatsApp para ${contacto.nombre}. Envía el mensaje y luego llama:`
    pasoLlamar.hidden = false
    llamarPNC.classList.add('resaltado')
    llamarPNC.focus()
})

botonSMS.addEventListener('click', async () => {
    await esperarUbicacion()   // aquí no hay problema en esperar: no abre pestaña nueva
    window.location.href = enlaceSMS(contacto.telefono, textoSOS())
})
