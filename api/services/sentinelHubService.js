/**
 * Simular detección de árboles (MVP)
 */
function simularDeteccionArboles(latitud, longitud, cantidad = 15) {
  const arboles = [];
  
  for (let i = 0; i < cantidad; i++) {
    const offsetLat = (Math.random() - 0.5) * 0.005;
    const offsetLon = (Math.random() - 0.005) * 0.005;
    
    const ndvi = 0.6 + Math.random() * 0.3;
    
    arboles.push({
      id: `arbol_${i}`,
      latitud: latitud + offsetLat,
      longitud: longitud + offsetLon,
      ndvi: ndvi,
      categoria: detectarCategoria(ndvi),
      confianza: 0.7 + Math.random() * 0.25
    });
  }
  
  return arboles;
}

function detectarCategoria(ndvi) {
  if (ndvi > 0.8) return 'FG';
  if (ndvi > 0.7) return 'F';
  if (ndvi > 0.6) return 'L';
  return 'B';
}

function calcularAzimutDistancia(latOrigen, lonOrigen, latDestino, lonDestino) {
  const R = 6371000;
  const dLat = ((latDestino - latOrigen) * Math.PI) / 180;
  const dLon = ((lonDestino - lonOrigen) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((latOrigen * Math.PI) / 180) *
      Math.cos((latDestino * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distancia = R * c;

  const y = Math.sin(dLon) * Math.cos((latDestino * Math.PI) / 180);
  const x =
    Math.cos((latOrigen * Math.PI) / 180) *
      Math.sin((latDestino * Math.PI) / 180) -
    Math.sin((latOrigen * Math.PI) / 180) *
      Math.cos((latDestino * Math.PI) / 180) *
      Math.cos(dLon);

  const azimut = (Math.atan2(y, x) * 180) / Math.PI + 360;

  return {
    distancia: Math.round(distancia),
    azimut: Math.round(azimut % 360)
  };
}

module.exports = {
  simularDeteccionArboles,
  calcularAzimutDistancia
};
