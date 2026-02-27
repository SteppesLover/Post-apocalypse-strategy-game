const User = require("../models/User");

const registerShow = (req, res) => {
  res.render("register");
};

const registerDo = async (req, res, next) => {
  const { password, password1 } = req.body;
  if (password !== password1) {
    return res.status(400).json({ error: "Passwords do not match" });
  }
  try {
    const user = await User.create(req.body);
    return res.json({ ok: true, user: { email: user.email, id: user._id }, token: user.createJWT() });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: "Email already registered" });
    if (e.name === "ValidationError") return res.status(400).json({ error: e.message });
    return next(e);
  }
};


const logoff = (req, res) => {
  req.logout?.(() => {});
  if (!req.session) return res.json({ ok: true });
  req.session.destroy(function (err) {
    if (err) {
      console.log(err);
      return res.status(500).json({ ok: false, error: "Session destroy failed" });
    }
    res.clearCookie("connect.sid");
    return res.json({ ok: true });
  });
};

const me = (req, res) => {
  if (!req.user) return res.status(401).json({});
  return res.json({ email: req.user.email, id: req.user._id });
};

module.exports = {
  registerShow,
  registerDo,
  logoff,
  me,
};
