const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Database connection configuration using environment variables (standard for cloud deployments)
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'solarcalc',
    port: process.env.DB_PORT || 3306
};

let dbConnection = null;
let useDb = false;

// Fallback in-memory array in case database is not available
let calculationsInMemory = [];

function connectDatabase() {
    console.log(`[Database] Mencoba menghubungkan ke MySQL di ${dbConfig.host}:${dbConfig.port}...`);
    
    // Create a pool for reliable connections
    const pool = mysql.createPool({
        ...dbConfig,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0
    });
    
    // Test the connection
    pool.getConnection((err, conn) => {
        if (err) {
            console.error(`=================================================`);
            console.error(`  [WARNING] GAGAL MENGHUBUNGKAN KE DATABASE MYSQL!  `);
            console.error(`  Error: ${err.message}                          `);
            console.error(`  Aplikasi akan berjalan dalam MODE FALLBACK      `);
            console.error(`  (Data riwayat disimpan sementara di RAM).       `);
            console.error(`=================================================`);
            useDb = false;
        } else {
            console.log(`=================================================`);
            console.log(`  [SUCCESS] BERHASIL MENGHUBUNGKAN KE MYSQL!      `);
            console.log(`  Database aktif: ${dbConfig.database}             `);
            console.log(`=================================================`);
            conn.release();
            dbConnection = pool;
            useDb = true;
            
            // Create table if it doesn't exist (double safety check)
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS calculations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    monthly_bill DECIMAL(12, 2) NOT NULL,
                    house_capacity INT NOT NULL,
                    sun_hours DECIMAL(4, 2) NOT NULL,
                    offset_percentage INT NOT NULL,
                    solar_capacity DECIMAL(6, 2) NOT NULL,
                    monthly_generation INT NOT NULL,
                    monthly_savings DECIMAL(12, 2) NOT NULL,
                    investment_cost DECIMAL(12, 2) NOT NULL,
                    payback_period DECIMAL(4, 2) NOT NULL,
                    co2_offset DECIMAL(10, 2) NOT NULL,
                    trees_planted INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `;
            
            dbConnection.query(createTableQuery, (tableErr) => {
                if (tableErr) {
                    console.error("[Database] Gagal membuat tabel calculations:", tableErr.message);
                } else {
                    console.log("[Database] Tabel 'calculations' siap digunakan.");
                }
            });
        }
    });
}

// Initial DB connection attempt
connectDatabase();

// ==========================================
// HPA SIMULATION STATE MACHINE
// ==========================================
const hpaState = {
    isLoadSimulated: false,
    currentPods: 2,
    targetPods: 2,
    minPods: 2,
    maxPods: 5,
    
    podsList: [
        { id: 'solarcalc-hpa-backend-p1', status: 'Running', cpu: 12 },
        { id: 'solarcalc-hpa-backend-p2', status: 'Running', cpu: 15 }
    ],
    
    traffic: 110,
    latency: 38,
    baseCpu: 14,
    cycleCount: 0
};

function generateRandomSuffix() {
    return Math.random().toString(36).substring(2, 6);
}

function hpaLoop() {
    hpaState.cycleCount++;
    
    if (hpaState.isLoadSimulated) {
        hpaState.traffic = Math.floor(850 + Math.random() * 200);
        
        const activeRunningPods = hpaState.podsList.filter(p => p.status === 'Running').length;
        if (activeRunningPods > 0) {
            hpaState.baseCpu = Math.min(95, Math.round(180 / activeRunningPods));
        } else {
            hpaState.baseCpu = 95;
        }
        
        const processingDeficit = Math.max(0, 5 - activeRunningPods);
        hpaState.latency = Math.round(45 + (processingDeficit * 45) + (Math.random() * 15));
    } else {
        hpaState.traffic = Math.floor(95 + Math.random() * 40);
        hpaState.baseCpu = Math.floor(10 + Math.random() * 8);
        hpaState.latency = Math.floor(32 + Math.random() * 10);
    }

    hpaState.podsList.forEach(pod => {
        if (pod.status === 'Running') {
            pod.cpu = Math.min(99, Math.max(5, Math.round(hpaState.baseCpu + (Math.random() * 8 - 4))));
        } else if (pod.status === 'Pending') {
            pod.cpu = 0;
        }
    });

    if (hpaState.podsList.length < hpaState.targetPods) {
        const newPodId = `solarcalc-hpa-backend-${generateRandomSuffix()}`;
        hpaState.podsList.push({
            id: newPodId,
            status: 'Pending',
            cpu: 0
        });
        
        setTimeout(() => {
            const spawned = hpaState.podsList.find(p => p.id === newPodId);
            if (spawned) {
                spawned.status = 'Running';
            }
        }, 1200);

    } else if (hpaState.podsList.length > hpaState.targetPods) {
        const activePods = hpaState.podsList.filter(p => p.status !== 'Terminating');
        if (activePods.length > 0) {
            const podToTerminate = activePods[activePods.length - 1];
            podToTerminate.status = 'Terminating';
            podToTerminate.cpu = 0;
            
            const targetId = podToTerminate.id;
            setTimeout(() => {
                hpaState.podsList = hpaState.podsList.filter(p => p.id !== targetId);
            }, 500);
        }
    }
    
    hpaState.currentPods = hpaState.podsList.length;
}

setInterval(hpaLoop, 1500);

// ==========================================
// REST API ENDPOINTS
// ==========================================

// 1. Get status of pods and HPA metrics
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        useDb: useDb,
        dbHost: dbConfig.host,
        ...hpaState,
        activeRunningCount: hpaState.podsList.filter(p => p.status === 'Running').length
    });
});

// 2. Trigger high load or stop high load
app.post('/api/simulate', (req, res) => {
    const { simulate } = req.body;
    
    if (typeof simulate !== 'undefined') {
        hpaState.isLoadSimulated = !!simulate;
        hpaState.targetPods = hpaState.isLoadSimulated ? hpaState.maxPods : hpaState.minPods;
        
        res.json({
            success: true,
            isLoadSimulated: hpaState.isLoadSimulated,
            targetPods: hpaState.targetPods
        });
    } else {
        res.status(400).json({
            success: false,
            message: "Missing 'simulate' parameter in request body."
        });
    }
});

// 3. Save a solar panel calculation run (Full-Stack integration endpoint)
app.post('/api/calculations', (req, res) => {
    const {
        monthly_bill,
        house_capacity,
        sun_hours,
        offset_percentage,
        solar_capacity,
        monthly_generation,
        monthly_savings,
        investment_cost,
        payback_period,
        co2_offset,
        trees_planted
    } = req.body;

    // Validation
    if (!monthly_bill || !house_capacity || !solar_capacity) {
        return res.status(400).json({
            success: false,
            message: "Missing required calculation parameters."
        });
    }

    const newCalc = {
        monthly_bill,
        house_capacity,
        sun_hours,
        offset_percentage,
        solar_capacity,
        monthly_generation,
        monthly_savings,
        investment_cost,
        payback_period,
        co2_offset,
        trees_planted,
        created_at: new Date()
    };

    if (useDb && dbConnection) {
        // Save to MySQL
        const insertQuery = `
            INSERT INTO calculations 
            (monthly_bill, house_capacity, sun_hours, offset_percentage, solar_capacity, monthly_generation, monthly_savings, investment_cost, payback_period, co2_offset, trees_planted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            monthly_bill,
            house_capacity,
            sun_hours,
            offset_percentage,
            solar_capacity,
            monthly_generation,
            monthly_savings,
            investment_cost,
            payback_period,
            co2_offset,
            trees_planted
        ];

        dbConnection.query(insertQuery, values, (err, result) => {
            if (err) {
                console.error("[Database] Gagal memasukkan data perhitungan:", err.message);
                return res.status(500).json({
                    success: false,
                    message: "Database insertion error.",
                    error: err.message
                });
            }
            res.json({
                success: true,
                message: "Perhitungan berhasil disimpan ke database MySQL!",
                data: { id: result.insertId, ...newCalc }
            });
        });
    } else {
        // Fallback to RAM storage
        newCalc.id = calculationsInMemory.length + 1;
        calculationsInMemory.unshift(newCalc);
        
        // Limit in-memory database to last 20 entries
        if (calculationsInMemory.length > 20) {
            calculationsInMemory.pop();
        }

        res.json({
            success: true,
            message: "Perhitungan disimpan di RAM (Mode Fallback, MySQL belum aktif).",
            data: newCalc
        });
    }
});

// 4. Retrieve historical calculations (Full-Stack integration endpoint)
app.get('/api/calculations', (req, res) => {
    if (useDb && dbConnection) {
        // Retrieve from MySQL (limit to last 5 results for clean dashboard table)
        const selectQuery = "SELECT * FROM calculations ORDER BY id DESC LIMIT 5";
        
        dbConnection.query(selectQuery, (err, rows) => {
            if (err) {
                console.error("[Database] Gagal mengambil data riwayat:", err.message);
                return res.status(500).json({
                    success: false,
                    message: "Database query error.",
                    error: err.message
                });
            }
            res.json({
                success: true,
                source: "MySQL Database",
                data: rows
            });
        });
    } else {
        // Retrieve from RAM storage
        res.json({
            success: true,
            source: "In-Memory RAM Fallback",
            data: calculationsInMemory.slice(0, 5)
        });
    }
});

// Start express server
app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`  SolarCalc Full-Stack Backend is running!      `);
    console.log(`  Local Endpoint: http://localhost:${PORT}        `);
    console.log(`  Connecting DB: ${dbConfig.host}:${dbConfig.port} `);
    console.log(`=================================================`);
});
