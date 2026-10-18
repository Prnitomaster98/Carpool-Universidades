// Prueba que el sistema de pruebas funcione correctamente.
import {
    minutos,
    rolesCompatibles,
    puntaje,
    puntoSugerido,
    buscarCoincidencias,
} from '../web/js/matching.js'

let pasaron = 0
let fallaron = 0

// Corre una prueba: si algo adentro lanza un error, cuenta como fallida
function prueba(nombre, funcion) {
    try {
        funcion()
        pasaron++
        console.log(`OK ${nombre}`)
    } catch (error) {
        fallaron++;
        console.log(`FALLO ${nombre}\n    ${error.message}`)
    }
}

// Lanza un error si real y esperado no son iguales.
// Con números decimales acepta una diferencia mínima (0.3 + 0.2 no siempre da 0.5 exacto).
function igual(real, esperado) {
    const sonNumeros = typeof real === 'number' && typeof esperado === 'number'
    const ok = sonNumeros ? Math.abs(real - esperado) < 1e-9 : real === esperado
    if (!ok) {
        throw new Error(`esperaba ${JSON.stringify(esperado)} y salió ${JSON.stringify(real)}`)
    }
}

// Fabrica un perfil de prueba; "cambios" reemplaza lo que haga falta
function perfil(cambios) {
    return {
        uid: 'x',
        nombre: 'Prueba',
        carrera: 'Ingeniería',
        rol: 'ambos',
        zonas: ['ruta-norte'],
        horario: { lunes: { entrada: '07:00', salida: '13:00' } },
        tolerancia: 20,
        esDemo: true,
        ...cambios,   // "..." copia los campos de cambios encima de los de arriba
    };
}

const PUNTOS = [
    { id: 'p-norte-1', zonaId: 'ruta-norte', nivel: 'precaucion' },
    { id: 'p-norte-2', zonaId: 'ruta-norte', nivel: 'recomendado' },
    { id: 'p-sur-1', zonaId: 'ruta-sur', nivel: 'recomendado' },
];


// ---------- minutos ----------
prueba('minutos: "00:00" → 0', () => igual(minutos('00:00'), 0))
prueba('minutos: "07:15" → 435', () => igual(minutos('07:15'), 435))
prueba('minutos: "13:45" → 825 (número, no texto)', () => igual(minutos('13:45'), 825))

// ---------- puntaje ----------
prueba('sin zona común → null', () => {
    const a = perfil({ zonas: ['ruta-norte'] })
    const b = perfil({ zonas: ['ruta-sur'] })
    igual(puntaje(a, b, 'lunes', 'regreso'), null)
});

prueba('diferencia mayor que la tolerancia → null', () => {
    const a = perfil({ horario: { lunes: { entrada: '07:00', salida: '13:00' } } })
    const b = perfil({ horario: { lunes: { entrada: '07:00', salida: '13:25' } } })
    igual(puntaje(a, b, 'lunes', 'regreso'), null)
});

prueba('usa la tolerancia más estricta de los dos', () => {
    const a = perfil({ tolerancia: 10 })
    const b = perfil({ tolerancia: 30, horario: { lunes: { entrada: '07:00', salida: '13:15' } } })
    igual(puntaje(a, b, 'lunes', 'regreso'), null)
});

prueba('misma hora y mismas zonas → puntaje máximo (1)', () => {
    igual(puntaje(perfil({}), perfil({}), 'lunes', 'regreso'), 1)
})

prueba('día vacío → null', () => {
    const a = perfil({})                         // solo va el lunes
    const b = perfil({ horario: { martes: { entrada: '07:00', salida: '13:00' } } })
    igual(puntaje(a, b, 'lunes', 'regreso'), null)
});

prueba('ejemplo hecho a mano: 0.6 × 1/2 + 0.4 × (1 − 10/20) = 0.5', () => {
    const a = perfil({ zonas: ['ruta-norte', 'ruta-oriente'], tolerancia: 20 })
    const b = perfil({
        zonas: ['ruta-norte'], tolerancia: 30,
        horario: { lunes: { entrada: '07:00', salida: '13:10' } }
    })
    igual(puntaje(a, b, 'lunes', 'regreso'), 0.5);
})

prueba('ida compara la ENTRADA y regreso la SALIDA', () => {
    const a = perfil({ horario: { lunes: { entrada: '07:00', salida: '13:00' } } })
    const b = perfil({ horario: { lunes: { entrada: '07:00', salida: '17:00' } } })
    igual(puntaje(a, b, 'lunes', 'ida'), 1)         // entran a la misma hora
    igual(puntaje(a, b, 'lunes', 'regreso'), null)  // salen con 4 h de diferencia
})

// ---------- roles ----------
prueba('dos pasajeros no coinciden; conductor + pasajero sí', () => {
    igual(rolesCompatibles(perfil({ rol: 'pasajero' }), perfil({ rol: 'pasajero' })), false)
    igual(rolesCompatibles(perfil({ rol: 'conductor' }), perfil({ rol: 'pasajero' })), true)
    igual(rolesCompatibles(perfil({ rol: 'pasajero' }), perfil({ rol: 'ambos' })), true)
});

// ---------- buscarCoincidencias ----------
prueba('ordena de mayor a menor puntaje', () => {
    const yo = perfil({ uid: 'yo' })
    const lejos = perfil({ uid: 'lejos', horario: { lunes: { entrada: '07:00', salida: '13:15' } } })
    const cerca = perfil({ uid: 'cerca', horario: { lunes: { entrada: '07:00', salida: '13:05' } } })
    const lista = buscarCoincidencias(yo, [lejos, cerca], 'lunes', 'regreso', PUNTOS)
    igual(lista.map((r) => r.uid).join(','), 'cerca,lejos')
});

prueba('se excluye a uno mismo y a los dos-pasajeros', () => {
    const yo = perfil({ uid: 'yo', rol: 'pasajero' })
    const otroPasajero = perfil({ uid: 'p2', rol: 'pasajero' })
    const conductor = perfil({ uid: 'c1', rol: 'conductor' })
    const lista = buscarCoincidencias(yo, [yo, otroPasajero, conductor], 'lunes', 'regreso', PUNTOS)
    igual(lista.map((r) => r.uid).join(','), 'c1')
});

prueba('punto sugerido: prefiere el "recomendado" de la zona común', () => {
    const yo = perfil({ uid: 'yo' })
    const lista = buscarCoincidencias(yo, [perfil({ uid: 'otro' })], 'lunes', 'regreso', PUNTOS)
    igual(lista[0].puntoSugerido.id, 'p-norte-2')
});

prueba('punto sugerido: null si la zona común no tiene puntos', () => {
    igual(puntoSugerido(['ruta-oriente'], PUNTOS), null);
});


// ---------- resumen ----------
console.log(`\n${pasaron} pasaron, ${fallaron} fallaron`);

// En node, si algo falló, el programa termina con código 1 (útil para revisar rápido).
// En el navegador "process" no existe, por eso se pregunta primero.
if (typeof process !== 'undefined') process.exitCode = fallaron > 0 ? 1 : 0;
