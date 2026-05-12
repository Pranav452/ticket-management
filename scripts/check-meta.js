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
    
    console.log('\n📊 Work Orders vs Metadata:');
    const woCount = await pool.request().query('SELECT COUNT(*) as n FROM bajaj_work_orders');
    const metaCount = await pool.request().query('SELECT COUNT(*) as n FROM bajaj_wo_meta');
    console.log(`Work Orders: ${woCount.recordset[0].n}`);
    console.log(`Metadata: ${metaCount.recordset[0].n}`);
    
    console.log('\n🔍 Sample WOs with Bangladesh:');
    const result = await pool.request().query(`
      SELECT TOP 5 w.id, w.wo, w.country, m.id as meta_id, m.status_id
      FROM bajaj_work_orders w
      LEFT JOIN bajaj_wo_meta m ON m.wo_id = w.id
      WHERE w.country = 'Bangladesh'
    `);
    console.table(result.recordset);
    
    await pool.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}
check();
