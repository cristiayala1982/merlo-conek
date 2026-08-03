export const tiempoRelativo = (createdAt) => {
  if (!createdAt) return 'Publicado ahora';

  const fecha = createdAt?.toDate ? createdAt.toDate() : (createdAt instanceof Date ? createdAt : new Date(createdAt));
  if (isNaN(fecha.getTime())) return 'Publicado ahora';

  const segundos = Math.max(1, Math.floor((Date.now() - fecha.getTime()) / 1000));
  if (segundos < 60) return `Hace ${segundos}s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `Hace ${minutos}m`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas}h`;
  const dias = Math.floor(horas / 24);

  if (dias >= 30) {
    const meses = Math.floor(dias / 30);
    return `Hace ${meses} mes${meses > 1 ? 'es' : ''}`;
  }

  return `Hace ${dias}d`;
};
