/**
 * sentinelHubService.js
 * Simula detección de árboles basada en coordenadas geográficas
 * MVP: Genera árboles realistas sin usar APIs externas
 */

/**
 * Genera árboles detectados para una coordenada específica
 * @param {number} latitud - Latitud del conglomerado
 * @param {number} longitud - Longitud del conglomerado
 * @param {number} cantidad - Cantidad de árboles a simular (default: 20)
 * @returns {Array} Array de árboles con coordenadas y propiedades IFN
 */
function simularDeteccionArboles(latitud, longitud, cantidad = 20) {
  const arboles = [];
  
  // Generar árboles en radio de ~500m alrededor del punto central
  for (let i = 0; i < cantidad; i++) {
    // Desviación máxima: ±0.005 grados ≈ ±500m
    const offsetLat = (Math.random() - 0.5) * 0.005;
    const offsetLon = (Math.random() - 0.5) * 0.005;
    
    // NDVI simulado: más alto = más vegetación (0.6-0.95)
    const ndvi = 0.6 + Math.random() * 0.35;
    
    arboles.push({
      id: `arbol_${i}`,
      latitud: latitud + offsetLat,
      longitud: longitud + offsetLon,
      ndvi: ndvi,
      categoria: detectarCategoria(ndvi),
      confianza: 0.7 + Math.random() * 0.25, // 0.7 - 0.95
      salud: generarSalud()
    });
  }
  
  return arboles;
}

/**
 * Clasifica árbol según NDVI (Normalized Difference Vegetation Index)
 * Basado en Manual IFN Colombia
 */
function detectarCategoria(ndvi) {
  if (ndvi >= 0.80) return 'FG'; // Fustal Grande (DAP > 50cm)
  if (ndvi >= 0.70) return 'F';  // Fustal (DAP 10-50cm)
  if (ndvi >= 0.65) return 'L';  // Latizal (DAP 5-10cm)
  return 'B'; // Brinzal (DAP < 5cm)
}

/**
 * Genera estado de salud realista
 * Mayoría sanos, algunos enfermos
 */
function generarSalud() {
  const rand = Math.random();
  if (rand < 0.80) return 'vivo';
  if (rand < 0.95) return 'enfermo';
  return 'muerto';
}

/**
 * Calcula DAP (Diámetro a Altura del Pecho) simulado
 * Basado en categoría del árbol
 * Rango según Manual IFN:
 * - Brinzal (B): 0-5 cm
 * - Latizal (L): 5-10 cm
 * - Fustal (F): 10-50 cm
 * - Fustal Grande (FG): > 50 cm
 */
function generarDAP(categoria) {
  const mapDAP = {
    'B': () => Math.random() * 5,           // Brinzal: 0-5cm
    'L': () => 5 + Math.random() * 5,       // Latizal: 5-10cm
    'F': () => 10 + Math.random() * 40,     // Fustal: 10-50cm
    'FG': () => 50 + Math.random() * 100    // Fustal Grande: 50-150cm
  };
  
  const generador = mapDAP[categoria] || mapDAP['F'];
  return Math.round(generador() * 10) / 10; // 1 decimal
}

/**
 * Calcula altura simulada (proporcional a DAP)
 * Relación aproximada: altura ≈ 1.5 × DAP + ruido
 */
function generarAltura(dap) {
  const factor = 1.5; // Aproximadamente 1.5x el DAP
  const ruido = Math.random() * 5; // ±5m de variación
  return Math.round((dap * factor + ruido) * 10) / 10;
}

/**
 * Calcula azimut (dirección) y distancia entre dos puntos geográficos
 * Usando Haversine formula
 */
function calcularAzimutDistancia(latOrigen, lonOrigen, latDestino, lonDestino) {
  const R = 6371000; // Radio tierra en metros
  
  // Convertir a radianes
  const dLat = (latDestino - latOrigen) * Math.PI / 180;
  const dLon = (lonDestino - lonOrigen) * Math.PI / 180;
  
  // Haversine: distancia
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(latOrigen * Math.PI / 180) * Math.cos(latDestino * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distancia = R * c;
  
  // Azimut (ángulo desde norte, 0-360°)
  const y = Math.sin(dLon * Math.PI / 180) * Math.cos(latDestino * Math.PI / 180);
  const x = 
    Math.cos(latOrigen * Math.PI / 180) * Math.sin(latDestino * Math.PI / 180) -
    Math.sin(latOrigen * Math.PI / 180) * Math.cos(latDestino * Math.PI / 180) * Math.cos(dLon * Math.PI / 180);
  
  const azimut = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  
  return {
    distancia: Math.round(distancia),
    azimut: Math.round(azimut)
  };
}

// ✅ EXPORTAR TODAS LAS FUNCIONES
module.exports = {
  simularDeteccionArboles,
  calcularAzimutDistancia,
  detectarCategoria,
  generarDAP,
  generarAltura,
  generarSalud
};
