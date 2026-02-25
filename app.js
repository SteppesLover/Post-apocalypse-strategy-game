const path = require("path");
const express = require("express");
require("dotenv").config();
require("express-async-errors");
const passport = require("passport");
const passportInit = require("./passport/passportInit");

const app = express();
const helmet = require("helmet");
const xssClean = require("xss-clean");
const rateLimit = require("express-rate-limit");

app.use(helmet());
app.use(xssClean());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const cors = require("cors");
const allowedOrigins = String(process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use("/maps", express.static(path.join(__dirname, "public", "maps")));
app.use(express.static(path.join(__dirname, "client", "dist")));

const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const store = new MongoDBStore({ uri: process.env.MONGO_URI, collection: "mySessions" });
store.on("error", console.log);

const sessionParams = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7,
    secure: false,
    sameSite: "lax",
  },
};

if (app.get("env") === "production") {
  app.set("trust proxy", 1);
  sessionParams.cookie.secure = true;
  sessionParams.cookie.sameSite = "none";
}

app.use(session(sessionParams));
app.use(require("connect-flash")());
app.use(passport.initialize());
app.use(passport.session());
passportInit();
app.use(require("./middleware/attachUserFromJwt"));

app.use(require("./middleware/storeLocals"));

app.use("/sessions", require("./routes/sessionRoutes"));
app.use("/api/saves", require("./routes/gameSaveRoutes"));
const auth = require("./middleware/auth");
const secretWordRouter = require("./routes/secretWord");
app.use("/secretWord", auth, secretWordRouter);

app.get("/me", (req, res) => {
  if (!req.user) return res.status(401).json({});
  return res.json({ email: req.user.email, id: req.user._id });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "dist", "index.html"));
});

app.use((req, res) => res.status(404).send(`That page (${req.url}) was not found.`));
app.use((err, req, res, next) => {
  console.log(err);
  if (req.path.startsWith("/api") || req.path.startsWith("/sessions") || req.path === "/me") {
    if (err?.name === "ValidationError") return res.status(400).json({ error: err.message });
    if (err?.name === "CastError") return res.status(400).json({ error: "Invalid id" });
    return res.status(500).json({ error: "Internal server error" });
  }
  return res.status(500).send("Something went wrong");
});

const port = process.env.PORT || 3000;
const start = async () => {
  try {
    await require("./db/connect")(process.env.MONGO_URI);
    app.listen(port, () => console.log(`Server is listening on port ${port}...`));
  } catch (error) {
    console.log(error);
  }
};
start();
