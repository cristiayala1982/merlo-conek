/**
 * ALGORITMO DE ROTACIÓN DEMOCRÁTICA - CLASIFICADOS CONEK
 *
 * - Mezcla los anuncios Impulsados al azar para que todos tengan las mismas chances.
 * - Siempre muestra una fila inicial de 2 Impulsados.
 * - Inyecta una fila de 2 Impulsados cada 6 anuncios comunes.
 * - Loop infinito: si hay pocos Premium, vuelve a empezar la lista.
 */

export const procesarMuroClasificadosV2 = (oficios) => {
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

    // 3. Mezclar Premium al azar (Shuffle)
    const shuffle = (array) => {
        const newArr = [...array];
        for (let i = newArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        }
        return newArr;
    };
    const premiumMezclados = shuffle(premium);

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
