require('dotenv').config();
const express = require('express');
const cors = require('cors');
const levantamientoRoutes = require('./routes/levantamiento');

const app = express();
const PORT = process.env.PORT || 3001;

// ========== CORS CONFIGURACIÓN ==========
const corsOptions = {
  origin: [
    'https://react-vercel-deploy-brown.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
// ========================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Levantamiento Backend - OK', 
    status: 'running',
    cors: 'enabled'
  });
});

// Rutas principales
app.use('/api/levantamiento', levantamientoRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`🌲 Levantamiento Backend corriendo en puerto ${PORT}`);
});

module.exports = app;
