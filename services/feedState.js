// Singleton para persistencia global
let homeScrollOffset = 0;
let cachedPosts = [];
let unsubscribePosts = null;
const postListeners = new Set();

// Estados para otras secciones
const sectionsState = {
    market: { scrollOffset: 0, cache: [] },
    huellitas: { scrollOffset: 0, cache: [] },
    alertas: { scrollOffset: 0, cache: [] },
    clasificados: { scrollOffset: 0, cache: [] },
    chats: { scrollOffset: 0, cache: [] },
};

export const setHomeScrollOffset = (offset) => { homeScrollOffset = offset; };
export const getHomeScrollOffset = () => homeScrollOffset;

export const setSectionScrollOffset = (section, offset) => {
    if (sectionsState[section]) sectionsState[section].scrollOffset = offset;
};

export const getSectionScrollOffset = (section) => {
    return sectionsState[section]?.scrollOffset || 0;
};

export const setSectionCache = (section, data) => {
    if (sectionsState[section]) {
        // Limitamos la caché a 50 elementos para proteger la memoria RAM
        const dataOptimizada = data.length > 50 ? data.slice(0, 50) : data;
        sectionsState[section].cache = dataOptimizada;

        if (data.length > 50) {
           console.log(`🧹 [Memoria Optimizada] Caché de la sección '${section}' limitada a 50 elementos.`);
        }
    }
};

export const getSectionCache = (section) => {
    return sectionsState[section]?.cache || [];
};

/**
 * Limpia toda la memoria caché y desconecta el listener de Firebase (Para Logout)
 */
export const clearAllCachesAndListeners = () => {
    // 1. Limpiar variables
    homeScrollOffset = 0;
    cachedPosts = [];
    postListeners.clear();

    // 2. Limpiar cachés de cada sección
    Object.keys(sectionsState).forEach(key => {
        sectionsState[key].scrollOffset = 0;
        sectionsState[key].cache = [];
    });

    // 3. Desconectar el "cable" de Firebase
    if (unsubscribePosts) {
        unsubscribePosts();
        unsubscribePosts = null;
    }
};

/**
 * Inicia la escucha global multicanal de posts para que el Muro se actualice en tiempo real.
 */
export const startGlobalPostListener = (escucharFn, onUpdate) => {
  if (typeof onUpdate === 'function') {
    postListeners.add(onUpdate);
    if (cachedPosts.length > 0) {
      onUpdate(cachedPosts);
    }
  }

  if (!unsubscribePosts) {
    unsubscribePosts = escucharFn((items) => {
      // Limitamos la caché interna a 50 posts para proteger la memoria RAM a largo plazo
      if (items.length > 50) {
          cachedPosts = items.slice(0, 50);
          console.log(`🧹 [Memoria Optimizada] Caché global del Muro limitada a 50 posts.`);
      } else {
          cachedPosts = items;
      }

      postListeners.forEach(fn => {
        try { fn(items); } catch(e) {}
      });
    });
  }

  return () => {
    if (typeof onUpdate === 'function') {
      postListeners.delete(onUpdate);
    }
  };
};

export const getCachedPosts = () => cachedPosts;
