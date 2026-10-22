// ==========================================================
// seguridad.js — sección "Seguridad" y aviso "Tu próximo viaje" de app.html
//
// Lo que hace:
//   1. Contacto de emergencia: formulario de nombre + teléfono.
//   2. Tiempo real: onSnapshot "escucha" Firestore. Cada vez que algo cambia
//      (te aceptan, alguien te pide lugar, publicas o borras un viaje)
//      Firebase llama a nuestra función SOLA, sin recargar la página.
//   3. Mis próximos viajes con cuenta regresiva (se actualiza cada 30 s).
//   4. Cuando faltan 30 min o menos sale el aviso de arriba con
//      "Avisar a mi contacto e iniciar viaje". Ya en camino:
//      "Llegué bien" (le avisa a tu contacto) o "Terminar viaje".
//      Al iniciar te sugiere compartir tu ubicación EN TIEMPO REAL con tu
//      contacto usando la función de WhatsApp (sigue funcionando aunque
//      cierres la página o bloquees el celular; una página web no puede).
//   5. Avisos del navegador (Notification). OJO: solo funcionan con la
//      página abierta (aunque sea en otra pestaña). Para avisos con la app
//      cerrada haría falta un servidor (Cloud Functions), y no tenemos.
//
// Los viajes son semanales: "lunes 07:15" se repite cada lunes.
// ==========================================================

import { auth, db } from './firebase-config.js'
import {
    collection, query, where, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'
import { DIAS } from './matching.js'
import {
    leerContacto, guardarContacto, limpiarTelefono,
    enlaceWhatsApp, enlaceMapa, obtenerUbicacion, abrirConEspera, estado,
} from './emergencia.js'

const AVISO_MINUTOS = 30       // cuánto antes sale el aviso de arriba
const DURACION_MINUTOS = 90    // cuánto tiempo después de la hora el viaje sigue "en curso"
const NOMBRES_TRAMO = { ida: 'Ida a la UVG', regreso: 'Regreso a casa' }
// getDay() de JavaScript: 0 = domingo, 1 = lunes ... 6 = sábado
const NUMERO_DIA = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5 }

// ---------- Elementos de la página ----------
const formContacto = document.getElementById('form-emergencia')
const inputNombre = document.getElementById('emergencia-nombre')
const inputTelefono = document.getElementById('emergencia-telefono')
const botonGuardar = document.getElementById('emergencia-guardar')
const mensaje = document.getElementById('seguridad-mensaje')
const botonAvisos = document.getElementById('activar-avisos')
const listaProximos = document.getElementById('lista-proximos')

const aviso = document.getElementById('proximo-viaje')
const avisoTitulo = document.getElementById('proximo-titulo')
const avisoCuenta = document.getElementById('proximo-cuenta')
const avisoDetalle = document.getElementById('proximo-detalle')
const avisoBotones = document.getElementById('proximo-botones')
const avisoMensaje = document.getElementById('proximo-mensaje')
const sugerencia = document.getElementById('sugerencia-ubicacion')
const sugerenciaTexto = document.getElementById('sugerencia-texto')
const sugerenciaBotones = document.getElementById('sugerencia-botones')

const contenedorToasts = document.getElementById('avisos-en-vivo')

// ---------- Datos ----------
let puntos = []
let contacto = null
let misViajes = []          // viajes que YO publiqué (soy conductor)
let recibidas = []          // solicitudes a mis viajes
let enviadas = []           // solicitudes que yo mandé
const yaAvisados = new Set()   // para no repetir "tu viaje empieza pronto"
let claveDelAviso = ''         // qué viaje y qué estado tiene dibujado el aviso


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
function buscarPunto(idPunto) {
    return puntos.find((punto) => punto.id === idPunto) ?? null
}


// ==========================================================
// 1. Contacto de emergencia
// ==========================================================
async function cargarContacto() {
    contacto = await leerContacto()
    if (contacto) {
        inputNombre.value = contacto.nombre
        inputTelefono.value = contacto.telefono
    }
    botonGuardar.disabled = false
}

