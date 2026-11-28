# Política de elegibilidad por categoría (propuesta)

**Estado:** propuesta de producto para revisión; no activa en runtime y no aprueba vocabulario.  
**Ámbito:** motor lingüístico compartido de STOP, todos los idiomas y variedades regionales.  
**Regla superior:** primero se acredita la forma y la acepción; después se decide si esa acepción responde a la categoría de la ronda.

## Principios obligatorios

1. **La región no limita al jugador.** Una acepción documentada en cualquier variedad admitida puede usarse desde cualquier país. `locale` registra procedencia y distribución; nunca es una condición de rechazo por ubicación, IP o preferencia regional.
2. **La unidad de revisión es la acepción, no solo la cadena.** Una palabra polisémica puede encajar en una categoría por un sentido y no por otro.
3. **Existencia y categoría son decisiones distintas.** Una fuente que demuestra que una voz existe no demuestra que sea animal, fruta, lugar, objeto, color, nombre o marca.
4. **No se deduce elegibilidad por prefijo, longitud, plausibilidad ni respuesta afirmativa de IA.** Las flexiones se aceptan solo mediante evidencia morfológica/reglas aprobadas.
5. **Resultado triestado:** `valid` requiere evidencia léxica y de categoría; `invalid` requiere una contradicción o incumplimiento claro; `unknown` significa evidencia insuficiente y no concede puntos automáticamente.
6. **La misma decisión debe aplicarse online y offline** con la misma versión de política y bundle léxico.
7. **La política no resuelve licencias.** Cada fuente y cada dato importado necesitan licencia, atribución, versión y procedencia aprobadas por separado.

## Definiciones propuestas para las categorías españolas actuales

| Categoría | Aceptar cuando la acepción revisada es… | No aceptar por esta categoría… | Observaciones |
|---|---|---|---|
| `animal` | Nombre común de un animal, especie o grupo zoológico; incluye nombres regionales documentados. | Persona, gentilicio, insulto, marca o nombre propio sin evidencia de que sea nombre común de animal. | Un mismo lema puede tener un sentido animal y otro humano; solo puntúa el sentido animal. |
| `color` | Nombre de un color o matiz cromático reconocido en el idioma, incluidos nombres regionales de color. | Material, piedra, alimento u objeto cuyo color sea incidental; adjetivo que no denote color. | No convertir automáticamente todo nombre de pigmento/material en color sin verificar el uso cromático. |
| `fruta` | Nombre común de un fruto comestible usado como alimento, según la acepción documentada. | Árbol/planta por sí solos, herramienta, marca o acepción regional no alimentaria. | Distinguir fruto y planta cuando una forma tenga ambos sentidos. |
| `nombre` | Nombre propio de persona usado como nombre de pila o nombre personal, con evidencia apropiada. | Sustantivo común de persona, profesión, gentilicio, adjetivo o apodo no establecido como nombre propio. | Los nombres propios necesitan una fuente/registro adecuado; un diccionario general de palabras no basta. Acordar aparte el tratamiento de hipocorísticos y variantes de escritura. |
| `lugar` | Topónimo o nombre común de un espacio/localización identificable: ciudad, país, región, barrio, accidente geográfico o instalación/lugar funcional. | Persona, gentilicio, evento, empresa o edificio/marca cuando la acepción no designa un lugar. | Los nombres de instalaciones como un ordeñadero pueden encajar; documentar la acepción exacta. Los nombres propios geográficos requieren evidencia de topónimo. |
| `objeto` | Sustantivo común que designa una entidad física identificable, normalmente tangible y manipulable o utilizable; puede incluir herramientas, utensilios, prendas, muebles y artefactos. | Sustancia/material abstracto, tejido como material, proceso, cualidad, profesión, lugar o ser vivo. | Propuesta conservadora: materiales y tejidos no cuentan salvo que la categoría se amplíe expresamente a «cosas/materiales». |
| `marca` | Nombre propio de una marca comercial identificable de producto, servicio u organización, con evidencia independiente. | Producto genérico, empresa sin uso como marca, palabra común coincidente o nombre inventado. | Se necesita una fuente de marcas/registro o evidencia corporativa; una lista lingüística no acredita marcas. |
| `excusa` (modo caos) | Razón, explicación o pretexto que puede justificar una ausencia, retraso o acción, según el enunciado exacto de la ronda. | Palabra relacionada con salud, familia o transporte que no exprese por sí misma una razón pertinente. | La categoría requiere evaluar la frase/acepción en contexto; no basta con que el término figure en una lista de palabras asociadas. |

