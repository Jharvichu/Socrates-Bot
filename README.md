# Sócrates Bot

Asistente web interactivo con interfaz de voz y mascota virtual para el aprendizaje guiado de programación en Python.

Proyecto desarrollado para el curso de Interacción Humano-Computador (CC451).



## Descripción general

Sócrates Bot es una propuesta de Aplicación Web Progresiva (PWA) pensada para estudiantes que inician en la programación en Python, facilitando además el acceso a personas con discapacidad motora o visual.

En lugar de dar el código ya hecho, el sistema plantea un método socrático guiado por voz: hace preguntas de orientación para que el alumno descubra la solución por su cuenta, relacionando el avance con el cuidado y evolución de una mascota virtual.



## Estado actual del proyecto

El proyecto se encuentra en la fase inicial de planificación, definición de requerimientos y diseño de interacción (Práctica Calificada 02). No hay código funcional todavía. El trabajo actual abarca el análisis de usuarios (stakeholders), marco PACT, requerimientos funcionales y no funcionales, historias de usuario y los bocetos de alternativas de diseño.



## Características principales planificadas

* Navegación y dictado de código por voz, pensado para usarse completamente sin teclado ni ratón.


* Narración de respuestas y código por voz, compatible con lectores de pantalla.


* Asistencia mediante preguntas guía en lugar de entregar la respuesta directa.


* Conexión a modelos de lenguaje remotos con cambio a un modelo local si falla la red.


* Mascota virtual interactiva que acompaña el progreso y ayuda a reducir la frustración.


* Funcionamiento como PWA con soporte básico sin conexión.


* Salas para trabajo colaborativo entre estudiantes.


* Panel para que los docentes sigan el avance del grupo.





## Arquitectura

El diseño del sistema se apoya en el modelo C4 (diagramas de contexto y contenedores) para mostrar cómo se comunicarán la interfaz web, el backend, el evaluador de código y los modelos de lenguaje.

Los diagramas y la documentación correspondiente se encuentran en la carpeta:

* `docs/`



## Datos simulados

Para cumplir con lo solicitado en la evaluación y permitir la revisión del flujo propuesto sin necesidad del backend terminado, se incluyen archivos de datos simulados (ejemplos de ejercicios, respuestas del asistente y estados de prueba).



## Guía de instalación (A futuro)

El sistema se encuentra en fase de diseño y definición de requisitos, por lo que todavía no cuenta con una versión ejecutable.

Las instrucciones de instalación, dependencias y comandos de ejecución se añadirán en las siguientes etapas del proyecto, una vez que comience la fase de construcción y programación del software.


## Licencia

Este proyecto cuenta con licencia abierta MIT. Para más información, revisar el archivo `LICENSE` en la raíz del repositorio.
