# Google Play Billing — Guía de instalación

Esta guía explica los pasos manuales para activar el pago con Google Play en la app STOP. El código del servidor y del cliente ya está implementado; aquí solo se cubre la configuración externa (Play Console, Google Cloud, generación del AAB, secrets).

Hazlo en este orden exacto. Cada paso depende del anterior.

---

## 1. Verificar la cuenta de comercio

**Quién:** tú (manual).
**Dónde:** Play Console → Configuración → Pagos.

Antes de poder crear suscripciones, tu cuenta de Payments Merchant Center tiene que estar **verificada** (no solo creada). Sigue las instrucciones del banco para introducir el importe del micro-depósito que Google envía.

Hasta que esto esté en verde, los pasos siguientes fallarán con errores genéricos.

---

## 2. Crear el producto de suscripción

**Quién:** tú (manual).
**Dónde:** Play Console → tu app STOP → Monetizar con Play → Productos → Suscripciones → "Crear suscripción".

Datos exactos:

| Campo | Valor |
|---|---|
| ID del producto | `premium_monthly` |
| Nombre | `STOP Premium` |
| Descripción | "Sin anuncios, espía 2x, anillo dorado y bonus de XP" |
| Periodo de facturación | 1 mes |
| Precio base | 1,99 € (España) |
| Renovación | Automática |
| Periodo de prueba | 7 días (opcional pero recomendado) |

⚠️ El **ID `premium_monthly` es obligatorio** y exacto: el cliente lo referencia literalmente al lanzar `PaymentRequest`. Si lo cambias, las compras fallarán.

Tras crear el producto, **actívalo** y espera 2-4 horas a que Google lo propague.

---

## 3. Crear un Service Account

**Quién:** tú (manual).
**Dónde:** Google Cloud Console + Play Console.

El servidor usa un Service Account para llamar a la Google Play Developer API y validar las compras (paso obligatorio — nunca confiamos solo en el cliente).

### 3.1 En Google Cloud Console

