// ==========================================================
// emergencia.js — piezas de seguridad que usan VARIAS páginas
// (seguridad.js en app.html y sos.js en todas).
//
//   leerContacto()        Tu contacto de emergencia (o null si no tienes).
//   guardarContacto(c)    Lo guarda en Firestore.
//   limpiarTelefono(t)    "+502 5555-1234" -> "55551234"
//   enlaceWhatsApp(...)   Link de WhatsApp con el mensaje ya escrito.
//   enlaceSMS(...)        Link de SMS (sirve aunque no tengas datos).
//   enlaceMapa(ubicacion) Link de Google Maps a unas coordenadas.
//   vigilarUbicacion(f)   Busca tu ubicación y llama a f cada vez que mejora.
//   explicarErrorUbicacion(e) Por qué no se pudo, en español.
//   obtenerUbicacion()    Tu ubicación actual (una vez), o null si no se pudo.
//   abrirConEspera(p)     Abre una pestaña YA y le pone el link cuando esté listo.
//   estado.viajeEnCurso   El viaje que estás haciendo ahora (lo llena seguridad.js).
//
// Forma en Firestore (las reglas dejan que SOLO tú lo leas):
//   emergencia/{uid} = { nombre: 'Mamá', telefono: '55551234' }
// ==========================================================

import { auth, db } from './firebase-config.js'
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'

// Un módulo se carga UNA vez por página: si seguridad.js y sos.js importan
// "estado", los dos ven el MISMO objeto. Así se pasan el viaje en curso.
export const estado = { viajeEnCurso: null }

// undefined = todavía no lo buscamos; null = lo buscamos y no tiene
let contactoGuardado


export async function leerContacto() {
    if (contactoGuardado !== undefined) return contactoGuardado
    await auth.authStateReady()
    if (!auth.currentUser) return null
    try {
        const documento = await getDoc(doc(db, 'emergencia', auth.currentUser.uid))
        contactoGuardado = documento.exists() ? documento.data() : null
    } catch (problema) {
        console.warn('No se pudo leer el contacto de emergencia', problema)
        return null   // no lo guardamos en memoria: la próxima vez lo intenta otra vez
    }
    return contactoGuardado
}


export async function guardarContacto(contacto) {
    await setDoc(doc(db, 'emergencia', auth.currentUser.uid), contacto)
    contactoGuardado = contacto
    // Avisamos a la página por si otro archivo está mostrando el contacto
    document.dispatchEvent(new CustomEvent('contacto-emergencia', { detail: contacto }))
}


// Igual que en solicitudes.js: deja solo los 8 dígitos
export function limpiarTelefono(texto) {
    let numero = texto.replace(/\D/g, '')   // \D = todo lo que NO es dígito
    if (numero.length === 11 && numero.startsWith('502')) numero = numero.slice(3)
    return numero
}


export function enlaceWhatsApp(telefono, texto) {
    return `https://wa.me/502${telefono}?text=${encodeURIComponent(texto)}`
}

export function enlaceSMS(telefono, texto) {
    return `sms:+502${telefono}?body=${encodeURIComponent(texto)}`
}

export function enlaceMapa(ubicacion) {
    return `https://maps.google.com/?q=${ubicacion.lat},${ubicacion.lng}`
}


// ----------------------------------------------------------
// Ubicación
// Pedimos la ubicación de DOS formas a la vez:
//   1. Rápida (enableHighAccuracy: false): usa el WiFi y las antenas.
//      Llega en 1 o 2 segundos, aunque sea menos exacta.
//   2. Exacta (watchPosition + GPS): tarda más, sobre todo adentro de un
//      edificio o en computadora, pero va mejorando mientras esperas.
// Cada vez que llega una MEJOR ubicación, llamamos a alCambiar.
// Devuelve una función para dejar de vigilar (ahorra batería).
// ----------------------------------------------------------
export function vigilarUbicacion(alCambiar) {
    // Los navegadores solo dan la ubicación en páginas https (o localhost)
    if (!window.isSecureContext) {
        alCambiar({ error: 'inseguro' })
        return () => {}
    }
    if (!('geolocation' in navigator)) {
        alCambiar({ error: 'sin-gps' })
        return () => {}
    }

    let mejor = null
    function guardar(posicion) {
        const nueva = {
            lat: posicion.coords.latitude.toFixed(5),
            lng: posicion.coords.longitude.toFixed(5),
            precision: Math.round(posicion.coords.accuracy),   // en metros
        }
        // Solo avisamos si es más exacta que la que ya teníamos
        if (!mejor || nueva.precision <= mejor.precision) {
            mejor = nueva
            alCambiar({ ubicacion: mejor })
        }
    }
    function fallo(error) {
        // Si ya tenemos una ubicación, un error del otro intento no importa
        if (!mejor) alCambiar({ error: error.code })
    }

    navigator.geolocation.getCurrentPosition(guardar, fallo,
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 })
    const idVigilancia = navigator.geolocation.watchPosition(guardar, fallo,
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 })
    return () => navigator.geolocation.clearWatch(idVigilancia)
}


// Explica en español por qué no se pudo (error.code del navegador)
export function explicarErrorUbicacion(error) {
    const textos = {
        inseguro: 'La ubicación solo funciona con https (la página publicada en GitHub). '
            + 'Si la abriste con una dirección tipo http://192.168..., el navegador no la da.',
        'sin-gps': 'Este navegador no puede dar la ubicación.',
        1: 'Esta página no tiene permiso de ubicación. Toca el candado de la barra de direcciones > Ubicación > Permitir, y vuelve a abrir el SOS.',
        2: 'La ubicación del aparato está apagada. Actívala en la configuración del celular '
            + '(en Windows: Configuración > Privacidad y seguridad > Ubicación).',
        3: 'Tardó demasiado en encontrar tu ubicación. Sigue intentando en segundo plano.',
    }
    return textos[error] ?? 'No se pudo obtener tu ubicación.'
}


// Versión de una sola vez (la usa seguridad.js al avisar que sales).
// Nunca falla: si no llega nada en "esperaMaxima" ms, devuelve null.
export function obtenerUbicacion(esperaMaxima = 10000) {
    return new Promise((resolve) => {
        let terminado = false
        let detener = () => {}
        const terminar = (valor) => {
            if (terminado) return
            terminado = true
            detener()
            resolve(valor)
        }
        // La primera ubicación que llegue nos sirve
        detener = vigilarUbicacion(({ ubicacion }) => {
            if (ubicacion) terminar(ubicacion)
        })
        setTimeout(() => terminar(null), esperaMaxima)
    })
}


// Los navegadores bloquean window.open si NO pasa justo al tocar un botón.
// Si primero esperamos la ubicación (await) y DESPUÉS abrimos, lo bloquean.
// Truco: abrimos la pestaña vacía al instante y le ponemos el link cuando esté listo.
export function abrirConEspera(promesaDelLink) {
    const ventana = window.open('', '_blank')
    if (ventana) ventana.opener = null   // la pestaña nueva no puede tocar nuestra página
    promesaDelLink.then((link) => {
        if (ventana) ventana.location.href = link
        else window.location.href = link   // si igual la bloquearon, lo abrimos aquí mismo
    })
}
