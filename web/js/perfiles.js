// ==========================================================
// perfiles.js — pestaña "Perfiles" (perfiles.html)
//
// Lo que hace:
//   1. Lista a todos los estudiantes con su calificación (estrellas).
//   2. Muestra el perfil de uno: datos, promedio, comentarios y sus viajes.
//      perfiles.html?uid=XXXX abre directo el perfil de esa persona.
//   3. "Califica tus viajes": por cada solicitud ACEPTADA (seas conductor
//      o pasajero) puedes dejarle estrellas y un comentario a la otra persona.
//
// Forma de una reseña en Firestore:
//   resenas/{solicitudId}_{autorUid} = {
//     solicitudId, autorUid, autorNombre, paraUid,
//     estrellas: 1 a 5, comentario: '' (máx. 300 letras),
//     creado: (fecha del servidor), esDemo: false
//   }
// El id junta solicitud + autor: solo UNA reseña por viaje y por persona.
// Las reglas revisan que de verdad hayan compartido ese viaje.
// El promedio NO se guarda: se calcula aquí con todas las reseñas.
// ==========================================================

import { auth, db } from './firebase-config.js'
import {
    collection, doc, getDoc, getDocs, setDoc, updateDoc,
    query, where, onSnapshot, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'
import { DIAS } from './matching.js'
// Promedio y dibujo de estrellas: compartido con viajes.js
import { resumen, estrellas, dibujarRating } from './calificaciones.js'

const NOMBRES_ROL = { conductor: 'Conductor', pasajero: 'Pasajero', ambos: 'Conductor y pasajero' }
const NOMBRES_TRAMO = { ida: 'Ida a la UVG', regreso: 'Regreso a casa' }
const MAXIMO_COMENTARIO = 300

// ---------- Elementos de la página ----------
const detalle = document.getElementById('perfil-detalle')
const detalleNombre = document.getElementById('detalle-nombre')
const detalleDatos = document.getElementById('detalle-datos')
const detalleRating = document.getElementById('detalle-rating')
const listaComentarios = document.getElementById('lista-comentarios')
const listaViajesPerfil = document.getElementById('lista-viajes-perfil')

const listaCalificar = document.getElementById('lista-calificar')
const mensajeCalificar = document.getElementById('calificar-mensaje')

const buscador = document.getElementById('buscar-perfil')
const listaPerfiles = document.getElementById('lista-perfiles')
const mensajePerfiles = document.getElementById('perfiles-mensaje')

// ---------- Datos ----------
let miUid = ''
let miNombre = ''
let usuarios = []
let resenas = []
let viajes = []
let uidElegido = ''


function crear(etiqueta, clase, texto) {
    const elemento = document.createElement(etiqueta)
    if (clase) elemento.className = clase
    if (texto !== undefined) elemento.textContent = texto
    return elemento
}

function nombreDia(idDia) {
    return DIAS.find((dia) => dia.id === idDia)?.nombre ?? idDia
}

// Quita tildes y mayúsculas para buscar: "José" y "jose" son lo mismo
function normalizar(texto) {
    return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}


// ==========================================================
// 1. Lista de perfiles
// ==========================================================
function dibujarPerfiles() {
    const texto = normalizar(buscador.value)
    const filtrados = usuarios
        .filter((usuario) => normalizar(`${usuario.nombre} ${usuario.carrera}`).includes(texto))
        .sort((a, b) => resumen(resenas, b.uid).promedio - resumen(resenas, a.uid).promedio
            || (a.nombre ?? '').localeCompare(b.nombre ?? ''))

    listaPerfiles.replaceChildren()
    mensajePerfiles.textContent = filtrados.length === 1 ? '1 estudiante' : `${filtrados.length} estudiantes`

    for (const usuario of filtrados) {
        const elemento = crear('li', 'coincidencia')
        if (usuario.uid === uidElegido) elemento.classList.add('elegido')

        const encabezado = crear('div', 'coincidencia-encabezado')
        encabezado.append(
            crear('h3', 'coincidencia-nombre', usuario.uid === miUid ? `${usuario.nombre} (tú)` : usuario.nombre),
            dibujarRating(resenas, usuario.uid),
        )
        const botonVer = crear('button', 'boton-enlace', 'Ver perfil')
        botonVer.type = 'button'
        botonVer.addEventListener('click', () => elegir(usuario.uid, true))

        elemento.append(
            encabezado,
            crear('p', 'coincidencia-detalle',
                `${usuario.carrera || 'Sin carrera'} · ${NOMBRES_ROL[usuario.rol] ?? 'Sin rol todavía'}`),
            botonVer,
        )
        if (usuario.esDemo) elemento.append(crear('span', 'etiqueta-demo', 'Dato de prueba'))
        listaPerfiles.append(elemento)
    }
}


// ==========================================================
// 2. Perfil de una persona
// ==========================================================
function elegir(uid, bajar) {
    uidElegido = uid
    // Cambia la dirección a perfiles.html?uid=... sin recargar
    // (así puedes copiar el link y mandarlo)
    history.replaceState(null, '', `?uid=${encodeURIComponent(uid)}`)
    dibujarDetalle()
    dibujarPerfiles()
    if (bajar) detalle.scrollIntoView({ behavior: 'smooth' })
}

function dibujarDetalle() {
    const usuario = usuarios.find((persona) => persona.uid === uidElegido)
    listaComentarios.replaceChildren()
    listaViajesPerfil.replaceChildren()

    if (!usuario) {
        detalleNombre.textContent = 'Perfil no encontrado'
        detalleDatos.textContent = 'Elige a alguien de la lista.'
        detalleRating.replaceChildren()
        return
    }

    detalleNombre.textContent = usuario.uid === miUid ? `${usuario.nombre} (tú)` : usuario.nombre
    detalleDatos.textContent = `${usuario.carrera || 'Sin carrera'} · ${NOMBRES_ROL[usuario.rol] ?? 'Sin rol todavía'}`
    detalleRating.replaceChildren(dibujarRating(resenas, usuario.uid))

    // ----- Comentarios (los más nuevos primero) -----
    const suyas = resenas
        .filter((resena) => resena.paraUid === usuario.uid)
        .sort((a, b) => (b.creado?.toMillis?.() ?? 0) - (a.creado?.toMillis?.() ?? 0))

    if (suyas.length === 0) {
        listaComentarios.append(crear('li', 'coincidencia-detalle', 'Todavía nadie ha dejado comentarios.'))
    }
    for (const resena of suyas) {
        const elemento = crear('li', 'coincidencia')
        const encabezado = crear('div', 'coincidencia-encabezado')
        const pastilla = crear('span', 'rating', estrellas(resena.estrellas))
        pastilla.setAttribute('aria-label', `${resena.estrellas} de 5 estrellas`)
        encabezado.append(crear('h3', 'coincidencia-nombre', resena.autorNombre), pastilla)
        elemento.append(encabezado)
        // textContent (no innerHTML): si alguien escribe <script> en un comentario, se ve como texto
        if (resena.comentario) elemento.append(crear('p', 'comentario', resena.comentario))
        if (resena.creado?.toDate) {
            elemento.append(crear('p', 'coincidencia-detalle',
                resena.creado.toDate().toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })))
        }
        listaComentarios.append(elemento)
    }

    // ----- Viajes que publicó -----
    const ordenDia = (idDia) => DIAS.findIndex((dia) => dia.id === idDia)
    const susViajes = viajes
        .filter((viaje) => viaje.conductorUid === usuario.uid)
        .sort((a, b) => ordenDia(a.dia) - ordenDia(b.dia) || a.hora.localeCompare(b.hora))

    if (susViajes.length === 0) {
        listaViajesPerfil.append(crear('li', 'coincidencia-detalle', 'No tiene viajes publicados.'))
    }
    for (const viaje of susViajes) {
        const elemento = crear('li', 'coincidencia')
        const encabezado = crear('div', 'coincidencia-encabezado')
        encabezado.append(
            crear('h3', 'coincidencia-nombre', `${nombreDia(viaje.dia)} · ${viaje.hora}`),
            crear('span', 'coincidencia-puntaje', viaje.cupos === 1 ? '1 lugar' : `${viaje.cupos} lugares`),
        )
        elemento.append(encabezado, crear('p', 'coincidencia-detalle', NOMBRES_TRAMO[viaje.tramo] ?? viaje.tramo))
        listaViajesPerfil.append(elemento)
    }
}


