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

async function createSchema() {
  try {
    const pool = await sql.connect(config);
    
    console.log('\n🗑️  Dropping old tables...\n');
    
    // Drop old table if exists
    await pool.request().query(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TMP_TBL_BAJAJ_WO')
      DROP TABLE TMP_TBL_BAJAJ_WO
    `);
    console.log('✅ Dropped TMP_TBL_BAJAJ_WO');
    
    // Drop bajaj_wo_meta if exists (we'll recreate it)
    await pool.request().query(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'bajaj_wo_meta')
      DROP TABLE bajaj_wo_meta
    `);
    console.log('✅ Dropped bajaj_wo_meta');
    
    console.log('\n📋 Creating fresh tables...\n');
    
    // Create main work orders table
    await pool.request().query(`
      CREATE TABLE bajaj_work_orders (
        id INT PRIMARY KEY IDENTITY(1,1),
        wo VARCHAR(50) UNIQUE NOT NULL,
        country VARCHAR(100) NOT NULL,
        port VARCHAR(100),
        plant VARCHAR(50),
        brand VARCHAR(100),
        variant VARCHAR(100),
        qty INT,
        hc40 INT,
        std20 INT,
        wodt VARCHAR(20),
        sailingdt VARCHAR(20),
        bldt VARCHAR(20),
        bookingno VARCHAR(100),
        sbno VARCHAR(100),
        blno VARCHAR(100),
        assy_config VARCHAR(100),
        remark NVARCHAR(500),
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);
    console.log('✅ Created bajaj_work_orders');
    
    // Create metadata table
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
    console.log('✅ Created bajaj_wo_meta');
    
    // Create index on country for faster filtering
    await pool.request().query(`
      CREATE INDEX idx_bajaj_wo_country ON bajaj_work_orders(country)
    `);
    console.log('✅ Created index on country');
    
    // Create index on WO for search
    await pool.request().query(`
      CREATE INDEX idx_bajaj_wo_wo ON bajaj_work_orders(wo)
    `);
    console.log('✅ Created index on WO');
    
    // Verify statuses table exists
    const statusCheck = await pool.request().query(`
      SELECT COUNT(*) as cnt FROM bajaj_statuses
    `);
    console.log(`✅ bajaj_statuses exists with ${statusCheck.recordset[0].cnt} rows`);
    
    console.log('\n✨ Schema created successfully!\n');
    
    await pool.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createSchema();