async function guardar(evento) {
    evento.preventDefault()   // sin esto, el formulario recarga la página
    const nombre = inputNombre.value.trim()
    const telefono = limpiarTelefono(inputTelefono.value)

    if (nombre.length === 0 || nombre.length > 60) {
        mensaje.textContent = 'Escribe el nombre de tu contacto (por ejemplo "Mamá").'
        inputNombre.focus()
        return
    }
    if (!/^[0-9]{8}$/.test(telefono)) {
        mensaje.textContent = 'El teléfono debe tener 8 dígitos (por ejemplo 5555 1234).'
        inputTelefono.focus()
        return
    }

    botonGuardar.disabled = true
    mensaje.textContent = 'Guardando...'
    try {
        await guardarContacto({ nombre, telefono })
        contacto = { nombre, telefono }
        inputTelefono.value = telefono
        mensaje.textContent = `Listo: ${nombre} es tu contacto de emergencia. Solo tú puedes ver este dato.`
        claveDelAviso = ''   // para que el aviso de arriba se vuelva a dibujar con el nombre
        actualizar()
    } catch (problema) {
        console.error(problema)
        mensaje.textContent = problema.code === 'permission-denied'
            ? 'Firebase no dejó guardar. Revisa que las reglas nuevas estén publicadas.'
            : 'No se pudo guardar. Revisa tu internet.'
    } finally {
        botonGuardar.disabled = false
    }
}


// ==========================================================
// 2. Avisos: un cuadrito en la página + notificación del navegador
// ==========================================================
function avisar(texto) {
    // Cuadrito ("toast") abajo de la pantalla que se quita solo en 8 s
    const toast = crear('p', 'toast', texto)
    contenedorToasts.append(toast)
    setTimeout(() => toast.remove(), 8000)

    // Notificación del sistema, solo si diste permiso
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Carpool UVG', { body: texto })
    }
}

function prepararBotonAvisos() {
    if (!('Notification' in window)) {
        botonAvisos.hidden = true   // este navegador no tiene notificaciones
        return
    }
    const textos = {
        granted: 'Avisos activados',
        denied: 'Avisos bloqueados (actívalos en el candado de la barra de direcciones)',
        default: 'Activar avisos del navegador',
    }
    botonAvisos.textContent = textos[Notification.permission]
    botonAvisos.disabled = Notification.permission !== 'default'
}

async function pedirPermiso() {
    await Notification.requestPermission()
    prepararBotonAvisos()
    if (Notification.permission === 'granted') avisar('Listo, te avisaremos de tus viajes.')
}


// ==========================================================
// 3. Tiempo real con onSnapshot
// onSnapshot(consulta, funcion) llama a "funcion" una vez al inicio
// y otra vez CADA vez que cambia algo. docChanges() dice qué cambió.
// ==========================================================
function escucharFirestore(uid) {
    const solicitudes = collection(db, 'solicitudes')
    // La primera respuesta trae TODO lo que ya existía: eso no es "nuevo",
    // así que no avisamos nada hasta la segunda.
    const primeraVez = { recibidas: true, enviadas: true }

    onSnapshot(query(collection(db, 'viajes'), where('conductorUid', '==', uid)), (resultado) => {
        misViajes = resultado.docs.map((documento) => ({ id: documento.id, ...documento.data() }))
        actualizar()
    }, (problema) => console.warn('No se pudieron escuchar tus viajes', problema))

    onSnapshot(query(solicitudes, where('conductorUid', '==', uid)), (resultado) => {
        if (!primeraVez.recibidas) {
            for (const cambio of resultado.docChanges()) {
                const solicitud = cambio.doc.data()
                if (cambio.type === 'added' && solicitud.estado === 'pendiente') {
                    avisar(`${solicitud.pasajeroNombre} pidió lugar en tu viaje del ${nombreDia(solicitud.dia).toLowerCase()} a las ${solicitud.hora}.`)
                }
                if (cambio.type === 'removed') {
                    avisar(`${solicitud.pasajeroNombre} canceló su solicitud.`)
                }
            }
            document.dispatchEvent(new CustomEvent('solicitudes-cambiaron'))
        }
        primeraVez.recibidas = false
        recibidas = resultado.docs.map((documento) => ({ id: documento.id, ...documento.data() }))
        actualizar()
    }, (problema) => console.warn('No se pudieron escuchar las solicitudes', problema))

    onSnapshot(query(solicitudes, where('pasajeroUid', '==', uid)), (resultado) => {
        if (!primeraVez.enviadas) {
            for (const cambio of resultado.docChanges()) {
                const solicitud = cambio.doc.data()
                if (cambio.type === 'modified' && solicitud.estado === 'aceptada') {
                    avisar(`${solicitud.conductorNombre} te aceptó en su viaje del ${nombreDia(solicitud.dia).toLowerCase()} a las ${solicitud.hora}.`)
                }
                if (cambio.type === 'modified' && solicitud.estado === 'rechazada') {
                    avisar(`${solicitud.conductorNombre} no pudo aceptarte esta vez.`)
                }
            }
            document.dispatchEvent(new CustomEvent('solicitudes-cambiaron'))
        }
        primeraVez.enviadas = false
        enviadas = resultado.docs.map((documento) => ({ id: documento.id, ...documento.data() }))
        actualizar()
    }, (problema) => console.warn('No se pudieron escuchar tus solicitudes', problema))
}


