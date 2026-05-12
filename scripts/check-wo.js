const sql = require('mssql');

const config = {
  server: '180.179.207.163',
  port: 1433,
  database: 'LinksDB20',
  user: 'jolly_a',
  password: 'Mpprod51',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  }
};

async function checkDB() {
  try {
    const pool = await sql.connect(config);
    
    console.log('\n📊 WORK ORDERS IN DATABASE:\n');
    
    // Count WOs
    const countResult = await pool.request().query('SELECT COUNT(*) as total FROM TMP_TBL_BAJAJ_WO');
    console.log(`✅ Total WOs in TMP_TBL_BAJAJ_WO: ${countResult.recordset[0].total}`);
    
    // Count WO metadata
    const metaResult = await pool.request().query('SELECT COUNT(*) as total FROM bajaj_wo_meta');
    console.log(`✅ Total rows in bajaj_wo_meta: ${metaResult.recordset[0].total}`);
    
    // Sample WOs
    console.log('\n📋 Sample WOs (from TMP_TBL_BAJAJ_WO):');
    const sampleResult = await pool.request().query(`
      SELECT TOP 5 PKID, WO, Country, Plant, Brand, Variant, QTY FROM TMP_TBL_BAJAJ_WO
      ORDER BY PKID DESC
    `);
    console.table(sampleResult.recordset);
    
    // Check statuses
    console.log('\n📊 WO Status Distribution:');
    const statusResult = await pool.request().query(`
      SELECT 
        CASE WHEN m.status_id IS NULL THEN 'No Status (Planning)' ELSE s.name END as status,
        COUNT(*) as count
      FROM TMP_TBL_BAJAJ_WO w
      LEFT JOIN bajaj_wo_meta m ON w.PKID = m.PKID
      LEFT JOIN bajaj_statuses s ON m.status_id = s.id
      GROUP BY m.status_id, s.name
      ORDER BY count DESC
    `);
    console.table(statusResult.recordset);
    
    await pool.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkDB();
