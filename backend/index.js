const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = 3001;

app.use(cors({
    origin: '*', // or use '*' for all
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

// Middleware
app.use(bodyParser.json());

// PostgreSQL config
const pool = new Pool({
    host: 'localhost',
    port: 5435,
    database: 'postgres',
    user: 'postgres',
    password: 'mysecretpassword'
});

// API Endpoint
app.post('/update-route', async (req, res) => {
    const data = req.body;
    console.log(data);

    // Validate input
    if (!data.start || !data.end) {
        return res.status(400).json({ error: 'Start or end point is missing' });
    }

    const start = data.start; // [longitude, latitude]
    const end = data.end;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Clear existing points
        await client.query('DELETE FROM public.points');

        // Insert new start and end points
        const insertSQL = 'INSERT INTO public.points (geom) VALUES (ST_SetSRID(ST_MakePoint($1, $2), 4326))';
        await client.query(insertSQL, [start[0], start[1]]);
        await client.query(insertSQL, [end[0], end[1]]);

        // Refresh materialized view
        await client.query('REFRESH MATERIALIZED VIEW public.mv_short_path');

        await client.query('COMMIT');

        res.json({ status: 'Success', message: 'Route has been successfully updated' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Transaction error:', err);
        res.status(500).json({ error: 'Failed to update route' });
    } finally {
        client.release();
    }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

///         node .\index.js --call Terminal