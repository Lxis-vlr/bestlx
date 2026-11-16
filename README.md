# BESTLX

Tu centro de control en el iPhone (PWA): entregas de Canvas con prioridad, lectura, reto social diario, uso de redes, frase del día y preguntas para conversar. No usa IA ni APIs de pago.

Funciona desde el primer momento guardando en el teléfono. Al conectar tu Google Sheet, cada registro también se envía allá y no se pierde si Safari borra el almacenamiento.

## Qué hay en la carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html`, `styles.css`, `app.js` | La app: cinco pantallas y la lógica |
| `data/frases.json` | 368 frases originales (mitad español, mitad inglés) en 4 temas |
| `data/retos.json` | 100 retos sociales, 20 por nivel |
| `data/preguntas.json` | 200 preguntas, 40 por situación |
| `manifest.webmanifest`, `icons/` | Lo que permite instalarla en la pantalla de inicio |
| `sw.js` | Hace que abra sin internet |
| `apps-script/Code.gs` | El código que va en tu Google Sheet: guarda registros, lee Canvas y manda alertas (ver nota de seguridad) |

## 1. Crear el Sheet y el Apps Script

1. Crea un Google Sheet nuevo (separado del de gastos), por ejemplo "BESTLX".
2. En el Sheet: **Extensiones > Apps Script**. Borra lo que haya y pega todo `apps-script/Code.gs`.
3. En la primera línea útil cambia `CAMBIA-ESTE-TOKEN` por una clave tuya: un texto largo sin espacios. Es lo que impide que otra persona con la URL escriba en tu Sheet.
4. Arriba elige la función `setup` y pulsa **Ejecutar**. Google pedirá permiso para que el script edite ese Sheet; acéptalo. Se crean las pestañas Lectura, Libros, Social, Redes, Tiempo en pantalla y Canvas.
5. **Implementar > Nueva implementación > App web**. Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier persona**. Copia la URL que termina en `/exec`.

Si después editas `Code.gs`, ve a **Implementar > Gestionar implementaciones > Editar > Nueva versión**; si no, la URL sigue usando el código viejo.

## 2. Publicar en GitHub Pages

Desde esta carpeta:

```bash
git init                      # convierte la carpeta en un repositorio
git add .                     # prepara todos los archivos
git commit -m "BESTLX v1"     # guarda la primera versión
git branch -M main            # nombra la rama principal "main"
git remote add origin https://github.com/TU-USUARIO/bestlx.git   # enlaza con el repo que creaste en GitHub
git push -u origin main       # sube los archivos
```

Luego, en GitHub: **Settings > Pages > Source: Deploy from a branch > main / (root)**. En un minuto queda en `https://TU-USUARIO.github.io/bestlx/`.

Nota de seguridad: GitHub Pages gratis exige que el repo sea público. Por eso el token **no** va en ningún archivo del repo: `Code.gs` se sube con el valor de ejemplo, y tu token real solo vive en el Apps Script y en los Ajustes de la app en tu teléfono.

## 3. Instalar en el iPhone

Abre la dirección en **Safari** > botón Compartir > **Agregar a inicio**. Tiene que ser Safari; desde otro navegador no se instala como app.

## 4. Conectar la app con el Sheet

En la app: **Progreso > Ajustes y Google Sheet**. Pega la URL `/exec` y tu token, y toca **Guardar ajustes**. Lo que ya habías anotado se envía en ese momento.

## 5. Atajo que cuenta las aperturas de redes

En la app **Atajos** del iPhone, pestaña **Automatización**:

1. **Nueva automatización > App** > elige Instagram > **Se abre** > **Ejecutar inmediatamente**.
2. Acción: **Obtener contenido de URL**, con esta dirección (cambia la URL y el token por los tuyos):

   ```
   https://script.google.com/macros/s/XXXX/exec?action=redes&app=Instagram&token=TU-TOKEN
   ```

3. Repite para TikTok (`app=TikTok`) y X (`app=X`). El nombre debe ser igual al que aparece en los Ajustes de la app.

Cada apertura agrega una fila en la pestaña Redes con fecha y hora de Quito.

## 6. Recordatorio semanal

Los domingos la pantalla Hoy muestra un aviso para anotar las horas de Tiempo en pantalla. Si quieres también una notificación, crea en Atajos una automatización de **Hora del día** (domingo, 20:00) con la acción **Abrir URL** hacia tu app.

