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

async function checkSchema() {
  try {
    const pool = await sql.connect(config);
    
    console.log('\n🏗️  TABLE SCHEMA:\n');
    
    // Check TMP_TBL_BAJAJ_WO columns
    console.log('📋 TMP_TBL_BAJAJ_WO columns:');
    const schemaResult = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'TMP_TBL_BAJAJ_WO'
      ORDER BY ORDINAL_POSITION
    `);
    console.table(schemaResult.recordset);
    
    // Check bajaj_wo_meta schema
    console.log('\n📋 bajaj_wo_meta columns:');
    const metaSchemaResult = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'bajaj_wo_meta'
      ORDER BY ORDINAL_POSITION
    `);
    console.table(metaSchemaResult.recordset);
    
    // Check bajaj_statuses
    console.log('\n📋 bajaj_statuses columns:');
    const statusSchemaResult = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'bajaj_statuses'
      ORDER BY ORDINAL_POSITION
    `);
    console.table(statusSchemaResult.recordset);
    
    await pool.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkSchema();
