const mongoose = require("mongoose");
const { Schema } = mongoose;

const QRCodeSchema = new Schema({
  code: { type: String, required: true, unique: true, index: true },
  batchId: { type: Schema.Types.ObjectId, ref: "Batch", index: true },
  state: { type: String, index: true },
  district: { type: String, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  metadata: { type: Schema.Types.Mixed }
});

// Export the model correctly so methods like countDocuments exist
module.exports = mongoose.model("QRCode", QRCodeSchema);

