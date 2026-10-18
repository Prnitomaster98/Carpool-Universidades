// ==========================================================
// matching.js — funciones para encontrar compañeros compatibles (Fase 4)
//
// Todas las funciones de este archivo son PURAS:
//   - No usan Firebase, ni el DOM (document...), ni fetch.
//   - Con la misma entrada siempre devuelven la misma salida.
// Por eso se pueden probar con node:  node tests/matching.test.mjs
//
// Funciones exportadas:
//   minutos("HH:MM")                    Hora → minutos desde medianoche.
//   zonasComunes(a, b)                  Zonas que a y b tienen en común.
//   rolesCompatibles(a, b)              ¿Pueden viajar juntos según su rol?
//   diferenciaMinutos(a, b, dia, tramo) Diferencia de hora (o null).
//   puntaje(a, b, dia, tramo)           Qué tan buena es la coincidencia (0 a 1, o null).
//   puntoSugerido(comunes, puntos)      Punto de encuentro para esas zonas (o null).
//   buscarCoincidencias(yo, otros, dia, tramo, puntos)
//                                       Lista ordenada de compañeros compatibles.
//
// ¿Qué es "tramo"?
//   "ida"      → viaje hacia la UVG en la mañana: se compara la hora de ENTRADA.
//   "regreso"  → viaje de vuelta a casa: se compara la hora de SALIDA.
//
// Forma de un perfil (igual que usuarios/{uid} en Firestore):
//   {
//     uid, nombre, carrera,
//     rol: "conductor" | "pasajero" | "ambos",
//     zonas: ["ruta-norte", ...],             // ids de zonas.geojson
//     horario: { lunes: { entrada: "07:00", salida: "13:00" }, ... },
//     tolerancia: 10 | 20 | 30,               // minutos
//     esDemo: true | false
//   }
//   Un día sin clases simplemente NO aparece en horario.
// ==========================================================


// Pesos de la fórmula del puntaje. Suman 1, así el puntaje máximo es 1.
const PESO_ZONAS = 0.6;   // qué tanto pesa compartir zonas
const PESO_HORA = 0.4;    // qué tanto pesa salir a la misma hora


// ----------------------------------------------------------
// minutos("07:15") → 435
// "07:15" y "07:40" no se pueden restar como texto;
// 435 y 460 sí: 460 - 435 = 25 minutos de diferencia.
// ----------------------------------------------------------
export function minutos(hora) {
    // split corta el texto en el ":" → ["07", "15"]
    // map(Number) convierte cada parte a número → [7, 15]
    // const [horas, mins] guarda el primero en horas y el segundo en mins
    const [horas, mins] = hora.split(':').map(Number);
    return horas * 60 + mins;
}


// ----------------------------------------------------------
// zonasComunes(a, b) → ["ruta-norte"]
// filter se queda solo con los elementos que cumplen la condición:
// las zonas de a que TAMBIÉN están (includes) en las zonas de b.
// ----------------------------------------------------------
export function zonasComunes(a, b) {
    return a.zonas.filter((zona) => b.zonas.includes(zona));
}


// ----------------------------------------------------------
// rolesCompatibles(a, b) → true / false
// Alguien tiene que manejar: basta con que UNO de los dos
// no sea solo pasajero ("conductor" o "ambos").
// Dos pasajeros no pueden viajar juntos (nadie tiene carro).
// ----------------------------------------------------------
export function rolesCompatibles(a, b) {
    return a.rol !== 'pasajero' || b.rol !== 'pasajero';
}


// ----------------------------------------------------------
// diferenciaMinutos(a, b, "lunes", "ida") → 15   (o null)
// Cuántos minutos de diferencia hay entre la hora de a y la de b
// ese día. Devuelve null si alguno de los dos no va ese día.
// ----------------------------------------------------------
export function diferenciaMinutos(a, b, dia, tramo) {
    // Qué hora comparar según el tramo del viaje
    const campo = tramo === 'ida' ? 'entrada' : 'salida'

    // ?. = "si no existe, da undefined en vez de error".
    // horario[dia] usa corchetes porque el día viene en una variable.
    const horaA = a.horario?.[dia]?.[campo]
    const horaB = b.horario?.[dia]?.[campo]

    // Si a alguno le falta la hora (día vacío), no hay comparación posible
    if (!horaA || !horaB) return null;

    // Math.abs quita el signo: 10 minutos antes o después es lo mismo
    return Math.abs(minutos(horaA) - minutos(horaB));
}


