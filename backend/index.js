const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = 3001;

app.use(cors({
    origin: '*',
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
    if (data.start == null || data.end == null) {
        return res.status(400).json({ error: 'Start and end points must be arrays of two numbers [longitude, latitude]' });
    }

    const start = Object.values(data.start); // [longitude, latitude]
    const end = Object.values(data.end); // [longitude, latitude]

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Clear existing points
        await client.query('DELETE FROM public.points');

        // Insert new start and end points
        const insertSQL = 'INSERT INTO public.points (geom) VALUES (ST_SetSRID(ST_MakePoint($2, $1), 4326))';
        await client.query(insertSQL, [start[0], start[1]]);
        await client.query(insertSQL, [end[0], end[1]]);
        console.log('First Insert SQL:', insertSQL, [start[0], start[1]]);
        console.log('Second Insert SQL:', insertSQL, [end[0], end[1]]);
        
        // Refresh materialized view
        try {
            await client.query('REFRESH MATERIALIZED VIEW public.mv_short_path');
        } catch (mvErr) {
            console.error('Error refreshing materialized view:', mvErr);
            await client.query('ROLLBACK');
            return res.status(500).json({ error: 'Failed to refresh materialized view' });
        }

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

// Clear shortest path data endpoint
app.post('/clear-shortest-path', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Clear points table
        await client.query('DELETE FROM public.points');
        // Optionally refresh materialized view
        try {
            await client.query('REFRESH MATERIALIZED VIEW public.mv_short_path');
        } catch (mvErr) {
            console.error('Error refreshing materialized view:', mvErr);
            await client.query('ROLLBACK');
            return res.status(500).json({ error: 'Failed to refresh materialized view' });
        }
        await client.query('COMMIT');
        res.json({ status: 'Success', message: 'Shortest path data cleared' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Transaction error:', err);
        res.status(500).json({ error: 'Failed to clear shortest path data' });
    } finally {
        client.release();
    }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

///         node .\index.js --call Terminal