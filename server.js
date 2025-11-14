const express = require('express');
const cors = require('cors');
const levantamientoRoutes = require('./routes/levantamiento');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Levantamiento Backend - OK', status: 'running' });
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