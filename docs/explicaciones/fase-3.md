# Fase 3 — Inicio de sesión con correo institucional

## Qué se completó

Solo pueden entrar estudiantes con correo `@uvg.edu.gt` **verificado**. La regla del
dominio está en dos lugares: en el navegador (para dar mensajes claros) y en Firestore
(para que nadie se la salte).

| Archivo | Para qué sirve |
|---|---|
| `web/js/firebase-config.js` | Conecta la app con el proyecto de Firebase `carpool-uvg-e62d0`. Exporta `app`, `auth` y `db` |
| `web/index.html` | Pantalla de entrar / registrarse, con el aviso de "verifica tu correo" |
| `web/js/auth.js` | Revisa el dominio, crea la cuenta, manda la verificación, inicia sesión, traduce los errores al español y te manda al panel si ya tenías sesión |
| `web/js/sesion.js` | `protegerPagina()` y `cerrarSesion()`, que usa cualquier página privada |
| `web/js/panel.js` | Protege `app.html`, saluda con tu nombre y activa "Cerrar sesión" |
| `firebase/firestore.rules` | Reglas del servidor: quién puede leer y escribir cada documento |
| `docs/explicaciones/fase-3.md` | Este documento |

---

## Explicación archivo por archivo

### 1. `web/js/firebase-config.js`

```js
export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);       // cuentas y contraseñas
export const db   = getFirestore(app);  // base de datos
```

- El SDK de Firebase se carga desde la CDN `gstatic` con la versión **fijada**
  (`12.19.0`). Las 3 importaciones (app, auth, firestore) deben tener la misma versión.
- La `apiKey` de Firebase **no es secreta**: solo identifica el proyecto. Lo que protege
  los datos son las **reglas** de Firestore (punto 6).

### 2. `web/index.html`

Dos formularios (`form-entrar` y `form-registro`) en la misma página. Solo uno se ve a
la vez: el otro tiene el atributo `hidden`. `novalidate` apaga los mensajes automáticos
del navegador (en inglés) para usar los nuestros.

### 3. `web/js/auth.js`

**Dominios permitidos**

```js
const DOMINIO_UNIVERSIDAD = "uvg.edu.gt"
const DOMINIO_PRUEBA = "gmail.com"          // QUITAR ANTES DE LA DEMO
function correoPermitido(correo) {
    return DOMINIOS_PERMITIDOS.some((dominio) => correo.endsWith('@' + dominio))
}
```

`some` devuelve `true` si **al menos uno** de los dominios cumple la condición.

**Registro, en este orden:**

1. `createUserWithEmailAndPassword` crea la cuenta.
2. `setDoc(doc(db, "usuarios", uid), { uid, nombre, carrera, esDemo: false })` crea tu
   documento con **solo esos 4 campos** (las reglas no dejan más al crear).
3. `updateProfile` guarda tu nombre en la cuenta (`displayName`), para el saludo.
4. `sendEmailVerification` manda el correo de verificación.
5. `signOut`: cierra la sesión hasta que verifiques.

**Entrar:** `signInWithEmailAndPassword`. Si `usuario.emailVerified` es `false`, se
muestra el aviso y el botón "Reenviar verificación".

**Ya tenías sesión (Etapa 8):**

```js
onAuthStateChanged(auth, (usuario) => {
    if (usuario && usuario.emailVerified) {
        window.location.replace("app.html")
    }
})
```

`onAuthStateChanged` avisa cuando Firebase sabe si hay alguien conectado (al abrir la
página tarda un momento). `replace` en vez de `href` no deja el login en el historial,
así el botón "atrás" no te regresa al login.

**`traducirError(codigo)`:** un objeto que convierte códigos como
`auth/invalid-credential` en frases en español. `??` da un mensaje genérico si el código
no está en la lista.

### 4. `web/js/sesion.js`

```js
export function protegerPagina() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, (usuario) => {
            if (!usuario || !usuario.emailVerified) {
                window.location.replace('index.html')
                return
            }
            resolve(usuario)
        })
    })
}
```

