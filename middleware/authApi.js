const authApi = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  return next();
};

module.exports = authApi;