// ==========================================================
// 4. Calcular mis próximos viajes
// ==========================================================

// ¿Cuándo es la próxima vez que pasa "lunes 07:15"?
function proximaFecha(dia, hora, ahora) {
    const [horas, minutos] = hora.split(':').map(Number)
    const fecha = new Date(ahora)
    fecha.setHours(horas, minutos, 0, 0)
    // % 7 hace que el resultado quede entre 0 y 6 (0 = hoy)
    const diasQueFaltan = (NUMERO_DIA[dia] - ahora.getDay() + 7) % 7
    fecha.setDate(fecha.getDate() + diasQueFaltan)
    // Si es hoy pero ya terminó, toca el de la otra semana
    if (fecha.getTime() + DURACION_MINUTOS * 60000 < ahora.getTime()) {
        fecha.setDate(fecha.getDate() + 7)
    }
    return fecha
}

// Junta mis viajes de conductor y de pasajero en una sola lista
function armarProximos(ahora) {
    const lista = []

    for (const viaje of misViajes) {
        const pasajeros = recibidas
            .filter((solicitud) => solicitud.viajeId === viaje.id && solicitud.estado === 'aceptada')
            .map((solicitud) => ({ uid: solicitud.pasajeroUid, nombre: solicitud.pasajeroNombre }))
        lista.push({
            clave: viaje.id, soyConductor: true,
            dia: viaje.dia, tramo: viaje.tramo, hora: viaje.hora, puntoId: viaje.puntoId,
            companeros: pasajeros,
        })
    }

    for (const solicitud of enviadas) {
        if (solicitud.estado !== 'aceptada') continue
        lista.push({
            clave: solicitud.viajeId, soyConductor: false,
            dia: solicitud.dia, tramo: solicitud.tramo, hora: solicitud.hora, puntoId: solicitud.puntoId,
            companeros: [{ uid: solicitud.conductorUid, nombre: solicitud.conductorNombre }],
        })
    }

    for (const viaje of lista) {
        viaje.fecha = proximaFecha(viaje.dia, viaje.hora, ahora)
        viaje.faltaMs = viaje.fecha - ahora   // restar fechas da milisegundos
        // La clave cambia cada semana: el progreso del lunes pasado no cuenta
        viaje.claveSemana = `${viaje.clave}-${viaje.fecha.toISOString().slice(0, 10)}`
    }
    return lista.sort((a, b) => a.fecha - b.fecha)
}

function textoFalta(milisegundos) {
    if (milisegundos <= 0) return 'Ya es hora'
    const minutosTotales = Math.ceil(milisegundos / 60000)
    const dias = Math.floor(minutosTotales / 1440)          // 1440 min = 1 día
    const horas = Math.floor((minutosTotales % 1440) / 60)
    const minutos = minutosTotales % 60
    if (dias > 0) return `En ${dias} d ${horas} h`
    if (horas > 0) return `En ${horas} h ${minutos} min`
    return `En ${minutos} min`
}

function textoCompaneros(viaje) {
    if (viaje.companeros.length === 0) return 'Todavía nadie se ha unido'
    const nombres = viaje.companeros.map((persona) => persona.nombre).join(', ')
    return viaje.soyConductor ? `Pasajeros: ${nombres}` : `Conductor: ${nombres}`
}

// conMapa = true agrega el link de Google Maps del punto (para los mensajes)
function textoViaje(viaje, conMapa = true) {
    const punto = buscarPunto(viaje.puntoId)
    return `${NOMBRES_TRAMO[viaje.tramo] ?? viaje.tramo}, ${nombreDia(viaje.dia).toLowerCase()} a las ${viaje.hora}. `
        + `${viaje.soyConductor ? 'Yo manejo. ' : ''}${textoCompaneros(viaje)}. `
        + `Punto de encuentro: ${punto?.nombre ?? 'sin nombre'}`
        + (punto && conMapa ? ` (${enlaceMapa(punto)})` : '') + '.'
}


// ==========================================================
// 5. Progreso del viaje: "iniciado" o "terminado".
// Se guarda en localStorage (memoria de ESTE navegador). Va con try/catch
// porque en modo incógnito a veces no deja usarlo.
// ==========================================================
const progresoEnMemoria = {}

