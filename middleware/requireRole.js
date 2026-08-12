module.exports = function (...roles) {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(403).json({ msg: 'Access denied: insufficient permissions' });
    }
    const userRoleLower = req.userRole.toLowerCase();
    const allowedRolesLower = roles.map(r => r.toLowerCase());

    let isAllowed = allowedRolesLower.includes(userRoleLower);

    // Support Admin/Admin2 fallback
    if (allowedRolesLower.includes('admin')) {
      if (userRoleLower === 'admin' || userRoleLower === 'admin2') {
        isAllowed = true;
      }
    }

    // Support Manager fallback
    if (allowedRolesLower.includes('manager')) {
      if (userRoleLower === 'manager') {
        isAllowed = true;
      }
    }

    if (!isAllowed) {
      return res.status(403).json({ msg: 'Access denied: insufficient permissions' });
    }
    next();
  };
};
