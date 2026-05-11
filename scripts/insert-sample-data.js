const sql = require('mssql');

const config = {
  server: '180.179.207.163',
  port: 1433,
  database: 'LinksDB20',
  user: 'jolly_a',
  password: 'Mpprod51',
  options: { encrypt: false, trustServerCertificate: true }
};

const DATA = [
  { wo: '5470053', country: 'Dominican Rep.', plant: 'WA01', brand: 'PLATINA', variant: '125 ES', qty: 384, hc40: 4, wodt: '28-May', port: 'CAUCEDO', booking: '', po: 'DR-APR2026-2', cha: 'BHATIA' },
  { wo: '5470054', country: 'Dominican Rep.', plant: 'WA01', brand: 'PLATINA', variant: '125 ES', qty: 384, hc40: 4, wodt: '28-May', port: 'CAUCEDO', booking: '', po: 'DR-APR2026-2', cha: 'BHATIA' },
  { wo: '5470055', country: 'Dominican Rep.', plant: 'WA01', brand: 'PLATINA', variant: '125 ES', qty: 384, hc40: 4, wodt: '28-May', port: 'CAUCEDO', booking: '', po: 'DR-APR2026-2', cha: 'BHATIA' },
  { wo: '5470487', country: 'Morocco', plant: 'CH01', brand: 'PULSAR', variant: 'N 250', qty: 42, hc40: 1, wodt: '', port: 'CASABLANCA', booking: '', po: 'PI- 10024', cha: 'BHATIA' },
  { wo: '5470546', country: 'Nigeria', plant: 'WA01', brand: 'BOXER', variant: '100 SW KS', qty: 1536, hc40: 8, wodt: '15-May', port: 'APAPA LAGOS', booking: '', po: 'NIG-940-9', cha: 'SHARP' },
  { wo: '5470636', country: 'Liberia', plant: 'WA01', brand: 'BOXER', variant: '125', qty: 576, hc40: 4, wodt: '', port: 'PORT MONROVIA', booking: '', po: '18569/04-26', cha: 'SHARP' },
  { wo: '5584880', country: 'Bangladesh', plant: 'WA01', brand: 'DISCOVER', variant: '125 DI', qty: 0, hc40: 2, wodt: '12-Jun', port: 'CHATTOGRAM', booking: '5233061', po: '5233061', cha: 'LINKS' },
  { wo: '5584881', country: 'Bangladesh', plant: 'WA01', brand: 'DISCOVER', variant: '125 DI', qty: 360, hc40: 2, wodt: '12-Jun', port: 'CHATTOGRAM', booking: '5233061', po: '5233061', cha: 'LINKS' },
  { wo: '5584882', country: 'Bangladesh', plant: 'WA01', brand: 'DISCOVER', variant: '125 DI', qty: 0, hc40: 2, wodt: '12-Jun', port: 'CHATTOGRAM', booking: '5233062', po: '5233062', cha: 'LINKS' },
  { wo: '5584883', country: 'Bangladesh', plant: 'WA01', brand: 'DISCOVER', variant: '125 DI', qty: 360, hc40: 2, wodt: '12-Jun', port: 'CHATTOGRAM', booking: '5233062', po: '5233062', cha: 'LINKS' },
  { wo: '5584884', country: 'Bangladesh', plant: 'WA01', brand: 'DISCOVER', variant: '125 DI', qty: 0, hc40: 2, wodt: '12-Jun', port: 'CHATTOGRAM', booking: '5233063', po: '5233063', cha: 'LINKS' },
  { wo: '5584885', country: 'Bangladesh', plant: 'WA01', brand: 'DISCOVER', variant: '125 DI', qty: 360, hc40: 2, wodt: '12-Jun', port: 'CHATTOGRAM', booking: '5233063', po: '5233063', cha: 'LINKS' },
  { wo: '5584886', country: 'Bangladesh', plant: 'WA01', brand: 'DISCOVER', variant: '125 DI', qty: 0, hc40: 2, wodt: '12-Jun', port: 'CHATTOGRAM', booking: '5233064', po: '5233064', cha: 'LINKS' },
  { wo: '5584887', country: 'Bangladesh', plant: 'WA01', brand: 'DISCOVER', variant: '125 DI', qty: 360, hc40: 2, wodt: '12-Jun', port: 'CHATTOGRAM', booking: '5233064', po: '5233064', cha: 'LINKS' },
  { wo: '5584888', country: 'Bangladesh', plant: 'WA01', brand: 'DISCOVER', variant: '125 DI', qty: 0, hc40: 2, wodt: '12-Jun', port: 'CHATTOGRAM', booking: '5233065', po: '5233065', cha: 'LINKS' },
  { wo: '5584889', country: 'Bangladesh', plant: 'WA01', brand: 'DISCOVER', variant: '125 DI', qty: 360, hc40: 2, wodt: '12-Jun', port: 'CHATTOGRAM', booking: '5233065', po: '5233065', cha: 'LINKS' },
  { wo: '5584890', country: 'Bangladesh', plant: 'WA01', brand: 'DISCOVER', variant: '125 DI', qty: 0, hc40: 2, wodt: '12-Jun', port: 'CHATTOGRAM', booking: '5233066', po: '5233066', cha: 'LINKS' },
  { wo: '5584891', country: 'Bangladesh', plant: 'WA01', brand: 'DISCOVER', variant: '125 DI', qty: 360, hc40: 2, wodt: '12-Jun', port: 'CHATTOGRAM', booking: '5233066', po: '5233066', cha: 'LINKS' },
];

