require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'tu-secret-aqui';

// Middleware
app.use(cors());
app.use(express.json());

// Configurar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Configurar multer para recibir imágenes
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// ===== MIDDLEWARE PARA VALIDAR JWT =====
const validateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      success: false, 
      error: 'Token requerido. Usa: Authorization: Bearer <token>' 
    });
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Formato inválido. Usa: Authorization: Bearer <token>' 
    });
  }

  try {
    // Verifica el JWT con Supabase directamente
    const { data, error } = supabase.auth.getUser(token);
    
    if (error || !data.user) {
      return res.status(403).json({ 
        success: false, 
        error: 'Token inválido o expirado' 
      });
    }

    // Almacena el usuario en el request para usarlo después
    req.user = data.user;
    next();
  } catch (err) {
    return res.status(403).json({ 
      success: false, 
      error: 'Error al validar token: ' + err.message 
    });
  }
};

// ===== RUTAS =====

// 1. Health Check (sin autenticación)
app.get('/health', (req, res) => {
  res.json({ status: 'Backend Monitoring OK', timestamp: new Date() });
});

// 2. Crear un nuevo conglomerado (CON autenticación)
app.post('/api/conglomerados', validateJWT, async (req, res) => {
  try {
    const { codigo, latitud, longitud, brigada_id } = req.body;

    const { data, error } = await supabase
      .from('conglomerados')
      .insert([
        {
          codigo,
          latitud,
          longitud,
          brigada_id,
          fecha_establecimiento: new Date().toISOString().split('T')[0]
        }
      ])
      .select();

    if (error) throw error;

    res.json({ 
      success: true, 
      message: 'Conglomerado creado', 
      data 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 3. Obtener conglomerados (CON autenticación)
app.get('/api/conglomerados', validateJWT, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conglomerados')
      .select('*');

    if (error) throw error;

    res.json({ 
      success: true, 
      count: data.length,
      data 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 4. Obtener subparcelas de un conglomerado (CON autenticación)
app.get('/api/conglomerados/:id/subparcelas', validateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('subparcelas')
      .select('*')
      .eq('conglomerado_id', id);

    if (error) throw error;

    res.json({ 
      success: true, 
      count: data.length,
      data 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 5. Guardar detecciones de árboles (CON autenticación)
app.post('/api/detecciones', validateJWT, async (req, res) => {
  try {
    const { 
      subparcela_id, 
      categoria, 
      azimut, 
      distancia, 
      confianza,
      bbox_x,
      bbox_y,
      bbox_width,
      bbox_height
    } = req.body;

    const { data, error } = await supabase
      .from('detecciones_arboles')
      .insert([
        {
          subparcela_id,
          categoria,
          azimut,
          distancia,
          confianza,
          bbox_x,
          bbox_y,
          bbox_width,
          bbox_height,
          usuario_id: req.user.id // Guarda quién hizo la detección
        }
      ])
      .select();

    if (error) throw error;

    res.json({ 
      success: true, 
      message: 'Detección guardada', 
      data 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 6. Obtener detecciones de una subparcela (CON autenticación)
app.get('/api/subparcelas/:id/detecciones', validateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('detecciones_arboles')
      .select('*')
      .eq('subparcela_id', id);

    if (error) throw error;

    const resumen = {
      total: data.length,
      por_categoria: {
        B: data.filter(d => d.categoria === 'B').length,
        L: data.filter(d => d.categoria === 'L').length,
        F: data.filter(d => d.categoria === 'F').length,
        FG: data.filter(d => d.categoria === 'FG').length
      }
    };

    res.json({ 
      success: true, 
      resumen,
      detecciones: data 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Backend Monitoring corriendo en puerto ${PORT}`);
  console.log(`📊 Health Check: http://localhost:${PORT}/health`);
});