// ==========================================================
// 3. Calificar a quienes viajaron contigo
// ==========================================================

// Cinco radios ocultos con una estrella cada uno.
// Van de 5 a 1 y el CSS los voltea (row-reverse): así "~" (los que
// vienen después) pinta las estrellas de la izquierda al elegir una.
function crearSelectorEstrellas(nombre, valorInicial) {
    const grupo = crear('fieldset', 'estrellas-input')
    grupo.append(crear('legend', 'etiqueta-campo', 'Tu calificación'))
    for (let valor = 5; valor >= 1; valor--) {
        const radio = crear('input')
        radio.type = 'radio'
        radio.name = nombre
        radio.value = valor
        radio.id = `${nombre}-${valor}`
        radio.checked = valor === valorInicial
        const etiqueta = crear('label', '', '★')
        etiqueta.htmlFor = radio.id
        etiqueta.title = valor === 1 ? '1 estrella' : `${valor} estrellas`
        grupo.append(radio, etiqueta)
    }
    return grupo
}

function dibujarCalificar(solicitudes) {
    listaCalificar.replaceChildren()
    if (solicitudes.length === 0) {
        listaCalificar.append(crear('li', 'coincidencia-detalle',
            'Cuando compartas un viaje (solicitud aceptada) podrás calificar a la otra persona aquí.'))
        return
    }

    for (const solicitud of solicitudes) {
        const soyConductor = solicitud.conductorUid === miUid
        const otroUid = soyConductor ? solicitud.pasajeroUid : solicitud.conductorUid
        const otroNombre = soyConductor ? solicitud.pasajeroNombre : solicitud.conductorNombre
        const idResena = `${solicitud.id}_${miUid}`
        let existente = resenas.find((resena) => resena.id === idResena)

        const elemento = crear('li', 'coincidencia')
        const encabezado = crear('div', 'coincidencia-encabezado')
        encabezado.append(
            crear('h3', 'coincidencia-nombre', otroNombre),
            crear('span', 'coincidencia-puntaje', soyConductor ? 'Tu pasajero' : 'Tu conductor'),
        )
        elemento.append(encabezado, crear('p', 'coincidencia-detalle',
            `${nombreDia(solicitud.dia)} · ${NOMBRES_TRAMO[solicitud.tramo] ?? solicitud.tramo} · ${solicitud.hora}`))

        const formulario = crear('form', 'form-resena')
        const selector = crearSelectorEstrellas(`estrellas-${solicitud.id}`, existente?.estrellas ?? 0)
        const comentario = crear('textarea')
        comentario.maxLength = MAXIMO_COMENTARIO
        comentario.rows = 2
        comentario.placeholder = 'Comentario (opcional): puntualidad, trato, manejo...'
        comentario.value = existente?.comentario ?? ''
        comentario.setAttribute('aria-label', `Comentario para ${otroNombre}`)
        const botonEnviar = crear('button', 'boton boton-secundario', existente ? 'Actualizar calificación' : 'Enviar calificación')
        botonEnviar.type = 'submit'
        const mensaje = crear('p', 'coincidencia-detalle')
        mensaje.setAttribute('aria-live', 'polite')
        formulario.append(selector, comentario, botonEnviar, mensaje)

        formulario.addEventListener('submit', async (evento) => {
            evento.preventDefault()
            const elegida = formulario.querySelector('input[type="radio"]:checked')
            if (!elegida) {
                mensaje.textContent = 'Elige de 1 a 5 estrellas.'
                return
            }
            const datos = { estrellas: Number(elegida.value), comentario: comentario.value.trim() }
            botonEnviar.disabled = true
            mensaje.textContent = 'Guardando...'
            try {
                if (existente) {
                    // Ya existe: solo cambiamos estrellas y comentario
                    await updateDoc(doc(db, 'resenas', idResena), datos)
                } else {
                    await setDoc(doc(db, 'resenas', idResena), {
                        solicitudId: solicitud.id,
                        autorUid: miUid,
                        autorNombre: miNombre,
                        paraUid: otroUid,
                        ...datos,
                        creado: serverTimestamp(),
                        esDemo: false,
                    })
                    existente = { id: idResena, ...datos }
                }
                botonEnviar.textContent = 'Actualizar calificación'
                mensaje.textContent = `Gracias. Tu calificación para ${otroNombre} quedó guardada.`
            } catch (problema) {
                console.error(problema)
                mensaje.textContent = problema.code === 'permission-denied'
                    ? 'Firebase no dejó guardar. Revisa que las reglas nuevas estén publicadas.'
                    : 'No se pudo guardar. Revisa tu internet.'
            } finally {
                botonEnviar.disabled = false
            }
        })

        elemento.append(formulario)
        const enlace = crear('a', 'enlace-perfil', `Ver perfil de ${otroNombre}`)
        enlace.href = `?uid=${encodeURIComponent(otroUid)}`
        enlace.addEventListener('click', (evento) => {
            evento.preventDefault()   // sin recargar: solo cambiamos el perfil de arriba
            elegir(otroUid, true)
        })
        elemento.append(enlace)
        listaCalificar.append(elemento)
    }
}

