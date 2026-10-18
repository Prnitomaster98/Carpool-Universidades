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
// Tramo es la hora en la que viajan
//
// Forma de un perfil (igual que usuarios/{uid} en Firestore):
//   {
//     uid, nombre, carrera,
//     rol: "conductor" | "pasajero" | "ambos",
//     zonas: ["ruta-norte", ...],             // ids de zonas.geojson
//     horario: { lunes: { entrada: "07:00", salida: "13:00" }, ... },
//     tolerancia: 10 | 20 | 30,               // minutos
//   }
//   Un día sin clases no aparece en horario.

// Los días de clase: "id" es como se guarda (sin tilde), "nombre" es lo que se ve.
// Lo usan perfil.js y coincidencias.js, por eso vive aquí (un solo lugar).
export const DIAS = [
    { id: 'lunes', nombre: 'Lunes' },
    { id: 'martes', nombre: 'Martes' },
    { id: 'miercoles', nombre: 'Miércoles' },
    { id: 'jueves', nombre: 'Jueves' },
    { id: 'viernes', nombre: 'Viernes' },
];

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


//Revisa lista de zonas comunes de ambos, encuentra matchings y los regresa
export function zonasComunes(a, b) {
    const zonasB = b.zonas ?? [];
    return (a.zonas ?? []).filter((zona) => zonasB.includes(zona));
}

// Revisa que almenos uno sea pasajero porque si no no hay viaje.

export function rolesCompatibles(a, b) {
    return a.rol !== 'pasajero' || b.rol !== 'pasajero';
}

// diferenciaMinutos(a, b, "lunes", "ida") → 15   (o null)
// Cuántos minutos de diferencia hay entre la hora de a y la de b
// ese día. Devuelve null si alguno de los dos no va ese día.

export function diferenciaMinutos(a, b, dia, tramo) {
    // Qué hora comparar según el tramo del viaje
    const campo = tramo === 'ida' ? 'entrada' : 'salida'

    // ?. = "si no existe, da undefined en vez de error".
    // horario[dia] usa corchetes porque el día viene en una variable.
    const horaA = a.horario?.[dia]?.[campo]
    const horaB = b.horario?.[dia]?.[campo]

    // Si a alguno le falta la hora (día vacío), no hay comparación posible y regresa null, que evita un error
    if (!horaA || !horaB) return null;

    // Math.abs quita el signo: 10 minutos antes o después es lo mismo
    return Math.abs(minutos(horaA) - minutos(horaB));
}


// Puntaje toma el peso de las desiciones de ambos y las regresa en caso de encontrar una correcta. Toma más importante
//Los criterios del más estricto. El horario es el 40% y la zona es el 60%, los puntajes no ayudan a ordenarlos.
//Toma en cuenta la diferencia en minutos de la salida de ambos

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

//Revisa puntos comunes entre ambos y regresa el más importante, el primero sugerido.
export function puntoSugerido(comunes, puntos) {
    const deLasZonas = puntos.filter((punto) => comunes.includes(punto.zonaId));
    const recomendado = deLasZonas.find((punto) => punto.nivel === 'recomendado');
    // ?? = "si lo de la izquierda es null/undefined, usa lo de la derecha"
    return recomendado ?? deLasZonas[0] ?? null;
}



// Quita mi propio perfil de la lista.
// Quita a quien no tenga rol compatible conmigo.
// Calcula el puntaje con cada uno; quita los null.
// Ordena de mayor a menor puntaje.
// Cada resultado trae solo lo que la pantalla necesita mostrar.

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

    //sort con comparador: si (b - a) es positivo, b va primero → mayor a menor
    resultados.sort((x, y) => y.puntaje - x.puntaje);
    return resultados;
}