function leerProgreso(claveSemana) {
    try {
        return localStorage.getItem(`viaje-${claveSemana}`) ?? progresoEnMemoria[claveSemana] ?? ''
    } catch {
        return progresoEnMemoria[claveSemana] ?? ''
    }
}
function guardarProgreso(claveSemana, valor) {
    progresoEnMemoria[claveSemana] = valor
    try { localStorage.setItem(`viaje-${claveSemana}`, valor) } catch { /* no pasa nada */ }
}


// ==========================================================
// 6. Mensajes para tu contacto
// ==========================================================
function avisarSalida(viaje) {
    const nombre = auth.currentUser.displayName ?? 'Tu contacto'
    // obtenerUbicacion es async: abrirConEspera abre WhatsApp cuando ya la tengamos
    // 4 s como máximo: después el navegador bloquearía la pestaña nueva
    abrirConEspera(obtenerUbicacion(4000).then((ubicacion) => {
        const texto = `Carpool UVG: ${nombre} va a salir en carpool. ${textoViaje(viaje)}`
            + (ubicacion ? ` Ubicación ahora: ${enlaceMapa(ubicacion)} .` : '')
            + ' Te voy a compartir mi ubicación en tiempo real por aquí. Te aviso cuando llegue.'
        return enlaceWhatsApp(contacto.telefono, texto)
    }))
}

function avisarLlegada(viaje) {
    const nombre = auth.currentUser.displayName ?? 'Tu contacto'
    const destino = viaje.tramo === 'ida' ? 'a la UVG' : 'a su destino'
    const texto = `Carpool UVG: ${nombre} ya llegó bien ${destino}.`
    window.open(enlaceWhatsApp(contacto.telefono, texto), '_blank', 'noopener')
}


// Abre el chat con tu contacto (sin texto) para compartir la ubicación
function abrirChatContacto() {
    window.open(`https://wa.me/502${contacto.telefono}`, '_blank', 'noopener')
}

// Sugerencia de "ubicación en tiempo real" mientras el viaje está en curso.
// WhatsApp no deja que una página la active sola: le decimos cómo hacerlo.
function dibujarSugerencia(viaje, progreso) {
    const yaCompartida = leerProgreso(`ubicacion-${viaje.claveSemana}`) === 'si'
    sugerencia.hidden = progreso !== 'iniciado' || yaCompartida
    if (sugerencia.hidden) return

    sugerenciaBotones.replaceChildren()
    if (!contacto) {
        sugerenciaTexto.textContent = 'Comparte tu ubicación en tiempo real con alguien de confianza mientras viajas.'
        return
    }
    sugerenciaTexto.textContent = `Comparte tu ubicación en tiempo real con ${contacto.nombre} mientras viajas. `
        + 'En el chat toca el clip (o + en iPhone) > Ubicación > Compartir ubicación en tiempo real > 1 hora.'
    sugerenciaBotones.append(
        boton(`Abrir chat con ${contacto.nombre}`, 'boton boton-secundario', abrirChatContacto),
        boton('Ya la compartí', 'boton-enlace', () => {
            guardarProgreso(`ubicacion-${viaje.claveSemana}`, 'si')
            sugerencia.hidden = true
        }),
    )
}


// ==========================================================
// 7. Dibujar
// ==========================================================
function boton(texto, clase, alTocar) {
    const elemento = crear('button', clase, texto)
    elemento.type = 'button'
    elemento.addEventListener('click', alTocar)
    return elemento
}

function dibujarProximos(proximos) {
    listaProximos.replaceChildren()
    if (proximos.length === 0) {
        listaProximos.append(crear('li', 'coincidencia-detalle',
            'No tienes viajes. Publica uno o pide lugar en uno y aparecerá aquí.'))
        return
    }
    for (const viaje of proximos.slice(0, 5)) {   // los 5 más cercanos
        const elemento = crear('li', 'coincidencia')
        const encabezado = crear('div', 'coincidencia-encabezado')
        encabezado.append(
            crear('h3', 'coincidencia-nombre',
                `${nombreDia(viaje.dia)} ${viaje.hora} · ${NOMBRES_TRAMO[viaje.tramo] ?? viaje.tramo}`),
            crear('span', 'coincidencia-puntaje', textoFalta(viaje.faltaMs)),
        )
        elemento.append(
            encabezado,
            crear('p', 'coincidencia-detalle', viaje.soyConductor ? 'Tú manejas' : 'Vas de pasajero'),
            crear('p', 'coincidencia-detalle', textoCompaneros(viaje)),
            crear('p', 'coincidencia-detalle', `Punto: ${buscarPunto(viaje.puntoId)?.nombre ?? 'sin nombre'}`),
        )
        // Links al perfil de cada compañero (pestaña Perfiles)
        for (const persona of viaje.companeros) {
            const enlace = crear('a', 'enlace-perfil', `Ver perfil de ${persona.nombre}`)
            enlace.href = `perfiles.html?uid=${encodeURIComponent(persona.uid)}`
            elemento.append(enlace)
        }
        listaProximos.append(elemento)
    }
}

