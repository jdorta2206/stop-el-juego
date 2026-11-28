# Revisión priorizada de candidatos regionales del español

**Estado:** investigación documental; no es una lista de palabras aprobadas para STOP.  
**Inventario de origen:** artefacto `hunspell-spanish-candidates-79195b0`, generado por el workflow de 21 locales el 2026-11-28.  
**Regla:** Hunspell solo descubre candidatos. La aparición en un locale no demuestra que la palabra sea exclusiva ni que el significado encaje. MCR/WordNet aporta sentidos auxiliares, pero su licencia CC BY 3.0 no está aprobada para el runtime y sus sentidos pueden ser incompletos o desalineados.

## Candidatos con respaldo lexicográfico externo

| Forma | Locale del inventario | Evidencia externa | Lectura provisional para STOP | Estado |
|---|---|---|---|---|
| `guache` | es-CO | ASALE, Diccionario de americanismos: sustantivo/adjetivo en Colombia y Venezuela para persona de modales bruscos o maleducada; también sustantivo colombiano para coatí. | Sustantivo/adjetivo común; conservar acepciones separadas. | **Prioridad alta para revisión** |
| `paisa` | es-CO | ASALE: sustantivo/adjetivo para natural de Antioquia; también usos en otros países con otros sentidos. | Gentilicio/adjetivo y sustantivo de persona; validar reglas de STOP sobre gentilicios. | **Prioridad alta para revisión** |
| `zaraza` | es-VE | ASALE, Diccionario de americanismos: sustantivo femenino para tela de algodón estampada en varios países americanos. | Sustantivo común concreto. | **Prioridad alta para revisión** |

### Fuentes primarias consultadas

