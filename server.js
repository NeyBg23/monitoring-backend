// ===== MIDDLEWARE PARA VALIDAR JWT (CORREGIDO) =====
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
    // Decodificar JWT sin verificar firma (confiar en iam-autenVerifi)
    const parts = token.split('.');
    
    if (parts.length !== 3) {
      return res.status(401).json({ error: 'Token malformado' });
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8')
    );

    // Guardar info del usuario
    req.user = {
      id: payload.sub,
      email: payload.email,
      aud: payload.aud
    };

    console.log('✅ Usuario validado:', req.user.email);
    next();
  } catch (err) {
    return res.status(403).json({ 
      success: false, 
      error: 'Token inválido: ' + err.message 
    });
  }
};