Una **Promise** es "una respuesta que llega después". `protegerPagina()` no responde
hasta que Firebase sabe quién eres. Si no hay sesión verificada, te saca; si la hay,
entrega el usuario. Por eso las páginas hacen `const usuario = await protegerPagina()`.

### 5. `web/js/panel.js`

`body.cargando` oculta el panel mientras se revisa la sesión (así no se ve un instante
de la página privada antes de redirigir). Cuando hay usuario, quita la clase, pone
"Hola, (nombre)" y conecta el botón "Cerrar sesión".

### 6. `firebase/firestore.rules`

```
function correoPermitido() {
  return request.auth != null
    && (request.auth.token.email.matches('.*@uvg[.]edu[.]gt$')
        || request.auth.token.email.matches('.*@gmail[.]com$'));  // QUITAR ANTES DE LA DEMO
}
```

- **Por qué la regla del dominio va TAMBIÉN aquí:** todo lo que corre en el navegador se
  puede saltar (cualquiera puede abrir la consola y llamar a Firebase directo con su
  `gmail`). Las reglas corren en los servidores de Google: ahí no se puede hacer trampa.
- `[.]` significa "un punto de verdad". En una expresión regular, un `.` solo significa
  "cualquier letra".
- `usuarios/{uid}`:
  - **read:** cualquier estudiante verificado (se necesita para el matching).
  - **create:** solo tu propio documento, solo con `uid, nombre, carrera, esDemo`, y con
    `esDemo == false`. No pide verificación porque se crea justo al registrarse.
  - **update:** solo tú, verificado, sin campos fuera de la lista y sin cambiar `uid` ni
    `esDemo`. (En la Fase 4 se agregó `perfilValido()`.)
  - **delete:** nadie, desde la app.
- Cualquier otra colección queda cerrada hasta que se escriban sus reglas.

---

## Conceptos nuevos

1. **Autenticación vs. autorización.** Auth dice *quién eres*; las reglas dicen *qué
   puedes hacer*.
2. **La validación del navegador es solo cortesía.** La seguridad real está en el
   servidor (reglas).
3. **`async` / `await` con `try` / `catch` / `finally`.** `finally` corre siempre: ahí
   se vuelve a habilitar el botón.
4. **Promise propia** (`new Promise((resolve) => ...)`) para esperar a Firebase.
5. **`location.replace` vs `location.href`.** `replace` no deja rastro en el historial.

---

## Cómo replicarlo tú

1. En <https://console.firebase.google.com>: crear proyecto, activar
   **Authentication → Correo/contraseña**, crear **Cloud Firestore** y registrar una app
   web. Pegar su configuración en `firebase-config.js`.
2. Escribir `index.html` con los dos formularios, después `auth.js` por partes:
   dominio → entrar → registro → reenviar → redirección.
3. Escribir `sesion.js` y `panel.js`, y agregar a `app.html`
   `<script type="module" src="js/panel.js"></script>`.
4. Copiar `firebase/firestore.rules` en **Firestore → Reglas** y **Publicar**.

---

## Cómo probarlo

1. `python -m http.server 8000` dentro de `carpool-zonas` y abrir
   <http://localhost:8000/web/index.html>.
2. Revisa:
   - [ ] Registrarse con `alguien@yahoo.com` → "Solo se aceptan correos @uvg.edu.gt."
   - [ ] Registrarse con tu correo → aparece el aviso de verificar.
   - [ ] Entrar sin verificar → "Tu correo aún no está verificado" y el botón
         "Reenviar verificación".
   - [ ] Verificar desde el correo y entrar → llegas a `app.html` y dice "Hola, (nombre)".
   - [ ] Abrir otra vez `index.html` con la sesión abierta → te manda directo al panel.
   - [ ] "Cerrar sesión" → vuelves al login; abrir `app.html` a mano → te regresa al login.
3. En Firebase → Firestore → `usuarios` aparece tu documento con `uid, nombre, carrera,
   esDemo: false`.
