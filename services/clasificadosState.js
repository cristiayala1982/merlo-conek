/**
 * CLASIFICADOS STATE - Almacén temporal para carga instantánea de detalles.
 */
let currentClasificadoPayload = null;

export function setClasificadoPayload(payload) {
  currentClasificadoPayload = payload || null;
}

export function getClasificadoPayload() {
  return currentClasificadoPayload;
}

export function clearClasificadoPayload() {
  currentClasificadoPayload = null;
}
