# Migración de Firebase Storage a Cloudflare R2

## Problema y Contexto

Actualmente, **merlo-conek** almacena imágenes, videos y audios en **Firebase Storage**. Aunque es conveniente, Firebase Storage cobra tarifas elevadas por almacenamiento y especialmente por transferencia de salida (egress bandwidth), lo cual encarece los costos a medida que la app crece (especialmente por el consumo de videos).

**Cloudflare R2** ofrece almacenamiento S3 compatible con **cero tarifas de transferencia de salida (egress fees)** y costos por GB significativamente menores, lo que representa un ahorro económico sustancial.

## User Review Required

> [!IMPORTANT]
> **Requisito de Infraestructura**: Cloudflare R2 requiere un punto de entrada para generar URLs prefirmadas (*Presigned URLs*) o un Worker/Cloud Function que actúe como intermediario para autorizar y firmar las peticiones de subida y borrado. R2 no tiene un SDK cliente directo sin autenticación AWS SigV4 en el cliente.
>
> Opciones para la arquitectura de subida:
> 1. **Cloudflare Worker (Recomendado)**: Un endpoint serverless en Cloudflare que recibe la petición del usuario autenticado de Firebase Auth, genera una URL presignada de R2 y la devuelve. La app luego sube el archivo directamente a R2.
> 2. **Firebase Cloud Functions**: Una función en Node.js que genera la URL presignada usando `@aws-sdk/client-s3`.

## Open Questions

1. ¿Prefieres implementar la generación de URLs prefirmadas mediante un **Cloudflare Worker** o mediante **Firebase Cloud Functions** (ya que ya usas Firebase para Auth/Firestore)?
2. ¿Deseas migrar también los archivos existentes en Firebase Storage o mantenerlos accesibles con una estrategia de lectura dual (leer antiguos de Firebase y nuevos de R2)?

## Proposed Changes

### 1. Backend / Generador de Presigned URLs (Cloudflare Worker o Firebase Cloud Function)
- Crear el servicio de generación de URLs prefirmadas para subida (`PUT`) y borrado (`DELETE`).

### 2. Capa de Servicios en la App React Native (`services/firebase/storageService.js` o nuevo `r2Service.js`)
- Reemplazar la lógica de `firebase/storage` por llamadas `fetch` utilizando las URLs prefirmadas de R2 o un endpoint de subida.
- Actualizar `subirArchivoConRuta` y la lógica de eliminación de archivos (`deleteObject`) en `EditarPost.js`, `storyService.js`, etc.

### 3. Configuración del Cliente y Variables de Entorno
- Configurar la URL pública del bucket de R2 (Custom Domain o `r2.dev`) en la app.

## Verification Plan

### Automated Tests
- Pruebas de integración de subida de imágenes y videos de prueba.

### Manual Verification
- Subir una historia con video y verificar que se guarde correctamente en Cloudflare R2 y se reproduzca en la app.
- Crear un post/clasificado con imagen y comprobar la subida y visualización.
- Eliminar un post/historia y verificar que el archivo se borre del bucket de R2.
