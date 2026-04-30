'use strict';

require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const { migrate } = require('./migrate');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

migrate();

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

app.get('/health', (req, res) => {
  const db = require('./db');
  const { version } = db.prepare('SELECT sqlite_version() AS version').get();
  res.json({ status: 'ok', sqlite: version });
});

const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`[server] http://localhost:${PORT}`);
});
