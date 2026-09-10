# Canvas de diseño

Un directorio por canvas. **No los pongas en la raíz del repo:** cada canvas trae su propio
`Main.dc.html` y su propio `canvas.json`, así que dos en el mismo lugar se pisan — pasó el
2026-09-09, armando el de la marca sobre el de la consola.

| Canvas | Qué contiene |
|---|---|
| [`consola/`](consola/) | El rediseño del sitio: home, ficha y sistema visual |
| [`marca/`](marca/) | La marca «Marco», su familia y las direcciones descartadas |

Los `.dc.html` y el `canvas.json` son las fuentes; el `.html` suelto de cada carpeta es el canvas
armado, y se regenera desde las fuentes, nunca se edita a mano.