1. Entra en [console.cloud.google.com](https://console.cloud.google.com).
2. Crea un proyecto nuevo (o usa uno existente). Apunta el ID del proyecto.
3. Ve a **APIs & Services → Library** y activa la **"Google Play Android Developer API"**.
4. Ve a **IAM & Admin → Service Accounts → Create Service Account**.
   - Nombre: `stop-play-billing`
   - No le des roles aquí (los daremos en Play Console).
5. Una vez creada, abre la cuenta → pestaña **"Keys"** → **Add Key → Create new key → JSON**.
6. Se descargará un archivo `.json`. **Guárdalo en sitio seguro y no lo subas al repo.**

### 3.2 En Play Console

1. Play Console → **Configuración (engranaje) → Acceso a la API**.
2. Verás la lista de Service Accounts vinculados con el proyecto. Si tu nuevo SA no aparece, pulsa **"Vincular"** y elige el proyecto Cloud del paso 3.1.
3. Una vez vinculado, junto al SA pulsa **"Conceder acceso"**.
4. Dale los permisos:
   - **Ver datos financieros, pedidos y respuestas a encuestas**
   - **Gestionar pedidos y suscripciones**
5. Guarda.

---

## 4. Configurar los secrets en el servidor

**Quién:** tú (manual, en Replit).
**Dónde:** ⋮ → **Tools → Secrets**.

Añade dos secrets nuevos:

| Nombre | Valor |
|---|---|
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | El contenido **completo** del archivo `.json` del paso 3.1.5 (pégalo entero, una sola línea o multilínea, ambos funcionan). |
| `ANDROID_PACKAGE_NAME` | El package name de tu APK, ej. `com.dorynex.stop`. Se ve en Play Console arriba de la app. |
| `PUBSUB_PUSH_AUDIENCE` | La URL exacta del webhook que pondrás en Pub/Sub (paso 5.3): `https://stop-el-juego.replit.app/api/billing/play/webhook`. |
| `PUBSUB_PUSH_SA_EMAIL` | El email de la Service Account que firmará los pushes de Pub/Sub. Si reusas la del paso 3, es del estilo `stop-play-billing@<project-id>.iam.gserviceaccount.com`. |

Una vez añadidos, **reinicia el workflow** `artifacts/api-server: API Server` (en el panel de workflows pulsa Stop y Run, o usa el botón de restart).

Verifica que el servidor arrancó sin errores: en los logs **no** debe aparecer el aviso `[playBilling] GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not set`.

---

## 5. Configurar Pub/Sub para notificaciones (RTDN)

**Quién:** tú (manual, una sola vez).
**Dónde:** Google Cloud Console + Play Console.

Esto permite que Google nos avise en tiempo real cuando un usuario cancela, renueva o pide reembolso, así actualizamos el premium automáticamente sin esperar a que el usuario abra la app.

### 5.1 Crear el topic

1. Cloud Console → **Pub/Sub → Topics → Create topic**.
2. Topic ID: `stop-play-rtdn`. No marques "Add a default subscription".

### 5.2 Dar permiso a Google Play para publicar

1. Abre el topic `stop-play-rtdn`.
2. Pestaña **"Permissions"** (o icono de candado) → **Add Principal**.
3. Principal: `google-play-developer-notifications@system.gserviceaccount.com`
4. Rol: **Pub/Sub Publisher**.
5. Guarda.

### 5.3 Crear la subscription que llama a nuestro webhook

1. En el mismo topic → **Create Subscription**.
2. ID: `stop-play-rtdn-push`.
3. Delivery type: **Push**.
4. Endpoint URL: `https://stop-el-juego.replit.app/api/billing/play/webhook` (debe coincidir EXACTAMENTE con `PUBSUB_PUSH_AUDIENCE`).
5. **Enable authentication** → marca la casilla y elige la Service Account del paso 3.1 (la misma que usaste para `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`). Audience: deja en blanco para que use la URL del endpoint.
6. Resto de opciones por defecto (Acknowledgement deadline: 10s; Message retention: 7d).

⚠️ Sin el paso 5 nuestro servidor rechaza todos los pushes con 401 porque no se puede verificar la firma JWT.

### 5.4 Configurar el topic en Play Console

1. Play Console → tu app → **Monetizar con Play → Configuración de monetización**.
2. Sección **"Notificaciones del desarrollador en tiempo real"** → marca **"Activar notificaciones en tiempo real"**.
3. Pega el nombre completo del topic en formato:
   `projects/<TU_PROJECT_ID>/topics/stop-play-rtdn`
4. Pulsa **"Enviar notificación de prueba"** — debe llegar a los logs del API con el mensaje `received Pub/Sub test notification`.

---

## 6. Generar el AAB con Play Billing activado

**Quién:** tú (manual, requiere Bubblewrap CLI en local o Codemagic).
**Dónde:** local o servicio de CI Android.

El TWA actual tiene que regenerarse para incluir el permiso de Play Billing. Sin esto, el `getDigitalGoodsService` del cliente devolverá undefined y el código caerá automáticamente al canal Stripe (lo cual no es lo que queremos en la versión Play Store).

### 6.1 Instalar Bubblewrap

```bash
npm install -g @bubblewrap/cli
```

### 6.2 Editar el manifest

En tu carpeta local del proyecto TWA, abre `twa-manifest.json` y añade/asegúrate de tener:

```json
{
  "features": {
    "playBilling": {
      "enabled": true
    }
  }
}
```

### 6.3 Regenerar y compilar

```bash
bubblewrap update
bubblewrap build
```

Te pedirá la keystore que usaste la última vez. El AAB resultante estará en `app-release-bundle.aab`.

### 6.4 Subir a Play Console

1. Play Console → tu app → **Producción** (o **Pruebas internas** la primera vez).
2. **Crear nueva versión** → arrastra el `.aab`.
3. Rellena las notas de la versión: "Pago integrado con Google Play".
4. **Revisar versión → Empezar lanzamiento a producción**.

⚠️ Si es la primera versión con Play Billing, te recomiendo subirlo primero a **Pruebas internas** y añadirte como tester (con tu cuenta personal de Google) para hacer una compra real de prueba antes de publicar a todos.

---

## 7. Probar la compra

1. Abre la app de Play Store en tu móvil con la cuenta de tester.
2. Instala/actualiza STOP a la versión nueva.
3. Pulsa **"Hazte Premium"** dentro de la app.
4. Debe abrirse la **hoja nativa de Google Play** (no Stripe).
5. Confirma la compra con tu método de pago.
6. La app debe recargarse y mostrar el icono de premium activo.
7. Verifica en los logs del API: `[playBilling] verify success for player <id>`.

Si algo falla, los puntos típicos a revisar:
- `productId` debe ser exacto `premium_monthly`.
- El `package_name` del AAB instalado debe coincidir con `ANDROID_PACKAGE_NAME`.
- El SA debe tener los dos permisos del paso 3.2.4.
- La hora del servidor debe estar sincronizada (la API de Google rechaza requests con clock skew > 5 min).

---

## Apéndice — Cómo se decide qué canal usar

El cliente decide en tiempo de ejecución, una sola vez por sesión:

```
canal = "play" si:
   document.referrer empieza por "android-app://"  Y
   window.getDigitalGoodsService("https://play.google.com/billing") resuelve
canal = "stripe" en cualquier otro caso
```

Por tanto:
- **Web (`stop-el-juego.replit.app` en navegador):** Stripe, sin cambios.
- **TWA Play Store con AAB nuevo:** Play Billing.
- **TWA Play Store con AAB viejo (sin la feature):** Stripe (fallback automático).

Esto significa que el día que subas el AAB nuevo, los usuarios existentes que ya tienen Stripe **no se ven afectados**: siguen pagando por Stripe hasta que renueven su app desde Play Store. Las nuevas compras (después de actualizar) van por Play. No se hace migración automática — cada usuario paga por donde se dio de alta.
