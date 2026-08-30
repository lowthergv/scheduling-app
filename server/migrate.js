'use strict';

const fs = require('fs');
const path = require('path');
const db = require('./db');

function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(sql);
  console.log('[db] Schema up to date');
}

module.exports = { migrate };

// Allow running directly: node server/migrate.js
if (require.main === module) {
  migrate();
  process.exit(0);
}
