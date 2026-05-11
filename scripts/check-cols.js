const sql = require('mssql');

const config = {
  server: '180.179.207.163',
  port: 1433,
  database: 'LinksDB20',
  user: 'jolly_a',
  password: 'Mpprod51',
  options: { encrypt: false, trustServerCertificate: true }
};

async function check() {
  try {
    const pool = await sql.connect(config);
    
    const result = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'bajaj_work_orders'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('📋 All columns in bajaj_work_orders:\n');
    result.recordset.forEach((r, i) => {
      console.log(`${String(i+1).padStart(2)}) ${r.COLUMN_NAME}`);
    });
    
    await pool.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

check();
