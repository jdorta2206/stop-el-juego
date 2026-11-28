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
