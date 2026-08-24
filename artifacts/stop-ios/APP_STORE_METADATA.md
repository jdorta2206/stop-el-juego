# STOP! Juego de Palabras Online — App Store preparation

## Identidad

- **Nombre:** STOP! Juego de Palabras Online
- **Bundle ID:** `com.dorynex.stopjuegodepalabras`
- **Scheme:** `stopjuego`
- **Web:** https://www.stopjuegodepalabras.com
- **Soporte:** https://www.stopjuegodepalabras.com/contacto
- **Privacidad:** https://www.stopjuegodepalabras.com/privacidad
- **Términos:** https://www.stopjuegodepalabras.com/terminos

## Descripción base

STOP! es un juego de palabras en el que eliges una letra y completas categorías antes de que termine el tiempo. Puedes jugar partidas en solitario contra la IA y partidas multijugador con amigos.

Incluye progresión, XP, niveles, rachas, logros, temporadas, reto diario, colección, inventario, cosméticos, tienda de monedas, Premium y el Pack Mundial.

## Funciones que deben quedar reflejadas

- Partidas en solitario contra IA.
- Dificultad Fácil y Experto por partida.
- Multijugador.
- Ranking.
- Reto diario.
- XP, niveles y rachas.
- Logros y temporadas.
- Monedas obtenidas jugando.
- Tienda y cosméticos.
- Colección e inventario.
- Premium.
- Pack Mundial.

## Compras dentro de la app

IDs preparados en código:

- Premium mensual: `com.dorynex.stopjuegodepalabras.premium.monthly`
- Pack Mundial: `com.dorynex.stopjuegodepalabras.pack.mundial`

El precio del Pack Mundial en la versión actual es 2,99 €.

**Pendiente obligatoriamente después de disponer de Apple Developer/App Store Connect:** crear los productos, configurar precios/regiones y conectar la verificación de transacciones del servidor.

## Privacidad / App Privacy — pendiente de validación final

No publicar estas respuestas automáticamente. Hay que confirmar con el código final y la configuración de los proveedores:

- Identificadores de cuenta para Google, Facebook y Apple.
- Nombre y correo cuando el proveedor los entrega.
- Datos de progreso del juego: puntuaciones, XP, niveles, rachas, logros, monedas, inventario y colección.
- Datos relacionados con compras y suscripciones.
- Datos técnicos necesarios para autenticación, seguridad y funcionamiento.

## Edad / clasificación

Pendiente de completar el cuestionario oficial de Apple después de revisar todas las funciones publicadas y cualquier contenido generado por usuarios.

## Capturas

Pendiente generar capturas reales del build iOS. No reutilizar capturas Android si no coinciden con la interfaz final de iPhone/iPad.

## Revisión de Apple

Explicar en Review Notes que:

1. La app permite jugar sin necesidad de pagar Premium.
2. El multijugador requiere iniciar sesión.
3. Premium y Pack Mundial son compras dentro de la app.
4. Las compras se verifican en servidor antes de conceder contenido.
5. El Pack Mundial contiene 27 cosméticos.
6. El juego comparte backend con web y Android para mantener progreso y cuenta.

**Pendiente:** proporcionar una cuenta de revisión si Apple la necesita para probar las funciones autenticadas.
