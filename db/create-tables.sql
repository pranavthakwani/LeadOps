-- Create tables for LeadOps application
-- Run this script in your SQL Server database

-- OpenAI Usage Logs Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='openai_usage_logs' AND xtype='U')
BEGIN
    CREATE TABLE openai_usage_logs (
        id INT IDENTITY(1,1) PRIMARY KEY,
        wa_message_id NVARCHAR(255) NULL,
        model NVARCHAR(100) NULL,
        input_tokens INT NULL,
        output_tokens INT NULL,
        total_tokens INT NULL,
        cost_input_usd DECIMAL(10,6) NULL,
        cost_output_usd DECIMAL(10,6) NULL,
        cost_total_usd DECIMAL(10,6) NULL,
        latency_ms INT NULL,
        raw_message NVARCHAR(MAX) NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
    PRINT '✅ Created table: openai_usage_logs';
END
ELSE
BEGIN
    PRINT '✅ Table already exists: openai_usage_logs';
END

-- Dealer Leads Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='dealer_leads' AND xtype='U')
BEGIN
    CREATE TABLE dealer_leads (
        id INT IDENTITY(1,1) PRIMARY KEY,
        sender NVARCHAR(255) NULL,
        chat_id NVARCHAR(255) NULL,
        chat_type NVARCHAR(50) NULL,
        brand NVARCHAR(100) NULL,
        model NVARCHAR(100) NULL,
        variant NVARCHAR(100) NULL,
        ram INT NULL,
        storage INT NULL,
        colors NVARCHAR(MAX) NULL,
        quantity INT NULL,
        quantity_min INT NULL,
        quantity_max INT NULL,
        price DECIMAL(10,2) NULL,
        price_min DECIMAL(10,2) NULL,
        price_max DECIMAL(10,2) NULL,
        condition NVARCHAR(20) NULL,
        gst BIT NULL,
        dispatch NVARCHAR(20) NULL,
        confidence DECIMAL(3,2) NULL,
        raw_message NVARCHAR(MAX) NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
    PRINT '✅ Created table: dealer_leads';
END
ELSE
BEGIN
    PRINT '✅ Table already exists: dealer_leads';
END

-- Distributor Offerings Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='distributor_offerings' AND xtype='U')
BEGIN
    CREATE TABLE distributor_offerings (
        id INT IDENTITY(1,1) PRIMARY KEY,
        sender NVARCHAR(255) NULL,
        chat_id NVARCHAR(255) NULL,
        chat_type NVARCHAR(50) NULL,
        brand NVARCHAR(100) NULL,
        model NVARCHAR(100) NULL,
        variant NVARCHAR(100) NULL,
        ram INT NULL,
        storage INT NULL,
        colors NVARCHAR(MAX) NULL,
        quantity INT NULL,
        quantity_min INT NULL,
        quantity_max INT NULL,
        price DECIMAL(10,2) NULL,
        price_min DECIMAL(10,2) NULL,
        price_max DECIMAL(10,2) NULL,
        condition NVARCHAR(20) NULL,
        gst BIT NULL,
        dispatch NVARCHAR(20) NULL,
        confidence DECIMAL(3,2) NULL,
        raw_message NVARCHAR(MAX) NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
    PRINT '✅ Created table: distributor_offerings';
END
ELSE
BEGIN
    PRINT '✅ Table already exists: distributor_offerings';
END

-- Message Replies Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='message_replies' AND xtype='U')
BEGIN
    CREATE TABLE message_replies (
        id INT IDENTITY(1,1) PRIMARY KEY,
        replied_by NVARCHAR(255) NULL,
        replied_by_name NVARCHAR(255) NULL,
        replied_message NVARCHAR(MAX) NULL,
        replied_at DATETIME NULL,
        quoted_message_id NVARCHAR(255) NULL,
        quoted_message_text NVARCHAR(MAX) NULL,
        chat_type NVARCHAR(50) NULL,
        source NVARCHAR(50) NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
    PRINT '✅ Created table: message_replies';
END
ELSE
BEGIN
    PRINT '✅ Table already exists: message_replies';
END

-- Ignored Messages Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ignored_messages' AND xtype='U')
BEGIN
    CREATE TABLE ignored_messages (
        id INT IDENTITY(1,1) PRIMARY KEY,
        sender NVARCHAR(255) NULL,
        chat_id NVARCHAR(255) NULL,
        chat_type NVARCHAR(50) NULL,
        confidence DECIMAL(3,2) NULL,
        raw_message NVARCHAR(MAX) NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
    PRINT '✅ Created table: ignored_messages';
END
ELSE
BEGIN
    PRINT '✅ Table already exists: ignored_messages';
END

PRINT '';
PRINT '🎉 All tables created successfully!';
PRINT '';
PRINT 'Tables created:';
PRINT '- openai_usage_logs (for OpenAI API usage tracking)';
PRINT '- dealer_leads (for buyer leads)';
PRINT '- distributor_offerings (for seller offerings)';
PRINT '- message_replies (for reply tracking)';
PRINT '- ignored_messages (for non-business messages)';
