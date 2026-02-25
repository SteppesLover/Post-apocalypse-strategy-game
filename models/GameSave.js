const mongoose = require("mongoose");

const GameSaveSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      minlength: 2,
      maxlength: 80,
      trim: true,
    },
    mapId: {
      type: String,
      required: [true, "Map id is required"],
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 16,
    },
    turn: {
      type: Number,
      required: true,
      min: [1, "Turn must be >= 1"],
      max: [100000, "Turn is too large"],
    },
    isFinished: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message: "Too many tags",
      },
    },
    eventDates: {
      type: [Date],
      default: [],
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, "Payload is required"],
    },
  },
  {
    timestamps: true,
  }
);

GameSaveSchema.index({ owner: 1, updatedAt: -1 });
GameSaveSchema.index({ owner: 1, title: 1 });

module.exports = mongoose.model("GameSave", GameSaveSchema);

