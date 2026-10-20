// Servicio para cachear el clima y que sea instantáneo
let weatherCache = null;

export const setWeatherCache = (data) => {
  weatherCache = {
    ...data,
    timestamp: Date.now()
  };
};

export const getWeatherCache = () => {
  // Si el cache tiene más de 30 minutos, lo consideramos viejo
  if (!weatherCache) return null;
  const diff = Date.now() - weatherCache.timestamp;
  if (diff > 30 * 60 * 1000) return null;

  return weatherCache;
};
