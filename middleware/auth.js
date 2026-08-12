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
    
    // Custom RBAC checks
    const path = req.originalUrl || req.url;
    const method = req.method;
    const role = (req.userRole || '').toLowerCase();

    // 1. Admin2 - no access to Property Management
    if (role === 'admin2') {
      const isPropertyRoute = 
        path.startsWith('/api/properties') ||
        path.startsWith('/api/tenants') ||
        path.startsWith('/api/payments') ||
        path.startsWith('/api/documents') ||
        path.startsWith('/api/dashboard/stats') ||
        (path.startsWith('/api/reports') && !path.startsWith('/api/reports/office'));

      if (isPropertyRoute) {
        console.log(`RBAC Blocked Admin2 from Property route: ${path}`);
        return res.status(403).json({ msg: 'Access denied: Admin2 has no access to Property Management.' });
      }
    }

    // 2. Manager - data entry only
    if (role === 'manager') {
      // No edit/delete
      if (method === 'PUT' || method === 'DELETE') {
        console.log(`RBAC Blocked Manager from write operation: ${method} ${path}`);
        return res.status(403).json({ msg: 'Access denied: Manager role is restricted to data entry only (no edits or deletions).' });
      }

      // No user management
      if (path.startsWith('/api/users')) {
        console.log(`RBAC Blocked Manager from User Management: ${path}`);
        return res.status(403).json({ msg: 'Access denied: Manager role cannot manage users or roles.' });
      }

      // No settings modification
      if (path.startsWith('/api/settings')) {
        console.log(`RBAC Blocked Manager from settings: ${path}`);
        return res.status(403).json({ msg: 'Access denied: Manager role cannot modify settings.' });
      }

      // No approvals or financial transfers
      const isApprovalOrFinancialAction =
        path.includes('/approve') ||
        path.includes('/reject') ||
        path.startsWith('/api/finance/transfer') ||
        path.startsWith('/api/finance/loan-action');

      if (isApprovalOrFinancialAction) {
        console.log(`RBAC Blocked Manager from approval/transfer: ${path}`);
        return res.status(403).json({ msg: 'Access denied: Manager role cannot change approvals or perform financial transfers.' });
      }
    }

    next();
  } catch (err) {
    console.log('Auth failed: Invalid token -', err.message);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

module.exports.requireRole = function (...allowedRoles) {
  return (req, res, next) => {
    if (!req.userRole) {
      console.log(`Auth failed: No role attached to request`);
      return res.status(403).json({ msg: 'Access denied: insufficient permissions' });
    }

    const userRoleLower = req.userRole.toLowerCase();
    const allowedRolesLower = allowedRoles.map(r => r.toLowerCase());

    let isAllowed = allowedRolesLower.includes(userRoleLower);

    // If allowedRoles includes 'admin', treat Admin/Admin2 as admin-level
    if (allowedRolesLower.includes('admin')) {
      if (userRoleLower === 'admin' || userRoleLower === 'admin2') {
        isAllowed = true;
      }
    }

    // If allowedRoles includes 'manager', treat Manager as manager
    if (allowedRolesLower.includes('manager')) {
      if (userRoleLower === 'manager') {
        isAllowed = true;
      }
    }

    if (!isAllowed) {
      console.log(`Auth failed: Role '${req.userRole}' not allowed (requires: ${allowedRoles.join(', ')})`);
      return res.status(403).json({ msg: 'Access denied: insufficient permissions' });
    }
    next();
  };
};
