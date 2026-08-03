/**
 * ALGORITMO DE PUBLICIDAD - MARKET MERLO
 * Este servicio se encarga de intercalar productos pagos entre los comunes
 * siguiendo las reglas:
 * - Un Dorado (Nivel 2) cada 5 productos comunes.
 * - Un Naranja (Nivel 1) cada 10 productos comunes.
 */

export const procesarMuroMarket = (productos) => {
    // 1. Separamos los productos por jerarquía
    const gold = productos.filter(p => p.esPremium && p.nivelPremium === 2);
    const orange = productos.filter(p => p.esPremium && p.nivelPremium === 1);
    const standard = productos.filter(p => !p.esPremium || p.nivelPremium === 0);

    // 2. Ordenamos los estándar por fecha (lo más nuevo arriba)
    standard.sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
    });

    const finalData = [];
    let tempRow = [];
    let standardCounter = 0;
    let goldPointer = 0;
    let orangePointer = 0;

    // 3. Recorremos los productos estándar e inyectamos los pagos
    standard.forEach((prod, index) => {

        // Antes de agregar el común, vemos si toca un Dorado por frecuencia
        if (standardCounter > 0 && standardCounter % 5 === 0 && goldPointer < gold.length) {
            // Cerramos fila de comunes si hay algo pendiente
            if (tempRow.length > 0) {
                finalData.push({ type: 'row', items: [...tempRow] });
                tempRow = [];
            }
            // Insertamos el Dorado (Ocupa todo el ancho)
            finalData.push({ type: 'ultra', item: gold[goldPointer] });
            goldPointer++;
        }

        // Vemos si toca un Naranja cada 10 comunes
        if (standardCounter > 0 && standardCounter % 10 === 0 && orangePointer < orange.length) {
            // El naranja se inserta como un item destacado en la grilla de 2 columnas
            tempRow.push(orange[orangePointer]);
            orangePointer++;

            // Si al meter el naranja se completó la fila de 2, la cerramos
            if (tempRow.length === 2) {
                finalData.push({ type: 'row', items: [...tempRow] });
                tempRow = [];
            }
        }

        // Agregamos el producto común actual
        tempRow.push(prod);
        standardCounter++;

        // Si completamos 2 items en la fila, la cerramos
        if (tempRow.length === 2) {
            finalData.push({ type: 'row', items: [...tempRow] });
            tempRow = [];
        }
    });

    // Cerramos cualquier fila pendiente al final
    if (tempRow.length > 0) {
        finalData.push({ type: 'row', items: [...tempRow] });
    }

    // Si sobraron productos pagos (porque no hubo suficientes comunes), los mandamos al final
    while (goldPointer < gold.length) {
        finalData.push({ type: 'ultra', item: gold[goldPointer] });
        goldPointer++;
    }

    while (orangePointer < orange.length) {
        const remainingOrange = orange.slice(orangePointer, orangePointer + 2);
        finalData.push({ type: 'row', items: remainingOrange });
        orangePointer += 2;
    }

    return finalData;
};
