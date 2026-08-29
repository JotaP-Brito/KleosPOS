const createHttpError = require('http-errors');

const admin = (req, res, next) => {
  if (req.user && req.user.role === "Admin") {
    next();
  } else {
    next(createHttpError(403, 'Admin access required'));
  }
};

module.exports = admin;