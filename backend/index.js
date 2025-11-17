const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const { testConnection } = require("./config/database");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    console.log("🔄 Connecting to MySQL Database...");
    await testConnection();

    // Register routes
    const analyticsRouter = require("./routes/analytics");
    app.use("/api/analytics", analyticsRouter);

    app.get("/", (req, res) => {
      res.json({
        status: "ok",
        message: "QR Analytics API Server - MySQL Edition",
        database: "MySQL",
        endpoints: {
          stats: "/api/analytics/stats",
          timeseries: "/api/analytics/timeseries",
          byLocation: "/api/analytics/by-location",
          recentBatches: "/api/analytics/recent-batches",
          states: "/api/analytics/states",
          districts: "/api/analytics/districts",
          brands: "/api/analytics/brands"
        }
      });
    });

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 API available at http://localhost:${PORT}/api/analytics`);
    });
  } catch (err) {
    console.error("❌ Error starting server:", err);
    process.exit(1);
  }
}

start();