- ASALE, [guache](https://www.asale.org/damer/guache): Colombia y Venezuela; persona de modales bruscos/maleducada y, en Colombia, coatí.
- ASALE, [paisa](https://www.asale.org/damer/paisa): varios sentidos y distribución geográfica; para Colombia, natural de Antioquia.
- ASALE, [zaraza](https://temporalweb.asale.org/damer/zaraza): tela de algodón estampada en México, Honduras, Panamá, Colombia, Venezuela y Ecuador; también otros usos regionales.

## Candidato que no debe aprobarse con la evidencia actual

- `trabajito` aparece en el inventario es-HN y el cruce MCR devuelve un sentido relacionado con delito/robo. Sin embargo, la entrada consultada del Diccionario de americanismos de ASALE asigna a `trabajito` el sentido de embrujo/hechizo en México, El Salvador y Bolivia, no Honduras. Una fuente secundaria ofrece una acepción hondureña, pero no basta para aprobarla. Mantener pendiente hasta obtener fuente hondureña fiable y confirmar el sentido exacto.

## Límites y siguientes verificaciones

1. Confirmar si STOP admite gentilicios, adjetivos y nombres de animales en cada categoría; la aprobación léxica no implica aprobación de categoría.
2. Registrar para cada acepción país/zona, categoría gramatical, definición, ejemplo/cita, fuente, fecha de consulta y licencia.
3. No importar automáticamente formas flexionadas, nombres propios, topónimos ni sentidos de MCR.
4. Mantener `lexicalApproval=false` y `categoryApproval=false` hasta que exista revisión documentada y una fuente cuya licencia sea compatible con el runtime.
5. El mapeo Hunspell `es-XX` es una pista de procedencia del diccionario, no prueba de que una palabra solo se use en ese país.

## Resultado

Esta primera pasada reduce el universo a tres candidatos con respaldo académico externo claro para revisión humana. **No se ha añadido ninguna palabra al diccionario de producción ni se ha cambiado el comportamiento del juego.**


## Segunda pasada: voces regionales para contrastar con el inventario

Estas entradas se han localizado en el Diccionario de americanismos de ASALE. Son **pistas documentales nuevas**, no se afirma aquí que estén confirmadas en el artefacto Hunspell citado arriba: antes de incorporarlas al catálogo de candidatos hay que verificar la forma exacta y el locale en el JSONL de origen.

| Forma | Evidencia ASALE | Revisión semántica pendiente |
|---|---|---|
| `profesionista` | México, Guatemala, Honduras, Nicaragua, Costa Rica, Ecuador y Bolivia: persona que ejerce su profesión con competencia. | Sustantivo común de persona; comprobar que STOP permite profesiones/personas y que no se duplica como variante de `profesional`. |
| `cochinera` | Venezuela: lugar donde se crían cochinos. | Sustantivo común de lugar; revisar género y categoría admitida. |
| `natilla` | Colombia: plato navideño; Perú: dulce de leche, chancaca y harina de arroz; Nicaragua y Costa Rica: nata o crema agria; Uruguay: otro dulce. | Una misma forma tiene sentidos regionales distintos; no reducirlos a una definición genérica. |
| `jagua` | Árbol y fruto documentados en numerosos países americanos, con distribución que varía según la acepción. | Sustantivo común de planta/fruto; comprobar si la categoría de juego admite ambos sentidos. |
| `vaquería` | Colombia: oficio del vaquero; México (sureste): baile campesino yucateco; República Dominicana y Puerto Rico: ordeñadero. | Polisemia regional importante; verificar categoría y si la definición corresponde al país pertinente. |

### Fuentes primarias de esta segunda pasada

- ASALE, [profesionista](https://www.asale.org/damer/profesionista).
- ASALE, [cochinera](https://www.asale.org/damer/cochinera).
- ASALE, [natilla](https://www.asale.org/damer/natilla).
- ASALE, [jagua](https://www.asale.org/damer/jagua).
- ASALE, [vaquería](https://www.asale.org/damer/vaquer%C3%ADa).
- RAE/ASALE, [Nueva gramática: alternancias geográficas de -ista](https://www.rae.es/gram%C3%A1tica/morfolog%C3%ADa/nombres-de-persona-instrumento-y-lugar-iv-el-sufijo-ista), que documenta específicamente `profesionista` en México.

No se concede aprobación léxica ni de categoría a estas cinco voces. La siguiente operación necesaria es el cruce exacto con los registros de los 21 locales y, después, la validación de categoría/acepción. La licencia y procedencia de cualquier fuente usada en runtime siguen siendo un control independiente.


## Resultado del cruce exacto con el inventario Hunspell (2026-11-28)

Se contrastaron las cinco formas propuestas contra los 21 archivos regionales del artefacto `hunspell-spanish-candidates-79195b0` y contra su fichero de cruce léxico.

| Forma consultada | Registro exacto en Hunspell | Evidencia del cruce | Resultado |
|---|---|---|---|
| `profesionista` | Sí, es-MX, minúscula, línea 46252. | MCR: sustantivo «persona que ha aprendido una profesión y se dedica a ello»; RLA line 69149. | Candidata consistente para revisión de categoría. |
| `cochinera` | Sí, es-VE, minúscula, línea 13347. | MCR: sustantivo «corral para cerdos»; RLA line 22108. | Candidata consistente para revisión de categoría. |
| `natilla` | Sí, es-CR, minúscula, línea 38072. | MCR: sustantivo con sentido culinario; RLA line 60257. | Candidata consistente; validar las acepciones regionales ASALE por separado. |
| `jagua` | **No en minúscula**: el registro del locale es-CO aparece como `Jagua` (mayúscula inicial), línea 2610. | MCR encuentra sentidos de sustantivo/fruto; RLA line 51350. | No tratar como coincidencia exacta de minúsculas hasta revisar por qué la fuente capitaliza la forma. |
| `vaquería` | **No en minúscula**: el registro del locale es-CO aparece como `Vaquería` (mayúscula inicial), línea 5267. | MCR encuentra sentidos nominales; RLA line 85191. | No tratar como coincidencia exacta de minúsculas hasta revisar por qué la fuente capitaliza la forma. |

### Decisión de esta pasada

- Tres coincidencias exactas en minúscula: `profesionista`, `cochinera`, `natilla`.
- Dos coincidencias solo con mayúscula inicial: `Jagua`, `Vaquería`; quedan en cuarentena de revisión de capitalización y posible nombre propio.
- El cruce MCR/RLA es auxiliar, no una aprobación independiente ni una autorización de licencia para runtime.
- Las cinco siguen con `lexicalApproval=false` y `categoryApproval=false`. Ninguna se incorpora al diccionario puntuable.


## Requisito de producto: variantes lingüísticas independientes de la ubicación

La variante de español que utiliza una persona **no debe inferirse ni limitarse por su ubicación física, país de residencia, IP, tienda o configuración regional del dispositivo**.

Ejemplo de aceptación: una persona que juega desde España debe poder utilizar vocabulario argentino válido; igualmente, desde Argentina debe poder utilizar vocabulario mexicano, colombiano o de España.

### Reglas para el motor léxico

1. La ubicación física no es un filtro de validez léxica.
2. Las etiquetas regionales (es-ES, es-AR, es-MX, es-CO, etc.) describen dónde está documentado un uso; no son una restricción de dónde puede jugarse.
3. El motor debe consultar el conjunto de variantes españolas admitidas, conservando la procedencia y la acepción regional de cada voz.
4. Si existe selector de variante o preferencia de idioma, será una preferencia de experiencia/ordenación, nunca una barrera que invalide palabras documentadas en otras regiones.
5. Una voz solo se acepta si está acreditada como palabra real y su acepción encaja con la categoría de la ronda. No se acepta una invención por el mero hecho de etiquetarla como regional.
6. La ubicación puede servir para sugerir una variante inicial, siempre que el jugador pueda cambiarla y que esa sugerencia no limite el vocabulario puntuable.

### Pruebas de aceptación propuestas

- Jugador ubicado en España + voz argentina documentada: evaluar por evidencia léxica y categoría, no rechazar por ubicación.
- Jugador ubicado en Argentina + voz mexicana documentada: mismo criterio.
- Jugador con variante preferida es-ES + voz colombiana documentada: no rechazar solo por la preferencia.
- Voz inventada o con acepción que no corresponde a la categoría: rechazar o enviar a revisión, aunque la variante seleccionada coincida.

Este requisito es una decisión de comportamiento para el diseño del motor; **no significa que las palabras candidatas actuales estén aprobadas ni que el comportamiento de producción haya cambiado**.


## Auditoría de integración con el validador actual (2026-11-28)

Se inspeccionó el flujo actual de validación en `artifacts/api-server/src/routes/game.ts`, `artifacts/api-server/src/lib/wordRules.ts` y `artifacts/api-server/src/lib/aiWordValidator.ts`.

Hallazgos:

1. El validador síncrono recibe un código de idioma (`es`, `en`, `pt`, `fr`, `it`) y consulta el diccionario de ese idioma. No recibe ubicación física ni locale regional del jugador; por tanto, la ubicación no aparece como filtro en ese punto.
2. En español, el diccionario estático actual no demuestra todavía cobertura completa de las variantes regionales. La nueva base lingüística debe ampliar cobertura por evidencia, sin convertir `es-ES` en requisito.
3. La ruta de respaldo con IA puede decidir sobre palabras ausentes del diccionario estático. Su prompt actual pide aceptar regionalismos, pero una respuesta afirmativa de IA no constituye por sí sola prueba lexicográfica independiente. No debe convertirse en aprobación definitiva del diccionario ni sustituir la revisión de fuentes.
4. El validador estático permite actualmente que una respuesta empiece por una entrada del diccionario (`normalizedWord.startsWith(nw)`). Esto puede aceptar extensiones no documentadas. Se registra como riesgo separado para una futura corrección, que deberá respetar las reglas de flexión aprobadas y evitar regresiones.
5. La normalización de juego actual elimina tildes para comparación. La futura validación léxica debe conservar la forma original y sus distinciones ortográficas; cualquier tolerancia de entrada debe ser una regla explícita, no una pérdida de evidencia.

### Plan seguro de integración

- Mantener la validación por idioma general (`es`) y consultar el conjunto de formas españolas revisadas de todas las regiones.
- Conservar locale/procedencia como metadatos de cada acepción, nunca como filtro por país del jugador.
- Separar existencia léxica, flexión/variantes ortográficas y elegibilidad de categoría.
- La IA solo puede proponer una revisión; no aprobar por sí sola una forma.
- Antes de sustituir el validador actual, añadir pruebas de regresión para todas las categorías, primera letra, flexiones, acentos, `ñ`, y los idiomas ya soportados.
- No cambiar el comportamiento de producción hasta que haya fuentes licenciadas, corpus revisado y una migración probada.

Esta auditoría es documental y no modifica el comportamiento del juego ni la producción.


## Riesgo adicional: caché permanente de veredictos de IA (2026-11-28)

La inspección de `artifacts/api-server/src/lib/aiWordValidator.ts` confirma que:

1. Cuando no existe una entrada en caché, el fallback puede pedir a la IA un sí/no sobre la palabra y categoría.
2. El resultado se escribe en `word_validation_cache` con `source='ai'` y el modelo utilizado.
3. Las consultas posteriores devuelven directamente ese veredicto cacheado, sin volver a contrastarlo con una fuente lexicográfica.
4. La caché no incluye versión de política lingüística ni versión de evidencia en su clave actual (`word, category, lang`).

**Riesgo:** una aceptación errónea de IA puede persistir indefinidamente y sobrevivir a una futura mejora del diccionario. Cambiar el prompt o incorporar fuentes nuevas no invalida automáticamente esas decisiones antiguas.

### Requisitos antes de integrar el motor basado en evidencia

- No tratar los registros con `source='ai'` como evidencia léxica ni como aprobación de categoría.
- Diseñar una migración/revisión de caché que distinga veredictos históricos de IA de decisiones basadas en evidencia revisada.
- Versionar la política o la evidencia para que cambios de reglas no reutilicen decisiones obsoletas sin revisión.
- No borrar ni modificar cachés de producción en esta fase documental.
- Hasta que exista el motor revisado, no presentar el fallback de IA como garantía de validez lexicográfica.

Este hallazgo es documental: no se han modificado rutas, cachés, puntuaciones ni datos de producción.



## Segunda auditoría Hunspell de 21 locales (2026-11-28)

Se completó el workflow **Hunspell Spanish candidate inventory**, run `46138274949`, sobre el commit `8a6e93237cd4f3c7e18a938ed729581acc32d282`. Artefacto: `hunspell-spanish-candidates-79195b0` (ID `15260204399`, SHA-256 `f6ec0c5947bcaa342309034c65da86e1754b44308a2cd87b7f67f09a2095f805`).

### Inventario y controles

- 21 locales procesados; 1.203.534 entradas originales.
- 65.558 formas normalizadas únicas; 10.293 aparecen en un solo locale; 53.833 aparecen en los 21.
- 1.137.976 ocurrencias duplicadas al comparar el total bruto con las formas únicas globales.
- 65.468 registros clasificados como candidatos alfabéticos simples; 48 registros con banderas de revisión manual (incluye puntuación, espacios, caracteres de control o formato).
- Hunspell aceptó 1.203.486 entradas y rechazó 0. Es un autocontrol contra los mismos diccionarios de origen, no una prueba léxica independiente.
- El cruce auxiliar registra 27.764 coincidencias MCR, 51.524 coincidencias RLA, 26.555 coincidencias en ambas, 12.721 sin coincidencia en esas fuentes y 134 análisis morfológicos argentinos de FreeLing.
- Todos los registros mantienen `lexicalApproval=false` y `categoryApproval=false`.

### Interpretación del cruce

- **MCR 3.0** aporta sentidos auxiliares, pero su licencia CC BY 3.0 no está aprobada para el runtime; además, la definición puede corresponder a otro sentido o estar mal alineada.
- **RLA-ES** declara dedicación de dominio público en el repositorio, pero no se ha establecido independencia de procedencia respecto a Hunspell. No contar coincidencias RLA como corroboración independiente hasta resolver el linaje.
- **FreeLing argentino** aporta análisis morfológicos para un conjunto limitado de verbos, no un diccionario general. Sus resultados no aprueban automáticamente las formas de superficie ni su categoría.
- La presencia en un único fichero regional tampoco prueba exclusividad geográfica. Las etiquetas es-XX son metadatos de procedencia del inventario, nunca filtros para el jugador.

### Muestra de falsos positivos y revisión semántica

El filtro «una sola región + definición MCR» devuelve 94 filas, pero no una lista de 94 regionalismos aprobables. La muestra contiene nombres propios y topónimos (`Allen`, `Arizona`, `Ariadna`, `Armando`, `Orinoco`), palabras comunes con sentidos no pertinentes (`a`, `C`, `paisa` como unidad monetaria, `guache` como técnica pictórica), y formas potencialmente útiles cuya acepción debe contrastarse con ASALE (`cochinera`, `natilla`, `profesionista`, `zaraza`). Por tanto, el cruce debe usarse para priorizar revisión, no para aprobar por lote.

### Decisión

1. Mantener el inventario completo como material de investigación, no como diccionario puntuable.
2. Priorizar la revisión humana de formas con fuente primaria regional (por ejemplo, ASALE) y sentido/categoría claramente identificados.
3. Separar nombres propios, topónimos, flexiones, derivaciones y homónimos antes de evaluar su utilidad en STOP.
4. No aceptar una forma por su mera presencia en Hunspell, por una coincidencia MCR/RLA o por el resultado de un analizador morfológico.
5. No importar el artefacto ni cambiar runtime, cachés, puntuaciones o datos de producción.

**Resultado:** la extracción y el cruce han terminado correctamente; no se ha aprobado ninguna palabra ni se ha modificado el comportamiento del juego.



## Revisión de encaje con categorías actuales de STOP (2026-11-28)

Se contrastaron las acepciones ASALE de los ocho candidatos priorizados con las categorías que aparecen en el validador actual (`animal`, `fruta`, `alimento`, `objeto`, `lugar`, `nombre`, entre otras). Esta tabla es una evaluación de encaje semántico preliminar, no una aprobación de categoría.

| Forma | Acepción documentada que se evalúa | Categoría candidata | Riesgo / decisión provisional |
|---|---|---|---|
| `guache` | Persona de modales bruscos; también coatí en Colombia | `animal` solo para el sentido coatí | No aceptar automáticamente como animal por el sentido de persona; conservar las acepciones separadas. |
| `paisa` | Natural de Antioquia | `nombre` no equivale a nombre propio | Es gentilicio/sustantivo de persona; no encaja en `nombre` si esa categoría significa nombre propio. Requiere regla explícita sobre gentilicios. |
| `zaraza` | Tela de algodón estampada | `objeto` solo si STOP admite materiales/telas como objetos | Sustantivo común, pero el límite de `objeto` debe definirse antes de puntuarla. |
| `profesionista` | Persona que ejerce una profesión con competencia | Ninguna categoría actual evidente | No debe colarse en `nombre`; requiere categoría de profesión/persona o regla abierta documentada. |
| `cochinera` | Lugar donde se crían cochinos | `lugar` | Encaje razonable como sustantivo común de lugar; comprobar que la categoría abierta no convierte cualquier cadena en válida. |
| `natilla` | Preparación/dulce culinario con acepciones regionales distintas | `alimento` | Encaje semántico alto; conservar las definiciones regionales y no fusionar sentidos diferentes. |
| `jagua` | Árbol y fruto | `fruta` solo para el sentido fruto | La fuente Hunspell solo ofrece mayúscula inicial; no usarla como evidencia de forma común minúscula. La acepción árbol no es fruta. |
| `vaquería` | Ordeñadero (entre otros sentidos regionales) | `lugar` solo para ese sentido | Mantener separadas las acepciones de oficio y baile; el registro Hunspell con mayúscula sigue en cuarentena. |

### Reglas que se desprenden de la revisión

1. La validez léxica de una forma no implica que valga en todas las categorías.
2. Una palabra polisémica puede ser elegible en una categoría por una acepción concreta, pero no por sus otros sentidos.
3. No equiparar `nombre` (nombre propio) con sustantivo de persona o gentilicio.
4. Definir explícitamente el alcance de `objeto` (¿incluye materiales y tejidos?) y de `lugar` (¿incluye instalaciones y establecimientos?).
5. Las categorías abiertas actuales no son un estándar léxico: aceptan respuestas seguras de longitud mínima. No deben utilizarse como prueba de que una candidata está acreditada.
6. Antes de habilitar categorías, cada evidencia debe enlazar la acepción revisada y su categoría exacta; una mera coincidencia de palabra no basta.

**Resultado:** `natilla` y la acepción de lugar de `cochinera` presentan el encaje semántico más claro con categorías existentes. `guache`, `jagua` y `vaquería` son polisémicas y requieren selección explícita de acepción; `paisa`, `profesionista` y `zaraza` dependen de reglas de categoría aún no definidas. No se aprueba ninguna ni se cambia el runtime.
