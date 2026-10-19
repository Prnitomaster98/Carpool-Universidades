# Fase 5 — Viajes, solicitudes y recomendaciones

## Qué se completó

Un conductor publica un viaje, otro estudiante le pide lugar y el conductor acepta o
rechaza. Además hay una página de **Recomendaciones** con los puntos de encuentro de
cada ruta y consejos de seguridad.

| Archivo | Para qué sirve |
|---|---|
| `web/js/viajes.js` | Sección "Viajes": formulario para publicar, lista de viajes, borrar el tuyo, compartir por WhatsApp y botón "Solicitar lugar" |
| `web/js/solicitudes.js` | Sección "Solicitudes": guarda la solicitud, lista las recibidas (aceptar / rechazar) y las enviadas (cancelar), y "Avisar por WhatsApp" cuando ya está aceptada |
| `web/recomendaciones.html` | Página de recomendaciones (el menú ya la enlazaba) |
| `web/js/recomendaciones.js` | Lee `zonas.geojson` y `puntos-encuentro.json` y dibuja los puntos de cada ruta, con filtro |
| `web/css/recomendaciones.css` | Estilos solo de esa página |
| `web/app.html` | Secciones `#viajes` y `#solicitudes` y sus 2 `<script>` |
| `firebase/firestore.rules` | Reglas de `viajes` y `solicitudes` (`viajeValido()` y `solicitudValida()`) |

---

## El modelo de datos

```js
// viajes/{id automático}
{
  conductorUid, conductorNombre,
  zonaId: "ruta-norte",          // id de zonas.geojson
  puntoId: "...",                // id de puntos-encuentro.json
  dia: "lunes", tramo: "ida" | "regreso", hora: "07:15",
  cupos: 1..4,
  creado: (fecha del servidor), esDemo: false
}

// solicitudes/{viajeId}_{pasajeroUid}
{
  viajeId, conductorUid, conductorNombre, pasajeroUid, pasajeroNombre,
  dia, tramo, hora, puntoId,     // copiados del viaje para no tener que buscarlo
  estado: "pendiente" | "aceptada" | "rechazada",
  creado: (fecha del servidor), esDemo: false
}
```

**Por qué el id de la solicitud es `viajeId_pasajeroUid`:** si alguien pide dos veces
el mismo viaje, se escribe en el MISMO documento en vez de crear otro. Así no hay
solicitudes repetidas sin tener que buscarlas antes.

Igual que en el perfil: **no se guarda teléfono, dirección ni ubicación**.

---

## Cómo se hablan viajes.js y solicitudes.js

Son dos archivos separados (los hicieron personas distintas) y no se importan entre sí.
Se comunican con un **evento**, como un timbre:

```js
// viajes.js — al tocar "Solicitar lugar"
document.dispatchEvent(new CustomEvent('solicitar-viaje', { detail: viaje }))

// solicitudes.js — está escuchando ese timbre
document.addEventListener('solicitar-viaje', (evento) => solicitar(evento.detail))
```

`detail` es el "paquete" que viaja con el evento: aquí, el viaje completo.
Lo mismo pasa con `perfil-listo`, que lanza `perfil.js` cuando termina de cargar tu perfil.

---

## El recorrido de una solicitud

1. **Pasajero** toca "Solicitar lugar" → `setDoc` guarda la solicitud con `estado: 'pendiente'`.
2. **Conductor** la ve en "Solicitudes que recibí" → toca Aceptar o Rechazar.
   - Antes de aceptar, `responder()` revisa que el viaje exista y que
     `aceptadas < cupos`.
   - `updateDoc` cambia **solo** el campo `estado`.
3. **Pasajero** ve "Aceptada" en "Solicitudes que envié" y puede avisar por WhatsApp
   o cancelar (`deleteDoc`).

### WhatsApp sin guardar teléfonos

```js
window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
```

`wa.me/?text=` sin número abre WhatsApp con el mensaje escrito y **tú eliges el
contacto**. `encodeURIComponent` convierte espacios, tildes y `:` en códigos que
sí caben en un link (`" "` → `%20`).

---

## Las reglas (lo que protege el servidor)

El código del navegador se puede modificar, así que **las reglas son las que mandan**:

| Colección | Leer | Crear | Cambiar | Borrar |
|---|---|---|---|---|
| `viajes` | cualquier verificado | solo a tu nombre, con `viajeValido()` | nadie | solo el conductor |
| `solicitudes` | solo el pasajero o el conductor de esa solicitud | solo el pasajero, siempre `pendiente`, con `solicitudValida()` | solo el conductor, y **solo** `estado` → aceptada/rechazada | solo el pasajero |

Detalles importantes:

- `d.creado == request.time` obliga a usar `serverTimestamp()`: nadie puede inventar la fecha.
- `solicitudValida()` usa `get(...)` para leer el viaje y comprobar que el
  `conductorUid` de la solicitud es el conductor de verdad.
- `diff(...).affectedKeys().hasOnly(['estado'])` = "de todo el documento, lo único que
  cambió es `estado`".
- Como solo puedes leer TUS solicitudes, `solicitudes.js` **tiene** que pedirlas con
  `where('conductorUid', '==', uid)` y `where('pasajeroUid', '==', uid)`. Una consulta
  sin filtro la rechaza Firebase entera.

**Después de esta fase hay que publicar las reglas otra vez** (consola de Firebase →
Firestore → Reglas → pegar `firebase/firestore.rules` → Publicar).

---

## Errores que corregimos al cerrar la fase

- `viajes.js` pedía la lista de viajes antes de que Firebase supiera quién eras, así que
  a veces salía "No se pudieron cargar los viajes". Ahora espera con
  `await auth.authStateReady()`, igual que `solicitudes.js`.
- La etiqueta "Usar con precaución" tenía un emoji; se quitó (el proyecto no usa emojis).
- Se confirmaron los números de emergencia: PNC 110, Bomberos Voluntarios 122,
  Bomberos Municipales 123.

---

## Cómo probarlo

Necesitas **dos cuentas** (dos navegadores, o uno normal y otro en incógnito):

1. Publica las reglas nuevas.
2. Cuenta A (rol conductor o ambos): publica un viaje.
3. Cuenta B: recarga, busca el viaje y toca "Solicitar lugar". Debe salir en "Solicitudes que envié" como Pendiente.
4. Cuenta A: recarga, acepta la solicitud.
5. Cuenta B: recarga, debe decir Aceptada y salir el botón de WhatsApp.
6. Prueba también: pedir dos veces el mismo viaje, aceptar más gente que cupos, cancelar y borrar el viaje.

Si sale "Firebase no dejó guardar", las reglas no están publicadas.

---

## Para practicar

1. Mostrar en cada viaje cuántos lugares quedan (pista: el conductor sí puede contar sus aceptadas).
2. Cuando el conductor borra un viaje, borrar también sus solicitudes.
3. Que el pasajero no pueda pedir lugar en un viaje de una ruta que no está en su perfil.