function dibujarAviso(viaje, progreso) {
    // Solo redibujamos los botones si cambió el viaje o su progreso
    // (si no, cada 30 s se borrarían mientras lo estás tocando).
    avisoCuenta.textContent = textoFalta(viaje.faltaMs)
    const clave = `${viaje.claveSemana}-${progreso}-${contacto?.telefono ?? ''}`
    if (clave === claveDelAviso) return
    claveDelAviso = clave

    aviso.hidden = false
    aviso.classList.toggle('en-curso', progreso === 'iniciado')
    dibujarSugerencia(viaje, progreso)
    avisoDetalle.textContent = textoViaje(viaje, false)
    avisoBotones.replaceChildren()
    avisoMensaje.textContent = ''

    if (progreso === 'iniciado') {
        avisoTitulo.textContent = 'Viaje en curso'
        if (contacto) {
            avisoBotones.append(boton(`Llegué bien (avisar a ${contacto.nombre})`, 'boton boton-principal', () => {
                avisarLlegada(viaje)
                guardarProgreso(viaje.claveSemana, 'terminado')
                actualizar()
            }))
        }
        avisoBotones.append(boton('Terminar viaje', 'boton-enlace', () => {
            guardarProgreso(viaje.claveSemana, 'terminado')
            actualizar()
        }))
        return
    }

    // Todavía no empieza: primero le avisas a tu contacto
    avisoTitulo.textContent = viaje.faltaMs > 0 ? 'Tu próximo viaje' : 'Ya es hora de tu viaje'
    if (contacto) {
        avisoBotones.append(boton(`Avisar a ${contacto.nombre} e iniciar viaje`, 'boton boton-principal', () => {
            avisarSalida(viaje)
            guardarProgreso(viaje.claveSemana, 'iniciado')
            actualizar()
        }))
        avisoBotones.append(boton('Iniciar sin avisar', 'boton-enlace', () => {
            guardarProgreso(viaje.claveSemana, 'iniciado')
            actualizar()
        }))
    } else {
        avisoMensaje.textContent = 'Agrega un contacto de emergencia (sección Seguridad) para poder avisarle antes de salir.'
        const enlace = crear('a', 'boton boton-secundario', 'Agregar contacto')
        enlace.href = '#seguridad'
        avisoBotones.append(enlace, boton('Iniciar viaje', 'boton-enlace', () => {
            guardarProgreso(viaje.claveSemana, 'iniciado')
            actualizar()
        }))
    }
}


// ==========================================================
// 8. actualizar(): recalcula todo. La llaman onSnapshot y el reloj.
// ==========================================================
function actualizar() {
    const ahora = new Date()
    const proximos = armarProximos(ahora)
    dibujarProximos(proximos)

    // El viaje del aviso: el primero que ya está cerca (o en curso) y no ha terminado
    const actual = proximos.find((viaje) =>
        viaje.faltaMs <= AVISO_MINUTOS * 60000 && leerProgreso(viaje.claveSemana) !== 'terminado')

    if (!actual) {
        aviso.hidden = true
        claveDelAviso = ''
        estado.viajeEnCurso = null
        return
    }

    const progreso = leerProgreso(actual.claveSemana)
    // sos.js usa esto para decir en el SOS en qué viaje vas
    estado.viajeEnCurso = progreso === 'iniciado' ? textoViaje(actual) : null
    dibujarAviso(actual, progreso)

    // Aviso del navegador UNA vez por viaje
    if (!yaAvisados.has(actual.claveSemana) && actual.faltaMs > 0 && progreso === '') {
        yaAvisados.add(actual.claveSemana)
        avisar(`Tu viaje de las ${actual.hora} empieza ${textoFalta(actual.faltaMs).toLowerCase()}. Avisa a tu contacto antes de salir.`)
    }
}


// ---------- Arranque ----------
formContacto.addEventListener('submit', guardar)
botonAvisos.addEventListener('click', pedirPermiso)
prepararBotonAvisos()

await auth.authStateReady()
if (auth.currentUser) {
    puntos = await leerJSON('data/puntos-encuentro.json', [])
    await cargarContacto()
    escucharFirestore(auth.currentUser.uid)
    setInterval(actualizar, 30000)   // cada 30 s, para la cuenta regresiva
}
