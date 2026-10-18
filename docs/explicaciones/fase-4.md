# Fase 4 — Perfil y matching

## Qué se completó

Cada estudiante llena su perfil (rol, zonas, horario y tolerancia) y la app le muestra
con quién coincide, ordenado de mejor a peor, con un punto de encuentro sugerido.

| Archivo | Para qué sirve |
|---|---|
| `web/js/matching.js` | Funciones **puras** del matching: `minutos`, `zonasComunes`, `rolesCompatibles`, `diferenciaMinutos`, `puntaje`, `puntoSugerido`, `buscarCoincidencias`, y la lista `DIAS` |
| `tests/matching.test.mjs` | 16 pruebas del matching (se corren con node) |
| `tests/matching.test.html` | Las mismas pruebas en el navegador |
| `web/js/perfil.js` | Formulario "Mi perfil": carga, valida y guarda en `usuarios/{uid}` |
| `web/js/coincidencias.js` | Sección "Coincidencias": día, ida/regreso y lista de compañeros |
| `web/css/perfil.css` | Estilos de las dos secciones (archivo aparte para no chocar con el mapa) |
| `web/app.html` | Formulario del perfil, filtros de coincidencias y los 2 `<script>` nuevos |
| `firebase/firestore.rules` | `perfilValido()`: revisa los valores del perfil en el servidor |
| `docs/explicaciones/fase-4.md` | Este documento |

**Decisión de diseño:** se compara la **ida** (hora de entrada a la UVG) y el
**regreso** (hora de salida) por separado. Por eso varias funciones reciben `tramo`
(`"ida"` o `"regreso"`).

---

## El modelo del perfil

```js
{
  uid, nombre, carrera,
  rol: "conductor" | "pasajero" | "ambos",
  zonas: ["ruta-norte", "ruta-oriente"],          // ids de zonas.geojson
  horario: {
    lunes:  { entrada: "07:00", salida: "13:00" },
    martes: { entrada: "09:00", salida: "15:30" }
    // el día que no vas, NO aparece
  },
  tolerancia: 10 | 20 | 30,                        // minutos que aceptas esperar
  esDemo: false
}
```

Nada de dirección, coordenadas de casa, teléfono ni fotos.

---

## La fórmula del puntaje

`puntaje(a, b, dia, tramo)` devuelve `null` (no coinciden) si:

1. no tienen **ninguna zona** en común,
2. alguno de los dos **no va ese día**,
3. la diferencia de hora es **mayor que la tolerancia más estricta** de los dos
   (`Math.min(a.tolerancia, b.tolerancia)`).

Si pasan los 3 filtros:

```
puntaje = 0.6 × (zonas comunes / zonas de a)  +  0.4 × (1 − diferencia / tolerancia)
          └─ qué tanto se parecen las rutas ┘    └─ qué tan cerca salen ─────────┘
```

### Ejemplo hecho a mano

- **a** pasa por Norte y Oriente (2 zonas), tolerancia 20, sale a las 13:00.
- **b** pasa solo por Norte, tolerancia 30, sale a las 13:10.

| Paso | Cuenta | Resultado |
|---|---|---|
| Zonas en común | Norte | 1 |
| Parte de zonas | 1 / 2 | 0.5 |
| Tolerancia que se usa | mín(20, 30) | 20 |
| Diferencia | 13:10 − 13:00 | 10 min (≤ 20, sí pasa) |
| Parte de hora | 1 − 10/20 | 0.5 |
| **Puntaje** | 0.6 × 0.5 + 0.4 × 0.5 = 0.3 + 0.2 | **0.5 → "50 % compatible"** |

Este ejemplo es una de las pruebas de `tests/matching.test.mjs`.

**No es simétrico:** se divide entre las zonas **de a** (yo). Si yo paso por [Norte] y
el otro por [Norte, Sur], para mí cubre toda mi ruta (1/1); para él, solo la mitad (1/2).

---

## Explicación archivo por archivo

### 1. `web/js/matching.js`

- **`minutos("07:15") → 435`**: `split(':')` corta, `.map(Number)` convierte a números
  y `const [horas, mins]` los guarda. Sin convertir, `420 + "15"` daría el texto `"42015"`.
- **`diferenciaMinutos`** usa `a.horario?.[dia]?.[campo]`. El `?.` evita el error cuando
  el día no existe. `campo` es `'entrada'` o `'salida'` según el tramo
  (`tramo === 'ida' ? 'entrada' : 'salida'`).
- **`puntaje`** revisa `diferencia === null` y no `!diferencia`: 0 minutos es el mejor
  caso, no "sin dato".
- **`rolesCompatibles`**: alguien tiene que manejar; dos pasajeros no coinciden.
- **`puntoSugerido`**: los puntos de las zonas comunes, prefiriendo `nivel: "recomendado"`.
  `recomendado ?? deLasZonas[0] ?? null`.
- **`buscarCoincidencias(yo, otros, dia, tramo, puntos)`**: te quita a ti, quita roles
  incompatibles, calcula el puntaje, descarta los `null` y ordena con
  `sort((x, y) => y.puntaje - x.puntaje)` (de mayor a menor).

