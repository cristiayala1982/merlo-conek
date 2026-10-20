import { useRef, useEffect } from 'react';
import { setSectionScrollOffset, getSectionScrollOffset } from '../services/feedState';

/**
 * Hook para persistir el scroll de una FlatList de forma automática.
 * @param {string} sectionName - Nombre único de la sección (ej: 'home', 'market')
 * @param {boolean} isLoading - Estado de carga de la lista
 * @param {object} flatListRef - Referencia a la FlatList
 */
export const useScrollPersistence = (sectionName, isLoading, flatListRef) => {
  const isRestoringScroll = useRef(false);

  // Guardar scroll
  const handleScrollPersistence = (event) => {
    if (isRestoringScroll.current) return;
    const offset = event.nativeEvent.contentOffset.y;
    if (offset >= 0) {
      setSectionScrollOffset(sectionName, offset);
    }
  };

  // Restaurar scroll
  useEffect(() => {
    const offset = getSectionScrollOffset(sectionName);
    if (offset > 0 && !isLoading && flatListRef.current) {
      isRestoringScroll.current = true;
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset, animated: false });
        setTimeout(() => { isRestoringScroll.current = false; }, 100);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isLoading, sectionName]);

  return { handleScrollPersistence };
};
