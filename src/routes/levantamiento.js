const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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
    res.status(500).json({ error: err.message });
  }
});

router.post('/detecciones-arboles', async (req, res) => {
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
        timestamp: new Date().toISOString()
      }])
      .select();

    if (error) return res.status(400).json({ error });
    res.status(201).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/detecciones/:subparcela_id', async (req, res) => {
  try {
    const { subparcela_id } = req.params;
    const { data, error } = await supabase
      .from('detecciones_arboles')
      .select('*')
      .eq('subparcela_id', subparcela_id)
      .order('numero_arbol', { ascending: true });

    if (error) return res.status(400).json({ error });
    res.json({ success: true, total: data?.length || 0, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    res.json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    res.status(500).json({ error: err.message });
  }
});

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

    res.json({ success: true, resumen: { total_arboles: totalArboles, arboles_vivos: arbolesVivos, arboles_muertos: arbolesMuertos, completitud: totalArboles > 0 ? Math.round((arbolesVivos / totalArboles) * 100) : 0 } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
