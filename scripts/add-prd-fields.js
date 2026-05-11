const sql = require('mssql');

const config = {
  server: '180.179.207.163',
  port: 1433,
  database: 'LinksDB20',
  user: 'jolly_a',
  password: 'Mpprod51',
  options: { encrypt: false, trustServerCertificate: true }
};

async function addFields() {
  try {
    const pool = await sql.connect(config);
    
    console.log('\n🏗️  Adding PRD fields to bajaj_work_orders...\n');
    
    // Try to drop tables
    try {
      await pool.request().query(`DROP TABLE bajaj_wo_meta`);
      console.log('✅ Dropped bajaj_wo_meta');
    } catch (e) { console.log('  (bajaj_wo_meta not found)'); }
    
    try {
      await pool.request().query(`DROP TABLE bajaj_work_orders`);
      console.log('✅ Dropped bajaj_work_orders');
    } catch (e) { console.log('  (bajaj_work_orders not found)'); }
    
    // Create new comprehensive table
    await pool.request().query(`
      CREATE TABLE bajaj_work_orders (
        id INT PRIMARY KEY IDENTITY(1,1),
        wo VARCHAR(50) UNIQUE NOT NULL,
        country VARCHAR(100),
        port VARCHAR(100),
        veh VARCHAR(50),
        qty INT,
        cont VARCHAR(50),
        type VARCHAR(50),
        plant VARCHAR(50),
        s_line VARCHAR(100),
        vessel_name VARCHAR(100),
        agent VARCHAR(100),
        transporter VARCHAR(100),
        po_no VARCHAR(100),
        lc_no VARCHAR(100),
        lc_date VARCHAR(20),
        ff_job VARCHAR(100),
        booking_no VARCHAR(100),
        sbno VARCHAR(100),
        sb_date VARCHAR(20),
        blno VARCHAR(100),
        bldt VARCHAR(20),
        bl_handover_time VARCHAR(20),
        for_hbl VARCHAR(100),
        haz BIT DEFAULT 0,
        vgm_submitted BIT DEFAULT 0,
        si_submitted BIT DEFAULT 0,
        consignee NVARCHAR(255),
        container_no VARCHAR(100),
        pol_gate VARCHAR(20),
        stuffing_on VARCHAR(20),
        do_given_dt VARCHAR(20),
        pick_up_dt VARCHAR(20),
        cntr_dispatch VARCHAR(20),
        gate_open VARCHAR(20),
        gate_cut_off VARCHAR(20),
        si_cut_off VARCHAR(20),
        cntr_report_nhava_sheva VARCHAR(20),
        cntr_gated_in_port VARCHAR(20),
        final_vsl_sob VARCHAR(20),
        do_etd VARCHAR(20),
        current_etd VARCHAR(20),
        eta_at_destination VARCHAR(20),
        sailingdt VARCHAR(20),
        s_line_payment_status VARCHAR(50),
        e_doc_status VARCHAR(50),
        clearance_point VARCHAR(100),
        open_order VARCHAR(100),
        buffer_yard VARCHAR(100),
        courier_dt VARCHAR(20),
        remark NVARCHAR(1000),
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);
    console.log('✅ Created bajaj_work_orders with 50+ PRD fields');
    
    // Recreate metadata table
    await pool.request().query(`
      CREATE TABLE bajaj_wo_meta (
        id INT PRIMARY KEY IDENTITY(1,1),
        wo_id INT NOT NULL UNIQUE,
        status_id VARCHAR(50),
        assigned_to NVARCHAR(255),
        column_order INT DEFAULT 0,
        updated_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (wo_id) REFERENCES bajaj_work_orders(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Recreated bajaj_wo_meta');
    
    // Create indexes
    await pool.request().query(`
      CREATE INDEX idx_bajaj_wo_country ON bajaj_work_orders(country);
      CREATE INDEX idx_bajaj_wo_wo ON bajaj_work_orders(wo);
      CREATE INDEX idx_bajaj_wo_port ON bajaj_work_orders(port);
      CREATE INDEX idx_bajaj_wo_vessel ON bajaj_work_orders(vessel_name);
      CREATE INDEX idx_bajaj_wo_blno ON bajaj_work_orders(blno);
    `);
    console.log('✅ Created 5 search indexes');
    
    const colResult = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'bajaj_work_orders'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log(`\n✨ Complete! ${colResult.recordset.length} fields ready:\n`);
    const cols = colResult.recordset.map(r => r.COLUMN_NAME);
    for (let i = 0; i < cols.length; i += 3) {
      console.log(`  ${cols[i]?.padEnd(25)} | ${cols[i+1]?.padEnd(25)} | ${cols[i+2] || ''}`);
    }
    
    await pool.close();
    console.log('\n✅ Ready to import & edit data!\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

addFields();
