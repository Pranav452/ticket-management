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

async function checkCountries() {
  try {
    const pool = await sql.connect(config);
    
    console.log('\n🌍 Unique COUNTRIES in TMP_TBL_BAJAJ_WO:\n');
    
    const result = await pool.request().query(`
      SELECT DISTINCT country, COUNT(*) as count
      FROM TMP_TBL_BAJAJ_WO
      WHERE country IS NOT NULL AND country != ''
      GROUP BY country
      ORDER BY count DESC
    `);
    
    console.table(result.recordset);
    
    // Check Bangladesh specifically
    console.log('\n📊 Bangladesh WOs breakdown:');
    const bdResult = await pool.request().query(`
      SELECT 
        country,
        COUNT(*) as count
      FROM TMP_TBL_BAJAJ_WO
      WHERE country LIKE '%angla%'
      GROUP BY country
    `);
    console.table(bdResult.recordset);
    
    // Check what's in bajaj_wo_meta
    console.log('\n📋 bajaj_wo_meta row count by status:');
    const metaResult = await pool.request().query(`
      SELECT 
        status_id,
        COUNT(*) as count
      FROM bajaj_wo_meta
      GROUP BY status_id
      ORDER BY count DESC
    `);
    console.table(metaResult.recordset);
    
    await pool.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkCountries();