## 6. Conectar Canvas

Canvas no se lee desde el teléfono sino desde el Apps Script, que guarda las entregas en la pestaña Canvas del Sheet. El token de Canvas tiene el mismo acceso que tu cuenta: va en las Propiedades del script, nunca en el código ni en GitHub.

1. En Canvas: **Cuenta > Configuración**, baja hasta **Tokens de acceso aprobados** > **+ Nuevo token de acceso**. Propósito: "BESTLX"; fecha de vencimiento: vacía o fin del semestre. Copia el token: solo se muestra una vez.
2. En Apps Script: **Configuración del proyecto** (el engranaje de la izquierda) > **Propiedades del script** > **Agregar propiedad**:

   | Propiedad | Valor |
   |---|---|
   | `CANVAS_URL` | La dirección de tu Canvas tal como la ves en el navegador, sin nada después del dominio, por ejemplo `https://uide.instructure.com` |
   | `CANVAS_TOKEN` | El token que copiaste |
   | `EMAIL` | (opcional) a qué correo mandar las alertas; si falta usa el de tu cuenta de Google |

   Guarda las propiedades.
3. En el editor elige la función **`probarCanvas`** y pulsa **Ejecutar**. Acepta los permisos nuevos (acceder a servicios externos y enviar correo). En **Registro de ejecución** deben salir tus materias. Si sale `401`, el token está mal; si sale un error de URL, revisa `CANVAS_URL`.
4. Elige **`instalarActivadores`** y pulsa **Ejecutar**. Desde ahí `syncCanvas` corre cada hora sola.
5. Haz una **nueva versión** de la implementación (Implementar > Gestionar implementaciones > ✏️ > Nueva versión) para que la URL use este código.
6. En la app: **Clases > Sincronizar**. Las entregas aparecen en Clases y las tres más próximas en Hoy.

Qué hace cada hora:

- Lee tus materias activas, sus tareas (con tu entrega) y los grupos de calificación.
- Calcula cuánto pesa cada tarea en la nota final (puntos de la tarea sobre el total del grupo, por el peso del grupo; si la materia no pondera grupos, sobre el total del curso).
- Prioridad: **Alta** si pesa 5 % o más o vence en 48 h (pruebas: 72 h); **Media** si pesa de 2 % a 5 %; **Baja** el resto. Los umbrales están en la función `prioridad` de `Code.gs`.
- Manda un correo a 48 h y a 24 h de cada tarea no entregada, y a 72 h y 24 h de cada prueba. No repite el mismo aviso.

## 7. Notificación de las 7:00 con el resumen

En **Atajos > Automatización > +** > **Hora del día** > 7:00, Diariamente > **Ejecutar inmediatamente** > **Siguiente** > **Nueva automatización en blanco**:

1. Acción **Obtener contenido de URL** con (tu URL y tu token):

   ```
   https://script.google.com/macros/s/XXXX/exec?action=resumen&token=TU-TOKEN
   ```

2. Acción **Mostrar notificación**: en el título pon `BESTLX` y en el cuerpo elige la variable **Contenido de URL**.
3. Listo. Cada mañana llega una notificación con lo que vence hoy, mañana y en la semana, marcando con ⚠ lo de prioridad alta. Al tocarla puedes abrir la app.

## Cómo funciona por dentro

- **Frase del día:** se elige por el día del año, alternando idioma y tema.
- **Reto:** sale del nivel en el que estás, sin repetir los que ya hiciste. "Cambiar" da otro del mismo nivel. Subes de nivel al completar 5.
- **Rachas:** días seguidos con páginas leídas o con el reto hecho; si hoy aún no anotas, la racha de ayer se mantiene.
- **Sincronización:** cada registro se guarda en el teléfono y entra en una cola; la cola se envía al Sheet y, si no hay internet, se reintenta al volver a abrir la app. Al abrir, la app lee el Sheet para traer lo que anotó el Atajo y lo que trajo Canvas.
- **Pantallas:** Hoy · Clases · Lectura · Social (con las preguntas para conversar) · Progreso.

## Actualizar la app

Después de cambiar archivos, sube el número en la línea 3 de `sw.js` (`bestlx-v2` a `bestlx-v3`) antes de hacer `git push`; así el iPhone descarga la versión nueva.
