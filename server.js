require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// CORS
app.use(cors());
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
        timestamp: new Date().toISOString()
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

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Error interno' });
});

app.listen(PORT, () => {
  console.log(`🌲 Backend corriendo en puerto ${PORT}`);
});

module.exports = app;