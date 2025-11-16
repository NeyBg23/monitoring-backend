require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

const { simularDeteccionArboles, calcularAzimutDistancia } = require('./services/sentinelHubService.js');


// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ✅ CORS GLOBAL
app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Levantamiento Backend - OK', status: 'running' });
});

// ========== ENDPOINTS ==========

// GET conglomerado
app.get('/api/levantamiento/conglomerado/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('conglomerados')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return res.status(400).json({ error });
    if (!data) return res.status(404).json({ error: 'No encontrado' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET resumen
app.get('/api/levantamiento/resumen/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('detecciones_arboles')
      .select('*')
      .eq('conglomerado_id', id);
    if (error) return res.status(400).json({ error });
    const total = data?.length || 0;
    const vivos = data?.filter(d => d.condicion === 'vivo').length || 0;
    res.json({ success: true, resumen: { total, vivos }, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST árbol
app.post('/api/levantamiento/detecciones-arboles', async (req, res) => {
  try {
    const { subparcela_id, conglomerado_id, numero_arbol, especie, dap, altura, condicion, observaciones, usuario_id, brigada_id } = req.body;
    if (!subparcela_id || !conglomerado_id || !numero_arbol || !especie || !dap) {
      return res.status(400).json({ error: 'Campos faltantes' });
    }
    const { data, error } = await supabase
      .from('detecciones_arboles')
      .insert([{
        subparcela_id,
        conglomerado_id,
        numero_arbol: parseInt(numero_arbol),
        especie,
        dap: parseFloat(dap),
        altura: altura ? parseFloat(altura) : null,
        condicion: condicion || 'vivo',
        observaciones: observaciones || '',
        usuario_id,
        brigada_id,
      //  timestamp: new Date().toISOString()
      }])
      .select();
    if (error) return res.status(400).json({ error });
    res.status(201).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET detecciones
app.get('/api/levantamiento/detecciones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('detecciones_arboles')
      .select('*')
      .eq('subparcela_id', id)
      .order('numero_arbol', { ascending: true });
    if (error) return res.status(400).json({ error });
    res.json({ success: true, total: data?.length || 0, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT árbol
app.put('/api/levantamiento/detecciones-arboles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { especie, dap, altura, condicion, observaciones } = req.body;
    const updateData = {};
    if (especie) updateData.especie = especie;
    if (dap) updateData.dap = parseFloat(dap);
    if (altura) updateData.altura = parseFloat(altura);
    if (condicion) updateData.condicion = condicion;
    if (observaciones) updateData.observaciones = observaciones;
    const { data, error } = await supabase
      .from('detecciones_arboles')
      .update(updateData)
      .eq('id', id)
      .select();
    if (error) return res.status(400).json({ error });
    res.json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE árbol
app.delete('/api/levantamiento/detecciones-arboles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('detecciones_arboles')
      .delete()
      .eq('id', id);
    if (error) return res.status(400).json({ error });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== ENDPOINTS CONTEO AUTOMÁTICO ==========

// GET resumen de conteo por conglomerado
app.get('/api/levantamiento/resumen-conglomerado/:conglomeradoId', async (req, res) => {
  try {
    const { conglomeradoId } = req.params;
    const { data: arboles, error } = await supabase
      .from('detecciones_arboles')
      .select('*')
      .eq('conglomerado_id', conglomeradoId);
    
    if (error) throw error;
    
    if (!arboles || arboles.length === 0) {
      return res.json({ 
        success: true, 
        resumen: {
          total_arboles: 0,
          arboles_vivos: 0,
          arboles_muertos: 0,
          arboles_enfermos: 0,
          diametro_promedio: 0,
          altura_promedio: 0,
          especies_unicas: 0,
          categorias: { brinzales: 0, latizales: 0, fustales: 0, fustales_grandes: 0 }
        }
      });
    }

    const daps = arboles.map(a => a.dap || 0).filter(d => d > 0);
    const alturas = arboles.map(a => a.altura || 0).filter(h => h > 0);

    const resumen = {
      total_arboles: arboles.length,
      arboles_vivos: arboles.filter(a => a.condicion === 'vivo').length,
      arboles_muertos: arboles.filter(a => a.condicion === 'muerto').length,
      arboles_enfermos: arboles.filter(a => a.condicion === 'enfermo').length,
      diametro_promedio: daps.length > 0 ? (daps.reduce((a, b) => a + b) / daps.length).toFixed(2) : 0,
      altura_promedio: alturas.length > 0 ? (alturas.reduce((a, b) => a + b) / alturas.length).toFixed(2) : 0,
      especies_unicas: [...new Set(arboles.map(a => a.especie).filter(e => e))].length,
      categorias: {
        brinzales: arboles.filter(a => a.dap < 5).length,
        latizales: arboles.filter(a => a.dap >= 5 && a.dap < 10).length,
        fustales: arboles.filter(a => a.dap >= 10 && a.dap < 50).length,
        fustales_grandes: arboles.filter(a => a.dap >= 50).length
      }
    };

    const { error: insertError } = await supabase
      .from('resumen_conteos')
      .insert({
        conglomerado_id: conglomeradoId,
        total_arboles_contados: resumen.total_arboles,
        arboles_vivos: resumen.arboles_vivos,
        arboles_muertos: resumen.arboles_muertos,
        arboles_enfermos: resumen.arboles_enfermos,
        diametro_promedio: parseFloat(resumen.diametro_promedio),
        altura_promedio: parseFloat(resumen.altura_promedio),
        especies_unicas: resumen.especies_unicas
      });

    res.json({ success: true, resumen });
  } catch (err) {
    console.error('Error en resumen conglomerado:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET resumen por subparcela
app.get('/api/levantamiento/resumen-subparcela/:subparcelaId', async (req, res) => {
  try {
    const { subparcelaId } = req.params;
    const { data: arboles, error } = await supabase
      .from('detecciones_arboles')
      .select('*')
      .eq('subparcela_id', subparcelaId)
      .order('numero_arbol', { ascending: true });
    
    if (error) throw error;

    if (!arboles || arboles.length === 0) {
      return res.json({ 
        success: true, 
        resumen: {
          total_arboles: 0,
          arboles_vivos: 0,
          arboles_muertos: 0,
          diametro_promedio: 0,
          especies_unicas: 0,
          categorias: { brinzales: 0, latizales: 0, fustales: 0, fustales_grandes: 0 }
        }
      });
    }

    const daps = arboles.map(a => a.dap || 0).filter(d => d > 0);

    const resumen = {
      total_arboles: arboles.length,
      arboles_vivos: arboles.filter(a => a.condicion === 'vivo').length,
      arboles_muertos: arboles.filter(a => a.condicion === 'muerto').length,
      arboles_enfermos: arboles.filter(a => a.condicion === 'enfermo').length,
      diametro_promedio: daps.length > 0 ? (daps.reduce((a, b) => a + b) / daps.length).toFixed(2) : 0,
      especies_unicas: [...new Set(arboles.map(a => a.especie).filter(e => e))].length,
      categorias: {
        brinzales: arboles.filter(a => a.dap < 5).length,
        latizales: arboles.filter(a => a.dap >= 5 && a.dap < 10).length,
        fustales: arboles.filter(a => a.dap >= 10 && a.dap < 50).length,
        fustales_grandes: arboles.filter(a => a.dap >= 50).length
      }
    };

    res.json({ success: true, resumen, arboles });
  } catch (err) {
    console.error('Error en resumen subparcela:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET validación de datos
app.get('/api/levantamiento/validar/:conglomeradoId', async (req, res) => {
  try {
    const { conglomeradoId } = req.params;
    const { data: arboles, error } = await supabase
      .from('detecciones_arboles')
      .select('*')
      .eq('conglomerado_id', conglomeradoId);
    
    if (error) throw error;

    const errores = {
      sin_especie: arboles.filter(a => !a.especie).length,
      sin_dap: arboles.filter(a => !a.dap || a.dap <= 0).length,
      dap_fuera_rango: arboles.filter(a => a.dap && (a.dap < 0.1 || a.dap > 300)).length,
      sin_condicion: arboles.filter(a => !a.condicion).length,
      altura_inconsistente: arboles.filter(a => a.altura && a.dap && a.altura < a.dap / 100).length
    };

    const total_errores = Object.values(errores).reduce((a, b) => a + b, 0);

    res.json({ 
      success: true, 
      total_arboles: arboles.length,
      total_errores,
      errores,
      porcentaje_validacion: arboles.length > 0 ? (((arboles.length - total_errores) / arboles.length) * 100).toFixed(2) : 100
    });
  } catch (err) {
    console.error('Error en validación:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST guardar resumen manual
app.post('/api/levantamiento/guardar-resumen', async (req, res) => {
  try {
    const { conglomerado_id, subparcela_id, total, vivos, muertos, enfermos, dap_promedio, altura_promedio, especies } = req.body;

    const { data, error } = await supabase
      .from('resumen_conteos')
      .insert({
        conglomerado_id,
        subparcela_id,
        total_arboles_contados: total,
        arboles_vivos: vivos,
        arboles_muertos: muertos,
        arboles_enfermos: enfermos,
        diametro_promedio: parseFloat(dap_promedio),
        altura_promedio: parseFloat(altura_promedio),
        especies_unicas: especies
      })
      .select();

    if (error) throw error;

    res.status(201).json({ success: true, data: data[0] });
  } catch (err) {
    console.error('Error guardando resumen:', err);
    res.status(500).json({ error: err.message });
  }
});


// POST detectar árboles satelital
app.post('/api/levantamiento/detectar-arboles-satelital', async (req, res) => {
  try {
    const { conglomerado_id, subparcela_id } = req.body;

    if (!conglomerado_id || !subparcela_id) {
      return res.status(400).json({ error: 'Parámetros faltantes' });
    }

    const brigadaResponse = await fetch(
      `https://brigada-informe-ifn.vercel.app/api/conglomerados/${conglomerado_id}`
    );

    if (!brigadaResponse.ok) {
      return res.status(404).json({ error: 'Conglomerado no encontrado' });
    }

    const conglomeradeData = await brigadaResponse.json();
    
    // Extraer lat/lon de cualquier estructura
    let latitud, longitud;
    
    if (conglomeradeData.data.coordenadas) {
      ({ latitud, longitud } = conglomeradeData.data.coordenadas);
    } else if (conglomeradeData.data.latitud) {
      latitud = parseFloat(conglomeradeData.data.latitud);
      longitud = parseFloat(conglomeradeData.data.longitud);
    } else {
      return res.status(400).json({ error: 'No hay coordenadas en respuesta' });
    }

    const arbolesDetectados = simularDeteccionArboles(latitud, longitud, 20);

    const arbolesEnriquecidos = arbolesDetectados.map((arbol, idx) => {
      const { distancia, azimut } = calcularAzimutDistancia(
        latitud,
        longitud,
        arbol.latitud,
        arbol.longitud
      );

      return {
        subparcela_id,
        conglomerado_id,
        numero_arbol: idx + 1,
        especie: 'Detectado (satelital)',
        dap: null,
        altura: null,
        categoria: arbol.categoria,
        azimut,
        distancia,
        confianza: arbol.confianza,
        condicion: 'vivo',
        observaciones: `Auto-detectado - NDVI: ${arbol.ndvi.toFixed(2)}`
      };
    });

    const { data, error } = await supabase
      .from('detecciones_arboles')
      .insert(arbolesEnriquecidos)
      .select();

    if (error) throw error;

    res.json({
      success: true,
      total_detectados: arbolesEnriquecidos.length,
      arboles: data,
      mensaje: `✅ ${arbolesEnriquecidos.length} árboles detectados`
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});






// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Error interno' });
});

module.exports = app;
