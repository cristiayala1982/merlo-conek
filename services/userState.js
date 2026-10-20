/**
 * USER STATE - Persistencia en memoria del perfil del usuario actual.
 * Evita el parpadeo de carga al navegar entre pantallas.
 */
let currentUserProfile = null;

export const setGlobalUserProfile = (profile) => {
  currentUserProfile = profile;
};

export const getGlobalUserProfile = () => {
  return currentUserProfile;
};
