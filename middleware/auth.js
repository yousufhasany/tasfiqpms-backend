const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const authHeader = req.headers.authorization;
  console.log('Auth middleware - Header:', authHeader ? 'Present' : 'Missing');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Auth failed: No Bearer token');
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
    req.userId = decoded.id;
    console.log('Auth success - userId:', req.userId);
    next();
  } catch (err) {
    console.log('Auth failed: Invalid token -', err.message);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
