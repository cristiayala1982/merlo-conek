/**
 * ARCHIVO PUENTE (REFACCIÓN)
 * Este archivo ahora solo re-exporta las funciones desde sus nuevos módulos
 * dentro de services/firebase/. Esto mantiene la compatibilidad con el resto de la app
 * mientras el código se organiza internamente.
 */

export * from './firebase/storageService';
export * from './firebase/postService';
export * from './firebase/userService';
export * from './firebase/chatService';
export * from './firebase/storyService';
export * from './firebase/marketService';
export * from './firebase/notificationService';
export * from './firebase/reportService';
