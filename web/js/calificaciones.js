// ==========================================================
// calificaciones.js — estrellas que usan VARIAS partes de la app
// (perfiles.js y viajes.js). Así el cálculo vive en un solo lugar.
//
//   escucharResenas(funcion)     Llama a "funcion" con todas las reseñas,
//                                al inicio y cada vez que cambian (tiempo real).
//   resumen(resenas, uid)        { promedio, cantidad } de lo que recibió uid.
//   estrellas(valor)             3.6 -> "★★★★☆"
//   dibujarRating(resenas, uid)  <span> con estrellas y número, o "Sin calificaciones".
// ==========================================================

import { db } from './firebase-config.js'
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'


export function escucharResenas(funcion) {
    return onSnapshot(collection(db, 'resenas'), (resultado) => {
        funcion(resultado.docs.map((documento) => ({ id: documento.id, ...documento.data() })))
    }, (problema) => {
        console.warn('No se pudieron leer las calificaciones', problema)
        funcion([])   // sin calificaciones, pero la página sigue funcionando
    })
}


// Promedio y cantidad de reseñas que RECIBIÓ una persona
export function resumen(resenas, uid) {
    const suyas = resenas.filter((resena) => resena.paraUid === uid)
    if (suyas.length === 0) return { promedio: 0, cantidad: 0 }
    // reduce va sumando: empieza en 0 y le suma las estrellas de cada una
    const suma = suyas.reduce((total, resena) => total + resena.estrellas, 0)
    return { promedio: suma / suyas.length, cantidad: suyas.length }
}


export function estrellas(valor) {
    const llenas = Math.round(valor)
    return '★'.repeat(llenas) + '☆'.repeat(5 - llenas)
}


export function dibujarRating(resenas, uid) {
    const { promedio, cantidad } = resumen(resenas, uid)
    const elemento = document.createElement('span')
    elemento.className = 'rating'
    if (cantidad === 0) {
        elemento.textContent = 'Sin calificaciones'
        elemento.classList.add('rating-vacio')
        return elemento
    }
    const textoEstrellas = document.createElement('span')
    textoEstrellas.className = 'rating-estrellas'
    textoEstrellas.textContent = estrellas(promedio)
    textoEstrellas.setAttribute('aria-hidden', 'true')   // el lector de pantalla lee el número
    elemento.append(textoEstrellas, ` ${promedio.toFixed(1)} (${cantidad})`)
    elemento.setAttribute('aria-label', `${promedio.toFixed(1)} de 5 estrellas, ${cantidad} calificaciones`)
    return elemento
}
