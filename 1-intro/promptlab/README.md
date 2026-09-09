# PromptLab · De pandas a los LLMs

Laboratorio web interactivo para comparar un flujo clásico de clasificación con pandas/scikit-learn y un flujo basado en prompts con LLMs.

## Contenido

- `index.html`: estructura y contenidos docentes.
- `styles.css`: diseño responsive.
- `app.js`: dataset sintético, simulación, métricas e interacción.
- `assets/upm-logo.png`: logotipo institucional de la UPM sin modificaciones.
- `.openai/hosting.json`: configuración del despliegue estático.

No necesita compilación, paquetes ni claves de API. El modo predeterminado utiliza una simulación reproducible. La opción **Endpoint LLM** permite conectarlo a un proxy institucional seguro; no deben introducirse claves API en el navegador.

## Uso local

Sirve el directorio con cualquier servidor HTTP estático, por ejemplo:

```bash
python3 -m http.server 4173
```

Abre `http://localhost:4173`.

El dataset y las predicciones simuladas son deterministas, no contienen datos personales y funcionan sin claves de API.

## Uso en clase

1. Ejecuta los dos flujos y compara las métricas.
2. Modifica el prompt y repite el experimento.
3. Prueba la salida no estructurada y una temperatura alta.
4. Analiza un error fila a fila.

Pulsa **Mostrar solución** bajo “Tres ideas para llevarse” para ver las respuestas orientativas y el guion de 25 minutos.

## Identidad gráfica

El logotipo de la Universidad Politécnica de Madrid procede de la [página oficial de identidad gráfica de la UPM](https://www.upm.es/UPM/SalaPrensa/IdentidadGrafica/LogosPlantillas/UPM/Logos) y se incluye sin modificar.
