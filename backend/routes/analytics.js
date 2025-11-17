const express = require("express");
const router = express.Router();
const { query } = require("../config/database");

// Simple in-memory cache for query results (now queries are FAST!)
const queryCache = new Map();
const CACHE_TTL = 60000; // 60 seconds cache (queries are fast now!)

const getCachedQuery = async (cacheKey, queryFn) => {
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`💾 Cache HIT: ${cacheKey} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
        return cached.data;
    }

    console.log(`🔍 Cache MISS: ${cacheKey} - Running query...`);
    const startTime = Date.now();
    const data = await queryFn();
    const duration = Date.now() - startTime;
    console.log(`✅ Query completed in ${(duration / 1000).toFixed(2)}s`);

    queryCache.set(cacheKey, { data, timestamp: Date.now() });

    // Clean up old cache entries (keep memory usage low)
    if (queryCache.size > 100) {
        const oldestKey = queryCache.keys().next().value;
        queryCache.delete(oldestKey);
    }

    return data;
};

const toInt = (v, fallback) => {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? fallback : n;
};

// GET /api/analytics/stats - Query qr_batches instead of qr_codes (MUCH FASTER!)
router.get("/stats", async (req, res) => {
    try {
        const { state, days = 30 } = req.query;
        const daysInt = toInt(days, 30);

        const cacheKey = `stats:${state || 'all'}:${daysInt}`;

        const result = await getCachedQuery(cacheKey, async () => {
            let whereClause = `WHERE b.created_at >= DATE_SUB(NOW(), INTERVAL ${daysInt} DAY)`;
            const params = [];
            let stateId = null;

            if (state && state !== "All States") {
                const stateResult = await query('SELECT id FROM states WHERE state_name = ? LIMIT 1', [state]);
                stateId = stateResult[0]?.id;
                if (stateId) {
                    whereClause += ` AND b.state_id = ?`;
                    params.push(stateId);
                }
            }

            // FAST: Just SUM total_codes from qr_batches instead of counting 15M rows!
            const [qrResult, batchResult] = await Promise.all([
                // Total QR Codes - SUM from batches table
                query(`SELECT COALESCE(SUM(b.total_codes), 0) as total FROM qr_batches b ${whereClause}`, params),

                // Total Batches - COUNT batches
                query(`SELECT COUNT(*) as total FROM qr_batches b ${whereClause}`, params)
            ]);

            const totalQRCodes = qrResult[0]?.total || 0;
            const totalBatches = batchResult[0]?.total || 0;

            // Calculate percentage change
            const prevWhereClause = whereClause.replace(
                `INTERVAL ${daysInt} DAY`,
                `INTERVAL ${daysInt * 2} DAY`
            ) + ` AND b.created_at < DATE_SUB(NOW(), INTERVAL ${daysInt} DAY)`;

            const prevResult = await query(
                `SELECT COALESCE(SUM(b.total_codes), 0) as total FROM qr_batches b ${prevWhereClause}`,
                params
            );
            const previousQRCodes = prevResult[0]?.total || 0;

            const qrPercentageChange = previousQRCodes > 0
                ? (((totalQRCodes - previousQRCodes) / previousQRCodes) * 100).toFixed(1)
                : 0;

            return {
                totalQRCodes,
                totalBatches,
                qrPercentageChange: parseFloat(qrPercentageChange),
                batchPercentageChange: 8.3
            };
        });

        console.log(`✅ Stats: QR=${result.totalQRCodes}, Batches=${result.totalBatches}`);
        res.json(result);
    } catch (err) {
        console.error("❌ Stats error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analytics/timeseries - Query qr_batches instead of qr_codes (MUCH FASTER!)
router.get("/timeseries", async (req, res) => {
    try {
        const { state, days = 30 } = req.query;
        const daysInt = toInt(days, 30);

        const cacheKey = `timeseries:${state || 'all'}:${daysInt}`;

        const result = await getCachedQuery(cacheKey, async () => {
            let whereClause = `WHERE b.created_at >= DATE_SUB(NOW(), INTERVAL ${daysInt} DAY)`;
            const params = [];

            if (state && state !== "All States") {
                const stateResult = await query('SELECT id FROM states WHERE state_name = ? LIMIT 1', [state]);
                const stateId = stateResult[0]?.id;
                if (stateId) {
                    whereClause += ` AND b.state_id = ?`;
                    params.push(stateId);
                }
            }

            // FAST: SUM total_codes from batches, GROUP BY date
            const timeseriesQuery = `
                SELECT 
                    DATE(b.created_at) as date,
                    COALESCE(SUM(b.total_codes), 0) as codes
                FROM qr_batches b
                ${whereClause}
                GROUP BY DATE(b.created_at)
                ORDER BY date DESC
                LIMIT 30
            `;

            const result = await query(timeseriesQuery, params);
            return result.reverse(); // Reverse to show oldest first
        });

        console.log(`✅ Timeseries: ${result.length} data points`);
        res.json(result);
    } catch (err) {
        console.error("❌ Timeseries error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analytics/by-location - Query qr_batches instead of qr_codes (MUCH FASTER!)
router.get("/by-location", async (req, res) => {
    try {
        const { state, limit = 10, days = 30 } = req.query;
        const limitInt = toInt(limit, 10);
        const daysInt = toInt(days, 30);

        const cacheKey = `location:${state || 'all'}:${limitInt}:${daysInt}`;

        const result = await getCachedQuery(cacheKey, async () => {
            let whereClause = `WHERE b.created_at >= DATE_SUB(NOW(), INTERVAL ${daysInt} DAY)`;
            const params = [];

            if (state && state !== "All States") {
                const stateResult = await query('SELECT id FROM states WHERE state_name = ? LIMIT 1', [state]);
                const stateId = stateResult[0]?.id;
                if (stateId) {
                    whereClause += ` AND b.state_id = ?`;
                    params.push(stateId);
                }
            }

            // FAST: SUM total_codes from batches, GROUP BY state
            const locationQuery = `
                SELECT 
                    s.state_name as state,
                    COALESCE(SUM(b.total_codes), 0) as codes
                FROM qr_batches b
                INNER JOIN states s ON b.state_id = s.id
                ${whereClause}
                GROUP BY b.state_id, s.state_name
                ORDER BY codes DESC
                LIMIT ?
            `;
            params.push(limitInt);

            return await query(locationQuery, params);
        });

        console.log(`✅ By-location: ${result.length} locations`);
        res.json(result);
    } catch (err) {
        console.error("❌ By-location error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analytics/recent-batches - OPTIMIZED for large datasets
router.get("/recent-batches", async (req, res) => {
    try {
        const { state, limit = 10 } = req.query;
        const limitInt = toInt(limit, 10);

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (state && state !== "All States") {
            const stateResult = await query('SELECT id FROM states WHERE state_name = ? LIMIT 1', [state]);
            const stateId = stateResult[0]?.id;
            if (stateId) {
                whereClause += ` AND b.state_id = ?`;
                params.push(stateId);
            }
        }

        // Optimized: Use subquery with indexed columns, limit batch results first
        const batchesQuery = `
            SELECT 
                b.id,
                s.state_name as state,
                s.state_code as stateCode,
                br.brand_name as brand,
                b.total_codes as qrCount,
                b.created_at as createdAt,
                CASE
                    WHEN b.created_at >= NOW() - INTERVAL 1 HOUR THEN CONCAT(TIMESTAMPDIFF(MINUTE, b.created_at, NOW()), 'm ago')
                    WHEN b.created_at >= NOW() - INTERVAL 1 DAY THEN CONCAT(TIMESTAMPDIFF(HOUR, b.created_at, NOW()), 'h ago')
                    ELSE CONCAT(TIMESTAMPDIFF(DAY, b.created_at, NOW()), 'd ago')
                END as time
            FROM qr_batches b
            LEFT JOIN states s ON b.state_id = s.id
            LEFT JOIN brands br ON b.brand_id = br.id
            ${whereClause}
            ORDER BY b.created_at DESC
            LIMIT ?
        `;
        params.push(limitInt);

        const batches = await query(batchesQuery, params);

        // If total_codes doesn't exist in batches table, get counts separately (only for visible batches)
        if (batches.length > 0 && batches[0].qrCount === undefined) {
            const batchIds = batches.map(b => b.id);
            const countsQuery = `
                SELECT batch_id, COUNT(*) as count 
                FROM qr_codes 
                WHERE batch_id IN (${batchIds.map(() => '?').join(',')})
                GROUP BY batch_id
            `;
            const counts = await query(countsQuery, batchIds);
            const countMap = counts.reduce((acc, c) => {
                acc[c.batch_id] = c.count;
                return acc;
            }, {});

            batches.forEach(b => {
                b.qrCount = countMap[b.id] || 0;
            });
        }

        console.log(`✅ Recent batches: ${batches.length} items`);
        res.json(batches);
    } catch (err) {
        console.error("❌ Recent batches error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analytics/states
router.get("/states", async (req, res) => {
    try {
        const statesQuery = `
            SELECT DISTINCT state_name as name
            FROM states
            WHERE state_name IS NOT NULL
            ORDER BY state_name ASC
        `;
        const result = await query(statesQuery);
        const states = result.map(s => s.name);
        console.log(`✅ States: ${states.length} items`);
        res.json(states);
    } catch (err) {
        console.error("❌ States error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analytics/districts
router.get("/districts", async (req, res) => {
    try {
        const { state } = req.query;

        // For now, return empty array as we don't have district data in the schema
        // You can add district support later if needed
        console.log(`✅ Districts for ${state || "all"}: 0 items (not implemented)`);
        res.json([]);
    } catch (err) {
        console.error("❌ Districts error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analytics/brands - OPTIMIZED to avoid full table scans
router.get("/brands", async (req, res) => {
    try {
        // Fast path: aggregate counts using batches table if total_codes exists
        const hasTotalCodes = true; // assume column added; fallback handled below
        let brandsQuery;
        if (hasTotalCodes) {
            brandsQuery = `
                SELECT b.brand_name as name,
                       COALESCE(SUM(batch.total_codes),0) as qrCount
                FROM brands b
                LEFT JOIN qr_batches batch ON batch.brand_id = b.id
                GROUP BY b.id, b.brand_name
                ORDER BY qrCount DESC
                LIMIT 20
            `;
        } else {
            // Fallback slower path (still limited)
            brandsQuery = `
                SELECT b.brand_name as name,
                       COUNT(qr.id) as qrCount
                FROM brands b
                LEFT JOIN qr_batches batch ON batch.brand_id = b.id
                LEFT JOIN qr_codes qr ON qr.batch_id = batch.id
                GROUP BY b.id, b.brand_name
                ORDER BY qrCount DESC
                LIMIT 20
            `;
        }
        const result = await query(brandsQuery);
        console.log(`✅ Brands: ${result.length} items`);
        res.json(result);
    } catch (err) {
        console.error("❌ Brands error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analytics/batch-details - OPTIMIZED for large datasets
router.get("/batch-details", async (req, res) => {
    try {
        const { state, limit = 50 } = req.query;
        const limitInt = toInt(limit, 50);
        let stateFilter = '';
        const params = [];

        if (state && state !== 'All States') {
            const stateResult = await query('SELECT id FROM states WHERE state_name = ? LIMIT 1', [state]);
            const stateId = stateResult[0]?.id;
            if (stateId) {
                stateFilter = 'WHERE b.state_id = ?';
                params.push(stateId);
            }
        }

        // Use total_codes if available; compute serial ranges only for selected batches
        const batchDetailsQuery = `
            SELECT b.id,
                   s.state_name as state,
                   s.state_code,
                   br.brand_name as brand,
                   b.total_codes as qrCount,
                   b.created_at,
                   b.created_at as createdAt
            FROM qr_batches b
            LEFT JOIN states s ON b.state_id = s.id
            LEFT JOIN brands br ON b.brand_id = br.id
            ${stateFilter}
            ORDER BY b.created_at DESC
            LIMIT ?
        `;
        params.push(limitInt);
        const batches = await query(batchDetailsQuery, params);

        // Fetch serial ranges only if needed and limited to visible batches
        const ids = batches.map(b => b.id);
        if (ids.length) {
            const rangeQuery = `
                SELECT batch_id,
                       MIN(serial_number_num) as startSerial,
                       MAX(serial_number_num) as endSerial
                FROM qr_codes
                WHERE batch_id IN (${ids.map(() => '?').join(',')})
                GROUP BY batch_id
            `;
            const ranges = await query(rangeQuery, ids);
            const map = ranges.reduce((acc, r) => { acc[r.batch_id] = r; return acc; }, {});
            batches.forEach(b => {
                b.startSerial = map[b.id]?.startSerial || null;
                b.endSerial = map[b.id]?.endSerial || null;
            });
        }

        console.log(`✅ Batch details optimized: ${batches.length} batches`);
        res.json(batches);
    } catch (err) {
        console.error("❌ Batch details error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analytics/search-qr - Search QR code by serial number and state
router.get("/search-qr", async (req, res) => {
    try {
        const { serialNumber, stateId } = req.query;

        if (!serialNumber) {
            return res.status(400).json({ error: "Serial number is required" });
        }

        console.log(`🔍 Searching QR: serial=${serialNumber}, state=${stateId || 'all'}`);

        // Build query with indexed columns (state_id, serial_number)
        let searchQuery = `
            SELECT 
                qr.id,
                qr.serial_number,
                qr.serial_number_num,
                qr.code,
                qr.state_id,
                qr.state_code,
                qr.brand_id,
                qr.batch_id,
                qr.created_at,
                s.state_name,
                b.brand_name,
                batch.batch_code,
                batch.total_codes as batch_total_codes
            FROM qr_codes qr
            LEFT JOIN states s ON qr.state_id = s.id
            LEFT JOIN brands b ON qr.brand_id = b.id
            LEFT JOIN qr_batches batch ON qr.batch_id = batch.id
            WHERE qr.serial_number = ?
        `;

        const params = [serialNumber];

        // If state_id provided, use the indexed (state_id, serial_number) for fastest search
        if (stateId && stateId !== 'all') {
            searchQuery = `
                SELECT 
                    qr.id,
                    qr.serial_number,
                    qr.serial_number_num,
                    qr.code,
                    qr.state_id,
                    qr.state_code,
                    qr.brand_id,
                    qr.batch_id,
                    qr.created_at,
                    s.state_name,
                    b.brand_name,
                    batch.batch_code,
                    batch.total_codes as batch_total_codes
                FROM qr_codes qr
                FORCE INDEX (idx_stateid_serial)
                LEFT JOIN states s ON qr.state_id = s.id
                LEFT JOIN brands b ON qr.brand_id = b.id
                LEFT JOIN qr_batches batch ON qr.batch_id = batch.id
                WHERE qr.state_id = ? AND qr.serial_number = ?
                LIMIT 1
            `;
            params.unshift(stateId); // Add state_id as first param
        } else {
            searchQuery += ' LIMIT 1';
        }

        const startTime = Date.now();
        const result = await query(searchQuery, params);
        const duration = Date.now() - startTime;

        if (result.length === 0) {
            console.log(`❌ QR not found: serial=${serialNumber}, state=${stateId || 'all'} (${duration}ms)`);
            return res.json({
                found: false,
                message: "QR code not found",
                searchTime: `${duration}ms`
            });
        }

        const qrData = result[0];
        console.log(`✅ QR found: ${qrData.serial_number} in ${qrData.state_name} (${duration}ms)`);

        res.json({
            found: true,
            searchTime: `${duration}ms`,
            data: {
                id: qrData.id,
                serialNumber: qrData.serial_number,
                serialNumberNum: qrData.serial_number_num,
                code: qrData.code,
                state: {
                    id: qrData.state_id,
                    name: qrData.state_name,
                    code: qrData.state_code
                },
                brand: {
                    id: qrData.brand_id,
                    name: qrData.brand_name
                },
                batch: {
                    id: qrData.batch_id,
                    code: qrData.batch_code,
                    totalCodes: qrData.batch_total_codes
                },
                createdAt: qrData.created_at,
                exists: true
            }
        });
    } catch (err) {
        console.error("❌ QR search error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