## Aplicación a candidatos regionales ya investigados

Esta tabla solo ilustra el mapeo semántico propuesto. **Ninguna voz queda aprobada** por aparecer aquí.

| Forma | Acepción concreta que se revisaría | Categoría posible | No debe aceptarse como… |
|---|---|---|---|
| `guache` | Coatí (acepción colombiana documentada) | `animal` | `animal` cuando significa persona maleducada. |
| `paisa` | Natural de Antioquia | Ninguna categoría actual de forma automática; es gentilicio/persona. | `nombre` propio. |
| `zaraza` | Tela de algodón estampada | Ninguna con la definición conservadora actual de `objeto`; revisar si el producto amplía el alcance a materiales. | Objeto tangible por inferencia. |
| `profesionista` | Persona que ejerce una profesión | Ninguna categoría actual de forma automática. | `nombre` propio ni `objeto`. |
| `cochinera` | Corral o instalación para criar cerdos | `lugar` | `animal`. |
| `natilla` | Preparación/dulce comestible, según acepción regional | Ninguna categoría española actual específica de alimento/fruta; no forzarla en `fruta`. | `fruta`. |
| `jagua` | Fruto comestible, si esa acepción concreta queda acreditada | `fruta` | `fruta` cuando significa el árbol. |
| `vaquería` | Instalación/ordeñadero, si esa acepción concreta queda acreditada | `lugar` | `lugar` cuando significa oficio o baile. |

## Evidencia mínima por decisión

Cada decisión de categoría debe conservar:

- lema y forma presentada por el jugador;
- idioma general y locale(s) de procedencia, sin usar locale como filtro;
- identificador de acepción y definición revisada;
- categoría de juego y justificación explícita del encaje;
- fuente, URL/identificador, edición/versión y fecha de consulta;
- licencia y estado de autorización de uso;
- revisor/estado de revisión y versión de la política.

Una fuente puede probar existencia léxica y no categoría. Una fuente de categoría puede no tener licencia válida para incorporarse al bundle. Ambos controles son independientes.

## Casos de prueba de aceptación que debe cubrir la implementación

- Una voz regional válida de Argentina, México, Colombia, Venezuela, Perú o España se evalúa igual desde cualquier ubicación del jugador.
- La misma voz puede ser válida en una categoría y no válida en otra según su acepción.
- Una forma polisémica no hereda elegibilidad de una acepción distinta de la que se está usando.
- Un gentilicio o sustantivo de persona no se convierte en nombre propio por estar en la categoría `nombre`.
- Una instalación o espacio funcional puede ser `lugar`; un oficio o baile con el mismo lema no lo es.
- Un fruto no implica que el nombre del árbol sea una `fruta`.
- Materiales/tejidos no entran en `objeto` mientras la definición siga siendo conservadora.
- Una marca necesita evidencia de marca; una palabra común coincidente no basta.
- Una respuesta inventada en una categoría abierta queda `unknown` o `invalid`, nunca válida por tener tres caracteres.
- El modo online y offline producen el mismo resultado con la misma versión de política y evidencia.

## Decisiones de producto pendientes antes de activar la política

1. Confirmar si `objeto` debe seguir excluyendo materiales/tejidos o ampliarse a «objeto o material».
2. Confirmar si `nombre` admite solo nombres de pila o también apellidos, hipocorísticos y nombres personales históricos.
3. Confirmar el alcance de `lugar`: instalaciones, edificios, establecimientos y espacios naturales.
4. Definir qué evidencia independiente se aceptará para nombres propios y marcas.
5. Añadir, si se desea, una categoría general `alimento`; no reutilizar `fruta` para cualquier comida.

Hasta que se resuelvan estas decisiones y se añadan fixtures de prueba, esta política es documentación de diseño. No cambia validación, puntuación, diccionario, caché ni producción.
