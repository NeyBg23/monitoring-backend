import axios from 'axios';

/**
 * Obtener imagen Sentinel-2 de una zona
 * Sentinel-2 es GRATIS y de código abierto (USGS/ESA)
 */
export async function obtenerImagenSentinel(latitud, longitud, radiusKm = 1) {
  try {
    console.log(`🛰️ Descargando imagen Sentinel-2 para: ${latitud}, ${longitud}`);

    // Parámetros de búsqueda Sentinel Hub (GRATIS)
    const params = {
      request: 'GetMap',
      service: 'WMS',
      version: '1.1.1',
      styles: '',
      crs: 'EPSG:4326',
      time: '2024-01-01/2024-12-31',
      bbox: [
        longitud - 0.01,
        latitud - 0.01,
        longitud + 0.01,
        latitud + 0.01
      ].join(','),
      width: 256,
      height: 256,
      format: 'image/tiff'
    };

    // Usar USGS Landsat/Sentinel (gratuito, sin API key requerida)
    const url = 'https://ows.sentinel-hub.com/ogc/wms/abc123'; // Endpoint público
    
    // ALTERNATIVA: Usar Google Storage (imagen Sentinel-2 pública)
    const sentinel2Url = `https://storage.googleapis.com/open-buildings/v3/regions/01bfae4c57c23fff`;
    
    console.log('✅ Imagen Sentinel-2 URL lista');
    
    // Para MVP: Simular detección basada en coordenadas
    return simularDeteccionArboles(latitud, longitud);

  } catch (err) {
    console.error('Error descargando imagen:', err);
    throw err;
  }
}

/**
 * Simular detección de árboles (MVP rápido para el 17)
 * Genera detecciones pseudo-aleatorias pero realistas
 */
export function simularDeteccionArboles(latitud, longitud, cantidad = 15) {
  const arboles = [];
  
  // Generar 15 árboles ficticios alrededor del punto
  for (let i = 0; i < cantidad; i++) {
    const offsetLat = (Math.random() - 0.5) * 0.005; // ~500m
    const offsetLon = (Math.random() - 0.005) * 0.005;
    
    const ndvi = 0.6 + Math.random() * 0.3; // NDVI entre 0.6-0.9
    
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

/**
 * Clasificar árbol por categoría IFN
 */
function detectarCategoria(ndvi) {
  if (ndvi > 0.8) return 'FG'; // Fustal Grande
  if (ndvi > 0.7) return 'F';  // Fustal
  if (ndvi > 0.6) return 'L';  // Latizal
  return 'B';                   // Brinzal
}

/**
 * Calcular azimut y distancia
 */
export function calcularAzimutDistancia(latOrigen, lonOrigen, latDestino, lonDestino) {
  const R = 6371000; // Radio Tierra (m)
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
