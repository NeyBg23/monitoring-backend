// ============================================================
// BACKEND LEVANTAMIENTO - MICROSERVICIO SIMPLE
// ============================================================
// src/routes/levantamiento.js
// 
// Este es un microservicio SIMPLE que:
// - Recibe usuario_id y conglomerado_id desde el frontend
// - NO valida JWT (eso ya lo hace Brigada-Backend)
// - Solo registra datos de captura en la BD

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Conectar a BD Levantamiento
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ============================================================
// GET - Obtener conglomerado
// ============================================================

router.get('/conglomerado/:conglomerado_id', async (req, res) => {
  try {
    const { conglomerado_id } = req.params;

    const { data, error } = await supabase
      .from('conglomerados')
      .select('*')
      .eq('id', conglomerado_id)
      .single();

    if (error) return res.status(400).json({ error: 'Error al obtener conglomerado' });
    if (!data) return res.status(404).json({ error: 'Conglomerado no encontrado' });

    res.json({ success: true, data });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET - Obtener todas las subparcelas de un conglomerado
// ============================================================

router.get('/subparcelas/:conglomerado_id', async (req, res) => {
  try {
    const { conglomerado_id } = req.params;

    const { data, error } = await supabase
      .from('subparcelas')
      .select('*')
      .eq('conglomerado_id', conglomerado_id)
      .order('numero', { ascending: true });

    if (error) return res.status(400).json({ error });
    
    res.json({ 
      success: true, 
      total: data?.length || 0,
      data 
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST - Registrar árbol detectado
// ============================================================

router.post('/detecciones-arboles', async (req, res) => {
  try {
    const { 
      subparcela_id,
      conglomerado_id,
      numero_arbol,
      especie,
      dap,
      altura,
      condicion,
      observaciones,
      usuario_id,
      brigada_id
    } = req.body;

    // Validar campos obligatorios
    if (!subparcela_id || !conglomerado_id || !numero_arbol || !especie || !dap) {
      return res.status(400).json({
        error: 'Campos faltantes',
        requeridos: ['subparcela_id', 'conglomerado_id', 'numero_arbol', 'especie', 'dap']
      });
    }

    console.log(`🌳 Registrando árbol #${numero_arbol} - Especie: ${especie}`);

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
        timestamp: new Date().toISOString()
      }])
      .select();

    if (error) {
      console.error('❌ Error al insertar:', error);
      return res.status(400).json({ error: 'Error al crear detección' });
    }

    console.log(`✅ Árbol creado exitosamente`);

    res.status(201).json({ 
      success: true, 
      message: 'Árbol registrado',
      data: data[0]
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET - Obtener árboles de una subparcela
// ============================================================

router.get('/detecciones/:subparcela_id', async (req, res) => {
  try {
    const { subparcela_id } = req.params;

    const { data, error } = await supabase
      .from('detecciones_arboles')
      .select('*')
      .eq('subparcela_id', subparcela_id)
      .order('numero_arbol', { ascending: true });

    if (error) return res.status(400).json({ error });

    res.json({ 
      success: true, 
      total: data?.length || 0,
      data 
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PUT - Actualizar árbol
// ============================================================

router.put('/detecciones-arboles/:id', async (req, res) => {
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

    res.json({ 
      success: true, 
      message: 'Actualizado',
      data: data[0]
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DELETE - Eliminar árbol
// ============================================================

router.delete('/detecciones-arboles/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('detecciones_arboles')
      .delete()
      .eq('id', id);

    if (error) return res.status(400).json({ error });

    res.json({ success: true, message: 'Eliminado' });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET - Resumen de captura por conglomerado
// ============================================================

router.get('/resumen/:conglomerado_id', async (req, res) => {
  try {
    const { conglomerado_id } = req.params;

    const { data: detecciones, error } = await supabase
      .from('detecciones_arboles')
      .select('*')
      .eq('conglomerado_id', conglomerado_id);

    if (error) return res.status(400).json({ error });

    const totalArboles = detecciones?.length || 0;
    const arbolesVivos = detecciones?.filter(d => d.condicion === 'vivo').length || 0;
    const arbolesMuertos = detecciones?.filter(d => d.condicion === 'muerto').length || 0;

    res.json({
      success: true,
      resumen: {
        total_arboles: totalArboles,
        arboles_vivos: arbolesVivos,
        arboles_muertos: arbolesMuertos,
        completitud: totalArboles > 0 ? Math.round((arbolesVivos / totalArboles) * 100) : 0
      }
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;