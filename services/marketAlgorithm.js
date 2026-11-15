/**
 * ALGORITMO DE ROTACIÓN DEMOCRÁTICA - MARKET MERLO
 * - Mezcla los productos Premium al azar cada vez que se procesa el muro.
 * - Inyecta un Dorado (Nivel 2) cada 6 comunes.
 * - Inyecta un Naranja (Nivel 1) cada 10 comunes.
 */

/**
 * Obtiene el nivel premium real en este preciso momento,
 * considerando la cola de planes (Naranja -> Dorado).
 */
export const obtenerNivelEfectivo = (p) => {
    const ahora = Date.now();
    const v1 = p.vencimientoPremium?.seconds ? p.vencimientoPremium.seconds * 1000 : (p.vencimientoPremium ? new Date(p.vencimientoPremium).getTime() : 0);

    // Si todavía tiene vigente el plan primario
    if (ahora < v1) {
        return { nivel: p.nivelPremium || 0, vence: v1, esPremium: !!p.esPremium };
    }

    // Si el primario venció, pero hay uno en cola (Upgrade)
    const v2 = p.vencimientoPremiumSiguiente?.seconds ? p.vencimientoPremiumSiguiente.seconds * 1000 : (p.vencimientoPremiumSiguiente ? new Date(p.vencimientoPremiumSiguiente).getTime() : 0);
    if (p.nivelPremiumSiguiente && ahora < v2) {
        return { nivel: p.nivelPremiumSiguiente, vence: v2, esPremium: true };
    }

    // Todo vencido
    return { nivel: 0, vence: 0, esPremium: false };
};

const seededRandom = (seed) => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

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

export const procesarMuroMarket = (productos, seed = 12345) => {
    // 0. Normalizar productos según su plan vigente hoy
    const prodsNormalizados = productos.map(p => {
        const info = obtenerNivelEfectivo(p);
        return {
            ...p,
            nivelPremium: info.nivel,
            esPremium: info.esPremium,
            vencimientoVigente: info.vence
        };
    });

    // 1. Clasificar con mezcla estable por semilla
    const gold = shuffleSeeded(prodsNormalizados.filter(p => p.esPremium && p.nivelPremium === 2), seed);
    const orange = shuffleSeeded(prodsNormalizados.filter(p => p.esPremium && p.nivelPremium === 1), seed + 1);
    const standard = prodsNormalizados.filter(p => !p.esPremium);

    // 2. Ordenar estándar por fecha
    const porFecha = (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    standard.sort(porFecha);

    const finalData = [];
    let standardIndex = 0;

    // Track which premium items have been used to avoid duplicates if possible,
    // but the original logic used modulo which is fine for "rotating".
    // However, we need to make sure they all appear if there are no standard items.

    // 3. Si no hay productos estándar, mostrar todos los premium directamente
    if (standard.length === 0) {
        gold.forEach(item => {
            finalData.push({ type: 'ultra', item, key: `gold-empty-${item.id}` });
        });

        let orangeRow = [];
        orange.forEach(item => {
            orangeRow.push(item);
            if (orangeRow.length === 2) {
                finalData.push({ type: 'row', items: [...orangeRow], key: `row-orange-empty-${item.id}` });
                orangeRow = [];
            }
        });
        if (orangeRow.length > 0) {
            finalData.push({ type: 'row', items: [...orangeRow], key: `row-orange-final-empty` });
        }
        return finalData;
    }

    // 4. Construir muro con inyecciones inteligentes
    // Siempre empezamos con una tarjeta Ultra Gold si hay
    if (gold.length > 0) {
        finalData.push({ type: 'ultra', item: gold[0], key: `gold-top-${gold[0].id}` });
    }

    let tempRow = [];
    let orangeQueue = [...orange];
    let goldIndex = 1; // Ya usamos el index 0 para la tarjeta Ultra top

    // Mezclar 1 Naranja apenas empiece la grilla (antes del loop standard)
    if (orangeQueue.length > 0) {
        tempRow.push(orangeQueue.shift());
    }

    let stdCount = 0;
    standard.forEach((prod) => {
        // Inyectar Gold Ultra restante cada 6 elementos estándar
        if (stdCount > 0 && stdCount % 6 === 0 && goldIndex < gold.length) {
            if (tempRow.length > 0) {
                finalData.push({ type: 'row', items: [...tempRow], key: `row-pre-gold-${stdCount}` });
                tempRow = [];
            }
            finalData.push({ type: 'ultra', item: gold[goldIndex], key: `gold-inject-${stdCount}-${gold[goldIndex].id}` });
            goldIndex++;
        }

        // Inyectar 1 Orange intercalado cada 4 elementos estándar
        if (stdCount > 0 && stdCount % 4 === 0 && orangeQueue.length > 0) {
            const itemOrange = orangeQueue.shift();
            tempRow.push(itemOrange);
            if (tempRow.length === 2) {
                finalData.push({ type: 'row', items: [...tempRow], key: `row-orange-inject-${stdCount}` });
                tempRow = [];
            }
        }

        tempRow.push(prod);
        stdCount++;

        if (tempRow.length === 2) {
            finalData.push({ type: 'row', items: [...tempRow], key: `row-std-${stdCount}` });
            tempRow = [];
        }
    });

    if (tempRow.length > 0) {
        finalData.push({ type: 'row', items: [...tempRow], key: `row-final-temp` });
        tempRow = [];
    }

    // Si aún quedan Orange sin mostrar por falta de items estándar suficientes, agregarlos al final
    if (orangeQueue.length > 0) {
        for (let i = 0; i < orangeQueue.length; i += 2) {
            const par = orangeQueue.slice(i, i + 2);
            finalData.push({ type: 'row', items: par, key: `row-orange-leftover-${i}` });
        }
    }

    return finalData;

    return finalData;
};
