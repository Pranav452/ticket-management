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

async function findTables() {
  try {
    const pool = await sql.connect(config);
    
    console.log('\n🔍 All Tables in LinksDB20:\n');
    
    const result = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    
    result.recordset.forEach(r => console.log(`  • ${r.TABLE_NAME}`));
    
    console.log('\n🔍 Tables containing "BAJAJ" or "WO":\n');
    const filtered = result.recordset.filter(r => 
      r.TABLE_NAME.toUpperCase().includes('BAJAJ') || 
      r.TABLE_NAME.toUpperCase().includes('WO')
    );
    filtered.forEach(r => console.log(`  • ${r.TABLE_NAME}`));
    
    // Check each Bajaj table
    for (const table of filtered) {
      const countResult = await pool.request().query(
        `SELECT COUNT(*) as cnt FROM ${table.TABLE_NAME}`
      );
      console.log(`     └─ ${countResult.recordset[0].cnt} rows`);
    }
    
    await pool.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

findTables();
