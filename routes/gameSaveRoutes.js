const express = require("express");
const authApi = require("../middleware/authApi");
const {
  listSaves,
  createSave,
  getSave,
  updateSave,
  deleteSave,
} = require("../controllers/gameSaveController");

const router = express.Router();

router.use(authApi);
router.route("/").get(listSaves).post(createSave);
router.route("/:id").get(getSave).patch(updateSave).delete(deleteSave);

module.exports = router;

