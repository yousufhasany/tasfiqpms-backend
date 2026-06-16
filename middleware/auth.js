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
    req.userRole = decoded.role; // Attach user role to request
    console.log('Auth success - userId:', req.userId, 'role:', req.userRole);
    next();
  } catch (err) {
    console.log('Auth failed: Invalid token -', err.message);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

module.exports.requireRole = function (...allowedRoles) {
  return (req, res, next) => {
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      console.log(`Auth failed: Role '${req.userRole}' not allowed (requires: ${allowedRoles.join(', ')})`);
      return res.status(403).json({ msg: 'Access denied: insufficient permissions' });
    }
    next();
  };
};
