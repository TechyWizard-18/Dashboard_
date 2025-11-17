const mongoose = require("mongoose");
const { Schema } = mongoose;

const BatchSchema = new Schema({
  name: { type: String, required: true, unique: true, index: true },
  state: { type: String, index: true },
  district: { type: String, index: true },
  qrCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model("Batch", BatchSchema);

