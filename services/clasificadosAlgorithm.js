/**
 * ALGORITMO DE ROTACIÓN DEMOCRÁTICA - CLASIFICADOS CONEK
 *
 * - Mezcla los anuncios Impulsados con Semilla (Seeded Shuffle) para estabilidad.
 * - Mantiene el orden 100% inmóvil mientras el usuario navega.
 * - Sólo rota a una nueva posición al recargar la pantalla (Pull-to-Refresh).
 * - Siempre muestra una fila inicial de 2 Impulsados.
 * - Inyecta una fila de 2 Impulsados cada 6 anuncios comunes.
 */

// Generador de números seudoaleatorios determinista con semilla (Mulberry32)
const seededRandom = (seed) => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const procesarMuroClasificadosV2 = (oficios, seed = 12345) => {
    const ahora = Date.now();

    // 1. Normalizar y validar vigencia de Impulso
    const normalizados = oficios.map(o => {
        const vence = o.vencimientoPremium?.toMillis ? o.vencimientoPremium.toMillis() : (o.vencimientoPremium || 0);
        const esVigente = o.esPremium && ahora < vence;
        return { ...o, esPremiumReal: esVigente };
    });

    // 2. Clasificar en Premium (Impulsados) y Standard
    const premium = normalizados.filter(o => o.esPremiumReal);
    const standard = normalizados.filter(o => !o.esPremiumReal);

    // 3. Mezclar Premium de forma estable usando la semilla proporcionada
    const shuffleSeeded = (array, seedVal) => {
        const newArr = [...array];
        let currentSeed = seedVal || 12345;
        for (let i = newArr.length - 1; i > 0; i--) {
            currentSeed = Math.floor(seededRandom(currentSeed) * 100000000);
            const j = Math.floor(seededRandom(currentSeed) * (i + 1));
            [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        }
        return newArr;
    };
    const premiumMezclados = shuffleSeeded(premium, seed);

    // 4. Ordenar Standard por fecha (más nuevo primero)
    const porFecha = (a, b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
    standard.sort(porFecha);

    // 5. Construir Muro Final
    const finalData = [];
    let premiumIndex = 0;

    const getNextPremium = () => {
        if (premiumMezclados.length === 0) return null;
        const item = premiumMezclados[premiumIndex % premiumMezclados.length];
        premiumIndex++;
        return item;
    };

    // Caso A: No hay anuncios estándar, mostrar solo los Premium
    if (standard.length === 0) return premiumMezclados;

    // Caso B: Hay anuncios estándar, empezamos la inyección

    // FILA 1: Siempre empezamos con 2 Premium si existen
    if (premiumMezclados.length > 0) {
        finalData.push(getNextPremium());
        if (premiumMezclados.length > 1) finalData.push(getNextPremium());
        else if (standard.length > 0) finalData.push(standard[0]); // Si solo hay 1 premium, rellenamos con 1 standard
    }

    // El resto de los estándar con inyecciones cada 6
    let stdOffset = (premiumMezclados.length > 0) ? (premiumMezclados.length > 1 ? 0 : 1) : 0;

    standard.slice(stdOffset).forEach((item, index) => {
        finalData.push(item);

        // Cada 6 anuncios estándar, inyectamos 2 Premium
        const globalIndex = index + 1;
        if (globalIndex > 0 && globalIndex % 6 === 0 && premiumMezclados.length > 0) {
            finalData.push(getNextPremium());
            finalData.push(getNextPremium());
        }
    });

    return finalData;
};
