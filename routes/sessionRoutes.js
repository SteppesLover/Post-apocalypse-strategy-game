const express = require("express");
const passport = require("passport");
const router = express.Router();

const {
  registerShow,
  registerDo,
  logoff,
  me,
} = require("../controllers/sessionController");

router.route("/register")
  .get(registerShow)
  .post(registerDo);

router.post("/logon", (req, res, next) => {
  passport.authenticate("local", { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || "Auth failed" });
    return res.json({ ok: true, user: { email: user.email, id: user._id }, token: user.createJWT() });
  })(req, res, next);
});


router.post("/logoff", logoff);
router.get("/me", me);

module.exports = router;
