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

      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        type VARCHAR(50),
        category VARCHAR(200),
        website TEXT,
        region VARCHAR(100),
        coupons_available BOOLEAN DEFAULT FALSE,
        avg_discount VARCHAR(50),
        rating INTEGER,
        tags TEXT[],
        notes TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE report_products ADD COLUMN IF NOT EXISTS supplier_recommendations JSONB;
      ALTER TABLE report_products ADD COLUMN IF NOT EXISTS coupons JSONB;
      ALTER TABLE report_products ADD COLUMN IF NOT EXISTS discount_notes TEXT;
    `);

    // Seed ideal online-arbitrage suppliers (only if table is empty)
    const supplierCount = await client.query(`SELECT COUNT(*)::int AS c FROM suppliers`);
    if (supplierCount.rows[0].c === 0) {
      await client.query(`
        INSERT INTO suppliers (name, type, category, website, region, coupons_available, avg_discount, rating, tags) VALUES
        ('Walmart', 'retail', 'General Merchandise', 'https://www.walmart.com', 'US', true, '10-40%', 5, ARRAY['clearance','rollback','online','in-store']),
        ('Target', 'retail', 'General Merchandise', 'https://www.target.com', 'US', true, '15-50%', 5, ARRAY['clearance','circle','cartwheel','in-store']),
        ('Home Depot', 'retail', 'Home Improvement', 'https://www.homedepot.com', 'US', true, '10-50%', 4, ARRAY['clearance','penny-deals','seasonal']),
        ('Lowe''s', 'retail', 'Home Improvement', 'https://www.lowes.com', 'US', true, '10-50%', 4, ARRAY['clearance','seasonal']),
        ('Best Buy', 'retail', 'Electronics', 'https://www.bestbuy.com', 'US', true, '10-40%', 4, ARRAY['open-box','clearance','deal-of-day']),
        ('Walgreens', 'retail', 'Health & Beauty', 'https://www.walgreens.com', 'US', true, '20-75%', 4, ARRAY['clearance','rewards','coupons']),
        ('CVS', 'retail', 'Health & Beauty', 'https://www.cvs.com', 'US', true, '20-75%', 4, ARRAY['clearance','extracare','coupons']),
        ('Costco', 'wholesale', 'Warehouse Club', 'https://www.costco.com', 'US', true, '10-30%', 5, ARRAY['bulk','members-only','treasure-hunt']),
        ('Sam''s Club', 'wholesale', 'Warehouse Club', 'https://www.samsclub.com', 'US', true, '10-30%', 4, ARRAY['bulk','members-only','instant-savings']),
        ('BJ''s Wholesale', 'wholesale', 'Warehouse Club', 'https://www.bjs.com', 'US', true, '10-30%', 4, ARRAY['bulk','members-only','coupons']),
        ('Kohl''s', 'retail', 'Apparel & Home', 'https://www.kohls.com', 'US', true, '20-70%', 4, ARRAY['kohls-cash','clearance','coupons']),
        ('Big Lots', 'retail', 'Closeout', 'https://www.biglots.com', 'US', true, '20-60%', 3, ARRAY['closeout','clearance']),
        ('Dollar General', 'retail', 'Discount', 'https://www.dollargeneral.com', 'US', true, '10-50%', 3, ARRAY['penny-deals','clearance']),
        ('Staples', 'retail', 'Office Supplies', 'https://www.staples.com', 'US', true, '10-50%', 4, ARRAY['clearance','rewards','coupons']),
        ('Office Depot', 'retail', 'Office Supplies', 'https://www.officedepot.com', 'US', true, '10-50%', 3, ARRAY['clearance','rewards']),
        ('Wayfair', 'online', 'Home & Furniture', 'https://www.wayfair.com', 'US', true, '10-40%', 3, ARRAY['open-box','clearance']),
        ('Chewy', 'online', 'Pet Supplies', 'https://www.chewy.com', 'US', true, '5-30%', 4, ARRAY['autoship','coupons']),
        ('GNC', 'retail', 'Health & Supplements', 'https://www.gnc.com', 'US', true, '20-50%', 3, ARRAY['clearance','rewards']),
        ('Ulta Beauty', 'retail', 'Beauty', 'https://www.ulta.com', 'US', true, '20-50%', 4, ARRAY['clearance','rewards','coupons']),
        ('Sephora', 'retail', 'Beauty', 'https://www.sephora.com', 'US', false, '10-30%', 3, ARRAY['sale','rewards']),
        ('Bath & Body Works', 'retail', 'Beauty & Home', 'https://www.bathandbodyworks.com', 'US', true, '25-75%', 4, ARRAY['semi-annual-sale','coupons']),
        ('Macy''s', 'retail', 'Apparel & Home', 'https://www.macys.com', 'US', true, '20-70%', 3, ARRAY['clearance','coupons']),
        ('Academy Sports', 'retail', 'Sporting Goods', 'https://www.academy.com', 'US', true, '15-50%', 4, ARRAY['clearance','seasonal']),
        ('Dick''s Sporting Goods', 'retail', 'Sporting Goods', 'https://www.dickssportinggoods.com', 'US', true, '15-50%', 3, ARRAY['clearance','scorecard']),
        ('Tractor Supply', 'retail', 'Farm & Ranch', 'https://www.tractorsupply.com', 'US', true, '15-50%', 4, ARRAY['clearance','seasonal']),
        ('Michaels', 'retail', 'Arts & Crafts', 'https://www.michaels.com', 'US', true, '30-70%', 3, ARRAY['clearance','coupons']),
        ('Newegg', 'online', 'Electronics', 'https://www.newegg.com', 'US', true, '5-30%', 4, ARRAY['shell-shocker','combo-deals']),
        ('B&H Photo', 'online', 'Electronics & Photo', 'https://www.bhphotovideo.com', 'US', false, '5-25%', 4, ARRAY['deal-zone','price-drops']),
        ('Vitacost', 'online', 'Health & Supplements', 'https://www.vitacost.com', 'US', true, '20-50%', 4, ARRAY['coupons','bulk']),
        ('PetSmart', 'retail', 'Pet Supplies', 'https://www.petsmart.com', 'US', true, '15-50%', 3, ARRAY['clearance','rewards']),
        ('Faire', 'wholesale', 'Wholesale Marketplace', 'https://www.faire.com', 'US', false, 'wholesale', 4, ARRAY['B2B','net-60','wholesale']),
        ('Alibaba', 'distributor', 'Global Wholesale', 'https://www.alibaba.com', 'Global', false, 'wholesale', 3, ARRAY['B2B','bulk','private-label']);
      `);
      console.log("[DB] Seeded suppliers");
    }

    // Seed default agent settings
    await client.query(`
      INSERT INTO agent_settings (key, value) VALUES
        ('schedule', '"0 4 * * *"'),
        ('enabled', 'true'),
        ('maxProducts', '20'),
        ('minRoi', '30'),
        ('minProfitDollars', '3'),
        ('minProfitMargin', '20'),
        ('minMonthlySales', '30'),
        ('maxBsr', '100000'),
        ('maxFbaSellers', '8'),
        ('maxAmazonBuyBoxPct', '30'),
        ('maxPriceDrop90d', '20'),
        ('minRating', '4'),
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