Son funciones **puras** (sin Firebase ni DOM): por eso se prueban con node.

### 2. `web/js/perfil.js`

1. `await protegerPagina()`.
2. Lee `zonas.geojson` y dibuja una casilla por zona; dibuja una fila por día con
   `<input type="time">`.
3. `obtenerOCrearPerfil()`: `getDoc`; si el documento no existe (cuentas viejas), lo
   crea con `setDoc` y **solo** los 4 campos que permite la regla `create`. El resto se
   agrega con `updateDoc`, que la regla `update` sí permite.
4. `validar()`: rol elegido, al menos una zona, al menos un día, cada día con entrada
   **y** salida, y salida después de la entrada.
5. `updateDoc(referenciaPerfil, datos)` reemplaza **completo** cada campo enviado: si
   borras el viernes, `horario` se guarda ya sin viernes.
6. `anunciarPerfil()` dispara el evento `perfil-listo` con tu perfil.

### 3. `web/js/coincidencias.js`

- Pone el "oído" (`addEventListener('perfil-listo', ...)`) **antes** de cualquier
  `await`, para no perder el primer anuncio de `perfil.js`.
- `Promise.all([...])` hace 4 cargas **a la vez**: perfiles de Firestore, perfiles demo,
  puntos y zonas.
- Un `Map` por `uid` evita repetidos si los perfiles demo también se subieron a Firestore.
- Solo compara perfiles completos (rol, zonas y horario).
- Día por defecto: hoy (o lunes si es fin de semana). Tramo: ida antes de las 12:00 y
  regreso después.
- Cada resultado muestra puntaje en %, carrera y rol, zonas en común, diferencia de
  minutos, punto sugerido y la etiqueta **Dato de prueba** si `esDemo`.
- El botón del punto sugerido llama a `resaltarPunto(id)` de `mapa.js` y baja al mapa.

### 4. `firebase/firestore.rules`

```
function perfilValido() {
  let d = request.resource.data;
  return (!('rol' in d) || d.rol in ['conductor', 'pasajero', 'ambos'])
    && (!('zonas' in d) || (d.zonas is list && d.zonas.size() <= 10))
    && (!('horario' in d) || (d.horario is map
          && d.horario.keys().hasOnly(['lunes', 'martes', 'miercoles', 'jueves', 'viernes'])))
    && (!('tolerancia' in d) || d.tolerancia in [10, 20, 30]);
}
```

`!('rol' in d) ||` = "si el campo no viene, no hay nada que revisar". Se agregó a la
regla `update`.

---

## Conceptos nuevos

1. **Funciones puras y pruebas automáticas.** Misma entrada → misma salida; se prueban
   sin navegador.
2. **Ternario `? :`, encadenamiento opcional `?.` y fusión nula `??`.**
3. **`filter`, `map`, `find`, `includes`, `sort` con comparador, `slice`.**
4. **`getDoc` / `setDoc` / `updateDoc` / `getDocs`.** Leer uno, crear, cambiar campos,
   leer una colección completa.
5. **`CustomEvent`.** Un módulo "anuncia" algo y otro lo escucha, sin depender uno del otro.
6. **`Promise.all`.** Varias cargas al mismo tiempo.
7. **`@media (max-width: 480px)`.** La tabla del horario cambia de forma en celular.

---

## Cómo replicarlo tú

1. Escribir `matching.js` función por función, y después de cada una agregar su prueba
   en `tests/matching.test.mjs` y correr `node tests/matching.test.mjs`.
2. Agregar el formulario a `app.html` y escribir `perfil.js`.
3. Agregar `perfilValido()` a las reglas y **publicarlas** en la consola de Firebase.
4. Agregar la sección de coincidencias y escribir `coincidencias.js`.

---

## Cómo probarlo

1. **Pruebas automáticas** (dentro de `carpool-zonas`):
   ```bash
   node tests/matching.test.mjs
   ```
   Debe terminar en `16 pasaron, 0 fallaron`.
2. **Reglas:** Firebase → Firestore → **Reglas** → pegar `firebase/firestore.rules` →
   **Publicar**.
3. `python -m http.server 8000` y abrir <http://localhost:8000/web/app.html> con tu cuenta.
4. Revisa:
   - [ ] "Guardar perfil" sin rol → "Elige si eres conductor, pasajero o ambos."
   - [ ] Un día solo con entrada → pide las dos horas.
   - [ ] Salida antes de la entrada → "la salida tiene que ser después de la entrada".
   - [ ] Guardar bien → "Perfil guardado."; recargar la página → todo sigue ahí.
   - [ ] En Firestore, tu documento tiene `rol`, `zonas`, `horario` y `tolerancia`.
   - [ ] "Coincidencias" muestra compañeros con **Dato de prueba** (los perfiles demo).
   - [ ] Cambiar el día o ida/regreso → la lista cambia.
   - [ ] Tocar "Punto sugerido" → baja al mapa y resalta el punto.
   - [ ] Elegir un día que no tienes en tu horario → "No tienes horario el ...".
   - [ ] A 375 px de ancho (F12 → modo celular) nada se sale de la pantalla.
