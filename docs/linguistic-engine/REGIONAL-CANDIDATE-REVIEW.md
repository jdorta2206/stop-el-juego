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
