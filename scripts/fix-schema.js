const sql = require('mssql');

const config = {
  server: '180.179.207.163',
  port: 1433,
  database: 'LinksDB20',
  user: 'jolly_a',
  password: 'Mpprod51',
  options: { encrypt: false, trustServerCertificate: true }
};

async function fixSchema() {
  try {
    const pool = await sql.connect(config);
    
    console.log('\n🔧 Adding missing columns...\n');
    
    const columnsToAdd = [
      { name: 'brand', type: 'VARCHAR(100)' },
      { name: 'variant', type: 'VARCHAR(100)' },
      { name: 'hc40', type: 'INT' },
      { name: 'std20', type: 'INT' },
      { name: 'assy_config', type: 'VARCHAR(100)' },
      { name: 'wodt', type: 'VARCHAR(20)' },
    ];

    for (const col of columnsToAdd) {
      try {
        await pool.request().query(`
          ALTER TABLE bajaj_work_orders 
          ADD ${col.name} ${col.type}
        `);
        console.log(`✅ Added: ${col.name}`);
      } catch (e) {
        if (e.message.includes('already exists')) {
          console.log(`⏭️  Already exists: ${col.name}`);
        } else {
          console.log(`❌ Error adding ${col.name}: ${e.message.substring(0, 40)}`);
        }
      }
    }
    
    const verify = await pool.request().query(`
      SELECT COUNT(*) as n FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'bajaj_work_orders'
    `);
    console.log(`\n✨ Total columns now: ${verify.recordset[0].n}\n`);
    
    await pool.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

fixSchema();