// ----------------------------------------------------------
// puntaje(a, b, "lunes", "regreso") → número de 0 a 1, o null
//
// null (no coinciden) si:
//   - no tienen ninguna zona en común,
//   - alguno no va ese día,
//   - la diferencia de hora supera la tolerancia MÁS ESTRICTA de los dos.
//
// Si coinciden:
//   0.6 × (zonas comunes / zonas de a)  +  0.4 × (1 − diferencia / tolerancia)
//   └── parte de zonas ──────────────┘    └── parte de hora ─────────────┘
// Ejemplo: a pasa por 2 zonas y comparte 1 con b; tolerancias 20 y 30
// (se usa 20); salen con 10 min de diferencia:
//   0.6 × (1/2) + 0.4 × (1 − 10/20) = 0.3 + 0.2 = 0.5
// ----------------------------------------------------------
export function puntaje(a, b, dia, tramo) {
    const comunes = zonasComunes(a, b);
    if (comunes.length === 0) return null;

    const diferencia = diferenciaMinutos(a, b, dia, tramo);
    if (diferencia === null) return null;   // ojo: 0 es válido, por eso === null

    // Se respeta al más estricto: si uno espera 10 y el otro 30, son 10
    const tolerancia = Math.min(a.tolerancia, b.tolerancia);
    if (diferencia > tolerancia) return null;

    const parteZonas = comunes.length / a.zonas.length;
    const parteHora = 1 - diferencia / tolerancia;
    return PESO_ZONAS * parteZonas + PESO_HORA * parteHora;
}


// ----------------------------------------------------------
// puntoSugerido(["ruta-norte"], puntos) → { id, nombre, ... } o null
// Busca un punto de encuentro de alguna de las zonas comunes.
// Prefiere los que tienen nivel "recomendado"; si no hay, cualquiera.
// find devuelve el PRIMER elemento que cumple la condición (o undefined).
// ----------------------------------------------------------
export function puntoSugerido(comunes, puntos) {
    const deLasZonas = puntos.filter((punto) => comunes.includes(punto.zonaId));
    const recomendado = deLasZonas.find((punto) => punto.nivel === 'recomendado');
    // ?? = "si lo de la izquierda es null/undefined, usa lo de la derecha"
    return recomendado ?? deLasZonas[0] ?? null;
}


// ----------------------------------------------------------
// buscarCoincidencias(yo, otros, "lunes", "ida", puntos) → lista
// Pasos:
//   1. Quita mi propio perfil de la lista.
//   2. Quita a quien no tenga rol compatible conmigo.
//   3. Calcula el puntaje con cada uno; quita los null.
//   4. Ordena de mayor a menor puntaje.
// Cada resultado trae solo lo que la pantalla necesita mostrar.
// ----------------------------------------------------------
export function buscarCoincidencias(yo, otros, dia, tramo, puntos = []) {
    const resultados = [];

    for (const otro of otros) {
        if (otro.uid === yo.uid) continue;                // 1. no me comparo conmigo
        if (!rolesCompatibles(yo, otro)) continue;        // 2. alguien tiene que manejar

        const valor = puntaje(yo, otro, dia, tramo);      // 3.
        if (valor === null) continue;

        const comunes = zonasComunes(yo, otro);
        resultados.push({
            uid: otro.uid,
            nombre: otro.nombre,
            carrera: otro.carrera,
            rol: otro.rol,
            esDemo: otro.esDemo === true,
            puntaje: valor,
            zonasComunes: comunes,
            diferencia: diferenciaMinutos(yo, otro, dia, tramo),
            puntoSugerido: puntoSugerido(comunes, puntos),
        });
    }

    // 4. sort con comparador: si (b - a) es positivo, b va primero → mayor a menor
    resultados.sort((x, y) => y.puntaje - x.puntaje);
    return resultados;
}