async function insertData() {
  try {
    const pool = await sql.connect(config);
    
    console.log('\n📥 Inserting 18 sample Bajaj dispatch rows...\n');
    
    let added = 0;

    for (const row of DATA) {
      try {
        // Check if already exists
        const exists = await pool.request()
          .input('wo', sql.VarChar, row.wo)
          .query('SELECT COUNT(*) as n FROM bajaj_work_orders WHERE wo=@wo');

        if (exists.recordset[0].n > 0) {
          continue;
        }

        // Insert work order
        const result = await pool.request()
          .input('wo', sql.VarChar, row.wo)
          .input('country', sql.VarChar, row.country)
          .input('port', sql.VarChar, row.port)
          .input('plant', sql.VarChar, row.plant)
          .input('brand', sql.VarChar, row.brand)
          .input('variant', sql.VarChar, row.variant)
          .input('qty', sql.Int, row.qty || null)
          .input('hc40', sql.Int, row.hc40 || null)
          .input('wodt', sql.VarChar, row.wodt || null)
          .input('booking_no', sql.VarChar, row.booking || null)
          .input('po_no', sql.VarChar, row.po || null)
          .input('remark', sql.NVarChar, `CHA: ${row.cha} | Brand: ${row.brand} | Variant: ${row.variant}`)
          .query(`
            INSERT INTO bajaj_work_orders
              (wo, country, port, plant, brand, variant, qty, hc40, wodt, booking_no, po_no, remark)
            OUTPUT inserted.id
            VALUES (@wo, @country, @port, @plant, @brand, @variant, @qty, @hc40, @wodt, @booking_no, @po_no, @remark)
          `);

        const woId = result.recordset[0]?.id;
        if (woId) {
          await pool.request()
            .input('wo_id', sql.Int, woId)
            .query(`INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order) VALUES (@wo_id, NULL, NULL, 0)`);
          added++;
        }
      } catch (e) {
        console.log(`  ⚠️  Row ${row.wo}: ${e.message.substring(0, 50)}`);
      }
    }

    console.log(`\n✅ Successfully inserted: ${added}/18 rows`);

    // Verify
    const verify = await pool.request().query('SELECT COUNT(*) as n FROM bajaj_work_orders');
    console.log(`\n📊 Total Work Orders: ${verify.recordset[0].n}`);

    const bdCount = await pool.request()
      .input('country', sql.VarChar, 'Bangladesh')
      .query('SELECT COUNT(*) as n FROM bajaj_work_orders WHERE country=@country');
    console.log(`🇧🇩 Bangladesh WOs: ${bdCount.recordset[0].n}\n`);

    await pool.close();
  } catch (err) {
    console.error('Fatal Error:', err.message);
  }
}

insertData();