// Solicitudes aceptadas donde participé (como conductor o como pasajero)
async function leerMisViajesCompartidos() {
    const solicitudes = collection(db, 'solicitudes')
    const [comoConductor, comoPasajero] = await Promise.all([
        getDocs(query(solicitudes, where('conductorUid', '==', miUid), where('estado', '==', 'aceptada'))),
        getDocs(query(solicitudes, where('pasajeroUid', '==', miUid), where('estado', '==', 'aceptada'))),
    ])
    return [...comoConductor.docs, ...comoPasajero.docs]
        .map((documento) => ({ id: documento.id, ...documento.data() }))
}


// ---------- Arranque ----------
buscador.addEventListener('input', dibujarPerfiles)
mensajePerfiles.textContent = 'Cargando perfiles...'

await auth.authStateReady()
if (auth.currentUser) {
    miUid = auth.currentUser.uid
    // ?uid=... en la dirección; si no viene, tu propio perfil
    uidElegido = new URLSearchParams(location.search).get('uid') || miUid

    try {
        const [resultadoUsuarios, resultadoViajes, miDocumento] = await Promise.all([
            getDocs(collection(db, 'usuarios')),
            getDocs(collection(db, 'viajes')),
            getDoc(doc(db, 'usuarios', miUid)),
        ])
        usuarios = resultadoUsuarios.docs.map((documento) => ({ uid: documento.id, ...documento.data() }))
        viajes = resultadoViajes.docs.map((documento) => ({ id: documento.id, ...documento.data() }))
        miNombre = miDocumento.data()?.nombre || auth.currentUser.displayName || auth.currentUser.email.split('@')[0]
    } catch (problema) {
        console.error(problema)
        mensajePerfiles.textContent = 'No se pudieron cargar los perfiles. Recarga la página.'
    }

    // Reseñas en tiempo real: si alguien te califica, tu promedio cambia solo
    let primeraVez = true
    onSnapshot(collection(db, 'resenas'), async (resultado) => {
        resenas = resultado.docs.map((documento) => ({ id: documento.id, ...documento.data() }))
        dibujarPerfiles()
        dibujarDetalle()
        if (primeraVez) {
            // "Califica tus viajes" se dibuja UNA vez (si no, se borraría lo que estás escribiendo)
            primeraVez = false
            try {
                dibujarCalificar(await leerMisViajesCompartidos())
            } catch (problema) {
                console.error(problema)
                mensajeCalificar.textContent = 'No se pudieron cargar tus viajes para calificar.'
            }
        }
    }, (problema) => {
        console.error(problema)
        mensajePerfiles.textContent = problema.code === 'permission-denied'
            ? 'Firebase no dejó leer las calificaciones. Revisa que las reglas nuevas estén publicadas.'
            : 'No se pudieron cargar las calificaciones.'
        dibujarPerfiles()
        dibujarDetalle()
    })
}
