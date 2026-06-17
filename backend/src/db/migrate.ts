import { pool } from "./client";

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value JSONB,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS agent_runs (
        id SERIAL PRIMARY KEY,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'running',
        products_found INTEGER DEFAULT 0,
        report_id INTEGER,
        logs TEXT[],
        error TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        date DATE UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        summary TEXT,
        total_products_found INTEGER DEFAULT 0,
        approved_count INTEGER DEFAULT 0,
        rejected_count INTEGER DEFAULT 0,
        agent_run_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS report_products (
        id SERIAL PRIMARY KEY,
        report_id INTEGER NOT NULL,
        asin VARCHAR(20) NOT NULL,
        title VARCHAR(500),
        brand VARCHAR(200),
        category VARCHAR(200),
        image_url TEXT,
        current_price DECIMAL(10,2),
        suggested_buy_price DECIMAL(10,2),
        suggested_sell_price DECIMAL(10,2),
        estimated_profit DECIMAL(10,2),
        estimated_roi DECIMAL(6,2),
        buy_box_price DECIMAL(10,2),
        bsr_rank INTEGER,
        bsr_category VARCHAR(200),
        monthly_sales_est INTEGER,
        competition_level VARCHAR(50),
        source_store VARCHAR(200),
        source_url TEXT,
        source_price DECIMAL(10,2),
        criteria_score INTEGER,
        criteria_details JSONB,
        ai_analysis TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inventory_items (
        id SERIAL PRIMARY KEY,
        asin VARCHAR(20),
        title VARCHAR(500),
        fnsku VARCHAR(50),
        sku VARCHAR(100),
        quantity_in_stock INTEGER DEFAULT 0,
        quantity_at_amazon INTEGER DEFAULT 0,
        quantity_inbound INTEGER DEFAULT 0,
        buy_price DECIMAL(10,2),
        current_sell_price DECIMAL(10,2),
        buy_box_price DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'active',
        date_purchased DATE,
        date_listed DATE,
        last_sale_date DATE,
        total_sold INTEGER DEFAULT 0,
        total_revenue DECIMAL(10,2) DEFAULT 0,
        total_fees DECIMAL(10,2) DEFAULT 0,
        total_profit DECIMAL(10,2) DEFAULT 0,
        alert_flags JSONB,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS supplies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        category VARCHAR(100),
        quantity_on_hand INTEGER DEFAULT 0,
        reorder_point INTEGER DEFAULT 10,
        unit_cost DECIMAL(8,2),
        supplier VARCHAR(200),
        supplier_url TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        type VARCHAR(50) NOT NULL,
        category VARCHAR(100),
        description TEXT,
        amount DECIMAL(10,2) NOT NULL,
        asin VARCHAR(20),
        order_id VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(100),
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Seed default agent settings
    await client.query(`
      INSERT INTO agent_settings (key, value) VALUES
        ('schedule', '"0 4 * * *"'),
        ('enabled', 'true'),
        ('maxProducts', '20'),
        ('minRoi', '30'),
        ('minMonthlySales', '30'),
        ('minScore', '60'),
        ('categories', '["Electronics","Home & Kitchen","Sports & Outdoors","Toys & Games","Health & Beauty","Office Products"]'),
        ('excludeCategories', '["Grocery","Automotive","Industrial"]'),
        ('maxCompetitors', '5'),
        ('maxWeight', '5'),
        ('maxSize', '"standard"'),
        ('reportTemplate', '"detailed"'),
        ('notifyEmail', 'false'),
        ('researchDepth', '"standard"'),
        ('permissionLevel', '"semi-auto"')
      ON CONFLICT (key) DO NOTHING;
    `);

    console.log("[DB] Migrations completed successfully");
  } finally {
    client.release();
  }
}
