
// ==========================================================
// recomendacion.js — qué punto de encuentro le queda más cerca al usuario
//
// Este archivo NO toca el mapa ni el HTML: solo hace cálculos.
// Así se puede probar solo (tests/recomendacion.test.html) y
// cualquier otra página lo puede reutilizar.
//
// Idea: no importa en qué ruta (zona pintada) esté el usuario.
// Medimos la distancia a TODOS los puntos y los ordenamos del
// más cercano al más lejano. El primero es la recomendación y
// los siguientes son las alternativas.
//
// Privacidad: la ubicación del usuario solo vive en la memoria
// del navegador mientras la página está abierta. Este archivo no
// la guarda ni la manda a ningún lado.
// ==========================================================
// GUÍA DE NOMBRES
// RADIO_TIERRA_KM          Radio promedio de la Tierra (6371 km).
// CANTIDAD_RECOMENDACIONES Cuántos puntos se muestran (3).
// origen                   { lat, lng } de la casa o ubicación del usuario.
// destino                  { lat, lng } de un punto de encuentro.
// gradosARadianes()        Las funciones Math.sin/cos usan radianes, no grados.
// diferenciaLatitud / diferenciaLongitud   Cuánto cambian lat y lng (en radianes).
// a / c                    Pasos intermedios de la fórmula de Haversine.
// listaPuntos              Todos los puntos de puntos-encuentro.json.
// puntosConDistancia       Copia de cada punto con su campo nuevo "distanciaKm".
// ==========================================================

const RADIO_TIERRA_KM = 6371
export const CANTIDAD_RECOMENDACIONES = 3

function gradosARadianes(grados) {
  return (grados * Math.PI) / 180
}

/** Calculo para sacar distancia entre cada punto.
 * @param {{lat:number, lng:number}} origen
 * @param {{lat:number, lng:number}} destino
 * @returns {number} kilómetros
 */
export function distanciaKm(origen, destino) {
  const diferenciaLatitud = gradosARadianes(destino.lat - origen.lat)
  const diferenciaLongitud = gradosARadianes(destino.lng - origen.lng)
  const a =
    Math.sin(diferenciaLatitud / 2) ** 2 +
    Math.cos(gradosARadianes(origen.lat)) *
      Math.cos(gradosARadianes(destino.lat)) *
      Math.sin(diferenciaLongitud / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return RADIO_TIERRA_KM * c
}

/**Calcula y ordena los puntos
 * @param {{lat:number, lng:number}} origen - casa o ubicación actual
 * @param {Array<object>} listaPuntos - puntos de puntos-encuentro.json
 * @param {number} cantidad - cuántos devolver (3 por defecto)
 * @returns {Array<object>}
 */
export function puntosMasCercanos(origen, listaPuntos, cantidad = CANTIDAD_RECOMENDACIONES) {
  const puntosConDistancia = listaPuntos.map((punto) => ({
    ...punto,                                  // copia datos y agrega la distancia
    distanciaKm: distanciaKm(origen, punto),
  }))
  // Se utiliza sort para ordenar las distancias de menor a mayor
  puntosConDistancia.sort((puntoA, puntoB) => puntoA.distanciaKm - puntoB.distanciaKm)
  return puntosConDistancia.slice(0, cantidad)
}

/**Convierte kilometros en metros para que no salga en decimales menores a 1
 */
export function formatearDistancia(kilometros) {
  if (kilometros < 1) {
    return `${Math.round(kilometros * 1000)} m`
  }
  return `${kilometros.toFixed(1)} km`
}
