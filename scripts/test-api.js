const sql = require('mssql');

const config = {
  server: '180.179.207.163',
  port: 1433,
  database: 'LinksDB20',
  user: 'jolly_a',
  password: 'Mpprod51',
  options: { encrypt: false, trustServerCertificate: true }
};

async function test() {
  try {
    const pool = await sql.connect(config);
    
    console.log('\n🔍 Testing API query (Bangladesh):\n');
    
    const result = await pool.request()
      .input('country0', sql.VarChar, 'Bangladesh')
      .query(`
        SELECT
          w.id, w.wo, w.wodt, w.port, w.country,
          m.status_id, m.assigned_to, m.column_order,
          s.name AS status_name
        FROM bajaj_work_orders w
        LEFT JOIN bajaj_wo_meta m ON m.wo_id = w.id
        LEFT JOIN bajaj_statuses s ON s.id = m.status_id
        WHERE w.country IN (@country0)
        ORDER BY ISNULL(m.column_order, w.id)
      `);
    
    console.log(`Found ${result.recordset.length} rows`);
    console.table(result.recordset.slice(0, 5));
    
    await pool.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}
test();
