const jwt = require("jsonwebtoken");
const User = require("../models/User");

const attachUserFromJwt = async (req, res, next) => {
  if (req.user) return next();
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return next();
  const token = raw.slice("Bearer ".length).trim();
  if (!token) return next();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload?.userId) return next();
    const user = await User.findById(payload.userId).select("_id email name");
    if (!user) return next();
    req.user = user;
    return next();
  } catch {
    return next();
  }
};

module.exports = attachUserFromJwt;

