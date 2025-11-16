require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

const { 
  simularDeteccionArboles, 
  calcularAzimutDistancia,
  generarDAP,
  generarAltura,
  generarSalud
} = require('./services/sentinelHubService.js');



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

// GET conglomerado CON departamento y municipio
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
    
    // ✅ Si no tiene departamento/municipio, traer de BRIGADAS
    if (!data.departamento || !data.municipio) {
      try {
        const brigadaResponse = await fetch(
          `https://brigada-informe-ifn.vercel.app/api/conglomerados/${id}`
        );
        if (brigadaResponse.ok) {
          const brigadaData = await brigadaResponse.json();
          
          // Actualizar en BD local
          await supabase
            .from('conglomerados')
            .update({
              departamento: brigadaData.data?.departamento,
              municipio: brigadaData.data?.municipio
            })
            .eq('id', id);
          
          data.departamento = brigadaData.data?.departamento;
          data.municipio = brigadaData.data?.municipio;
        }
      } catch (err) {
        console.log('No se pudo traer de BRIGADAS');
      }
    }
    
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

// POST detectar árboles satelital
app.post('/api/levantamiento/detectar-arboles-satelital', async (req, res) => {
  try {
    const { conglomerado_id, subparcela_id } = req.body;
    
    if (!conglomerado_id || !subparcela_id) {
      return res.status(400).json({ error: 'Parámetros faltantes: conglomerado_id, subparcela_id' });
    }
    
    const { data: conglomerado, error: dbError } = await supabase
      .from('conglomerados')
      .select('*')
      .eq('id', conglomerado_id)
      .single();
    
    if (dbError || !conglomerado) {
      return res.status(404).json({ error: 'Conglomerado no encontrado' });
    }
    
    let latitud = parseFloat(conglomerado.latitud);
    let longitud = parseFloat(conglomerado.longitud);
    
    const arbolesDetectados = simularDeteccionArboles(latitud, longitud, 20);
    
    // ✅ ENRIQUECER CON DATOS CALCULADOS
    const arbolesEnriquecidos = arbolesDetectados.map((arbol, idx) => {
      const dap = generarDAP(arbol.categoria);
      const altura = generarAltura(dap);  // ✅ LLAMAR FUNCIÓN GLOBAL
      const condicion = generarSalud();
      
      const { distancia, azimut } = calcularAzimutDistancia(
        latitud, 
        longitud, 
        arbol.latitud, 
        arbol.longitud
      );
      
      // ✅ VALIDAR Y MAPEAR CATEGORÍA
      let categoria = arbol.categoria;
      const dapNum = parseFloat(dap);
      if (dapNum < 2.5) categoria = 'B';
      else if (dapNum < 10) categoria = 'L';
      else if (dapNum < 50) categoria = 'F';
      else categoria = 'FG';
      
      return {
        subparcela_id: subparcela_id,
        conglomerado_id: conglomerado_id,
        numero_arbol: idx + 1,
        especie: 'Detectado satelital',
        dap: parseFloat(dap.toFixed(2)),
        altura: parseFloat(altura.toFixed(2)),
        categoria: categoria,
        azimut: parseFloat(azimut.toFixed(2)),
        distancia: parseFloat(distancia.toFixed(2)),
        confianza: parseFloat(arbol.confianza.toFixed(3)),
        condicion: condicion,
        observaciones: `Auto-detectado NDVI=${arbol.ndvi.toFixed(2)},Conf=${(arbol.confianza*100).toFixed(0)}%`,
        usuario_id: null,
        brigada_id: null,
        fecha_deteccion: new Date().toISOString()
      };
    });
    
    const { data, error } = await supabase
      .from('detecciones_arboles')
      .insert(arbolesEnriquecidos)
      .select();
    
    if (error) {
      console.error('❌ Error inserción Supabase:', error);
      throw error;
    }
    
    res.json({
      success: true,
      total_detectados: data?.length || 0,
      arboles: data || [],
      conglomerado_codigo: conglomerado.codigo,
      estadisticas: {
        dap_promedio: (data.reduce((a, b) => a + (b.dap || 0), 0) / data.length).toFixed(2),
        altura_promedio: (data.reduce((a, b) => a + (b.altura || 0), 0) / data.length).toFixed(2),
        vivos: data.filter(a => a.condicion === 'vivo').length,
        enfermos: data.filter(a => a.condicion === 'enfermo').length,
        muertos: data.filter(a => a.condicion === 'muerto').length
      }
    });
    
  } catch (err) {
    console.error('❌ Error detección:', err);
    res.status(500).json({ error: err.message || 'Error detectando árboles' });
  }
});

// ========== POST REGISTRAR ÁRBOL MANUALMENTE ==========
app.post('/api/levantamiento/registrar-arbol', async (req, res) => {
  try {
    const { 
      subparcela_id, 
      conglomerado_id, 
      numero_arbol, 
      especie, 
      dap, 
      altura, 
      condicion, 
      observaciones 
    } = req.body;

    // Validaciones
    if (!conglomerado_id || !subparcela_id || !numero_arbol || !especie || !dap) {
      return res.status(400).json({ 
        error: 'Faltan parámetros requeridos: conglomerado_id, subparcela_id, numero_arbol, especie, dap' 
      });
    }

    // ✅ Calcular categoría según DAP (Manual IFN)
    let categoria;
    const dapNum = parseFloat(dap);
    if (dapNum < 2.5) {
      categoria = 'B';  // Brinzal
    } else if (dapNum >= 2.5 && dapNum < 10) {
      categoria = 'L';  // Latizal
    } else if (dapNum >= 10 && dapNum < 50) {
      categoria = 'F';  // Fustal
    } else {
      categoria = 'FG'; // Fustal Grande
    }

    // Insertar en BD
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
        categoria: categoria,  // ✅ AHORA VÁLIDO
        observaciones: observaciones || '',
        confianza: 1.0,
        fecha_deteccion: new Date().toISOString(),
        usuario_id: null,
        brigada_id: null
      }])
      .select();

    if (error) throw error;

    res.status(201).json({ 
      success: true, 
      data: data[0],
      mensaje: 'Árbol registrado exitosamente'
    });
  } catch (err) {
    console.error('Error registrando árbol:', err);
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

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Error interno' });
});
// ✅ ESCUCHAR EN PUERTO
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Backend corriendo en puerto ${PORT}`);
});

module.exports = app;
