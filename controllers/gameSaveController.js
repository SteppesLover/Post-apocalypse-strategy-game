const GameSave = require("../models/GameSave");

const toOwnerId = (req) => String(req.user?._id || "");

const assertOwner = (doc, req) => doc && String(doc.owner) === toOwnerId(req);

const listSaves = async (req, res) => {
  const owner = toOwnerId(req);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const sort = req.query.sort === "oldest" ? { updatedAt: 1 } : { updatedAt: -1 };
  const q = String(req.query.q || "").trim();

  const filter = { owner };
  if (q) filter.title = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

  const [items, total] = await Promise.all([
    GameSave.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    GameSave.countDocuments(filter),
  ]);

  return res.json({
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
};

const createSave = async (req, res) => {
  const owner = toOwnerId(req);
  const doc = await GameSave.create({
    owner,
    title: req.body.title,
    mapId: req.body.mapId,
    turn: req.body.turn,
    isFinished: Boolean(req.body.isFinished),
    tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    eventDates: Array.isArray(req.body.eventDates) ? req.body.eventDates : [],
    payload: req.body.payload,
  });
  return res.status(201).json({ ok: true, item: doc });
};

const getSave = async (req, res) => {
  const doc = await GameSave.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: "Save not found" });
  if (!assertOwner(doc, req)) return res.status(403).json({ error: "Forbidden" });
  return res.json({ item: doc });
};

const updateSave = async (req, res) => {
  const doc = await GameSave.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: "Save not found" });
  if (!assertOwner(doc, req)) return res.status(403).json({ error: "Forbidden" });

  const editable = ["title", "mapId", "turn", "isFinished", "tags", "eventDates", "payload"];
  editable.forEach((k) => {
    if (req.body[k] !== undefined) doc[k] = req.body[k];
  });
  await doc.save();
  return res.json({ ok: true, item: doc });
};

const deleteSave = async (req, res) => {
  const doc = await GameSave.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: "Save not found" });
  if (!assertOwner(doc, req)) return res.status(403).json({ error: "Forbidden" });
  await doc.deleteOne();
  return res.json({ ok: true });
};

module.exports = {
  listSaves,
  createSave,
  getSave,
  updateSave,
  deleteSave,
};

