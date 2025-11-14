const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && pathname.includes('/conglomerado/')) {
      const conglomeradoId = pathname.split('/').pop();
      const { data, error } = await supabase
        .from('conglomerados')
        .select('*')
        .eq('id', conglomeradoId)
        .single();
      if (error) return res.status(400).json({ error: 'Error al obtener conglomerado' });
      if (!data) return res.status(404).json({ error: 'Conglomerado no encontrado' });
      return res.status(200).json({ success: true, data });
    }

    if (req.method === 'GET' && pathname.includes('/resumen/')) {
      const conglomeradoId = pathname.split('/').pop();
      const { data: detecciones, error } = await supabase
        .from('detecciones_arboles')
        .select('*')
        .eq('conglomerado_id', conglomeradoId);
      if (error) return res.status(400).json({ error });
      const totalArboles = detecciones?.length || 0;
      const arbolesVivos = detecciones?.filter(d => d.condicion === 'vivo').length || 0;
      const arbolesMuertos = detecciones?.filter(d => d.condicion === 'muerto').length || 0;
      return res.status(200).json({
        success: true,
        resumen: {
          total_arboles: totalArboles,
          arboles_vivos: arbolesVivos,
          arboles_muertos: arbolesMuertos,
          completitud: totalArboles > 0 ? Math.round((arbolesVivos / totalArboles) * 100) : 0
        },
        data: detecciones || []
      });
    }

    if (req.method === 'POST' && pathname.includes('/detecciones-arboles')) {
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
      return res.status(201).json({ success: true, data: data[0] });
    }

    if (req.method === 'GET' && pathname.includes('/detecciones/')) {
      const subparcelaId = pathname.split('/').pop();
      const { data, error } = await supabase
        .from('detecciones_arboles')
        .select('*')
        .eq('subparcela_id', subparcelaId)
        .order('numero_arbol', { ascending: true });
      if (error) return res.status(400).json({ error });
      return res.status(200).json({ success: true, total: data?.length || 0, data: data || [] });
    }

    if (req.method === 'PUT' && pathname.includes('/detecciones-arboles/')) {
      const arbolId = pathname.split('/').pop();
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
        .eq('id', arbolId)
        .select();
      if (error) return res.status(400).json({ error });
      return res.status(200).json({ success: true, data: data[0] });
    }

    if (req.method === 'DELETE' && pathname.includes('/detecciones-arboles/')) {
      const arbolId = pathname.split('/').pop();
      const { error } = await supabase
        .from('detecciones_arboles')
        .delete()
        .eq('id', arbolId);
      if (error) return res.status(400).json({ error });
      return res.status(200).json({ success: true, message: 'Eliminado' });
    }

    return res.status(404).json({ error: 'Endpoint no encontrado' });
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message });
  }
};
