import { getSQLPool } from '../config/sqlserver.js';
import { createLogger } from '../utils/logger.js';
import sql from 'mssql';

const logger = createLogger('SQL Server API');

const executeQuery = async (query, params = []) => {
  try {
    const pool = getSQLPool();
    const request = pool.request();
    
    // Add parameters if provided
    params.forEach((param) => {
      if (param.name && param.value !== undefined) {
        request.input(param.name, param.type || sql.NVarChar, param.value);
      }
    });
    
    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    logger.error('SQL Query Error:', error);
    throw error;
  } 
};

export const getMessages = async (type = null) => {
  try {
    let query = '';
    
    if (!type || type === 'all') {
      query = `
        SELECT 'lead' as type, id, sender, chat_id, chat_type, brand, model, variant, ram, storage, 
               colors, quantity, quantity_min, quantity_max, price, price_min, price_max, condition, gst, dispatch, 
               confidence, raw_message, created_at
        FROM dealer_leads
        UNION ALL
        SELECT 'offering' as type, id, sender, chat_id, chat_type, brand, model, variant, ram, storage, 
               colors, quantity, quantity_min, quantity_max, price, price_min, price_max, condition, gst, dispatch, 
               confidence, raw_message, created_at
        FROM distributor_offerings
        UNION ALL
        SELECT 'ignored' as type, id, sender, chat_id, chat_type, null as brand, null as model, null as variant, 
               null as ram, null as storage, null as colors, null as quantity, null as quantity_min, null as quantity_max, 
               null as price, null as price_min, null as price_max, null as condition, null as gst, null as dispatch, 
               confidence, raw_message, created_at
        FROM ignored_messages
        ORDER BY created_at DESC
      `;
    } else if (type === 'lead') {
      query = 'SELECT * FROM dealer_leads ORDER BY created_at DESC';
    } else if (type === 'offering') {
      query = 'SELECT * FROM distributor_offerings ORDER BY created_at DESC';
    } else if (type === 'ignored') {
      query = 'SELECT * FROM ignored_messages ORDER BY created_at DESC';
    }
    
    return await executeQuery(query);
  } catch (error) {
    logger.error('Error getting messages:', error);
    throw error;
  }
};

export const getMessageById = async (id) => {
  try {
    const query = `
      SELECT 'lead' as type, id, sender, chat_id, chat_type, brand, model, variant, ram, storage, 
             colors, quantity, quantity_min, quantity_max, price, price_min, price_max, condition, gst, dispatch, 
             confidence, raw_message, created_at
      FROM dealer_leads WHERE id = @id
      UNION ALL
      SELECT 'offering' as type, id, sender, chat_id, chat_type, brand, model, variant, ram, storage, 
             colors, quantity, quantity_min, quantity_max, price, price_min, price_max, condition, gst, dispatch, 
             confidence, raw_message, created_at
      FROM distributor_offerings WHERE id = @id
      UNION ALL
      SELECT 'ignored' as type, id, sender, chat_id, chat_type, null as brand, null as model, null as variant, 
             null as ram, null as storage, null as colors, null as quantity, null as quantity_min, null as quantity_max, 
             null as price, null as price_min, null as price_max, null as condition, null as gst, null as dispatch, 
             confidence, raw_message, created_at
      FROM ignored_messages WHERE id = @id
    `;
    
    const results = await executeQuery(query, [
      { name: 'id', value: parseInt(id), type: sql.Int }
    ]);
    
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    logger.error('Error getting message by ID:', error);
    throw error;
  }
};

export const getContacts = async () => {
  try {
    const query = `
      SELECT DISTINCT sender, chat_id, MAX(created_at) as last_message_date
      FROM (
        SELECT sender, chat_id, created_at FROM dealer_leads
        UNION ALL
        SELECT sender, chat_id, created_at FROM distributor_offerings
        UNION ALL
        SELECT sender, chat_id, created_at FROM ignored_messages
      ) AS all_messages
      WHERE sender IS NOT NULL
      GROUP BY sender, chat_id
      ORDER BY last_message_date DESC
    `;
    
    return await executeQuery(query);
  } catch (error) {
    logger.error('Error getting contacts:', error);
    throw error;
  }
};

export const getDashboardStats = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM dealer_leads WHERE created_at >= @today) as leads_today,
        (SELECT COUNT(*) FROM distributor_offerings WHERE created_at >= @today) as offerings_today,
        (SELECT COUNT(*) FROM ignored_messages WHERE created_at >= @today) as ignored_today,
        (SELECT COUNT(*) FROM dealer_leads) as total_leads,
        (SELECT COUNT(*) FROM distributor_offerings) as total_offerings,
        (SELECT COUNT(*) FROM ignored_messages) as total_ignored
    `;
    
    const stats = await executeQuery(query, [
      { name: 'today', value: today.toISOString(), type: sql.DateTime }
    ]);
    
    // Get recent activity
    const recentQuery = `
      SELECT * FROM (
        SELECT TOP 5 'lead' as type, id, sender, chat_id, chat_type, brand, model, variant, ram, storage, 
               colors, quantity, quantity_min, quantity_max, price, price_min, price_max, condition, gst, dispatch, 
               confidence, raw_message, created_at
        FROM dealer_leads
        UNION ALL
        SELECT TOP 5 'offering' as type, id, sender, chat_id, chat_type, brand, model, variant, ram, storage, 
               colors, quantity, quantity_min, quantity_max, price, price_min, price_max, condition, gst, dispatch, 
               confidence, raw_message, created_at
        FROM distributor_offerings
        UNION ALL
        SELECT TOP 5 'ignored' as type, id, sender, chat_id, chat_type, null as brand, null as model, null as variant, 
               null as ram, null as storage, null as colors, null as quantity, null as quantity_min, null as quantity_max, 
               null as price, null as price_min, null as price_max, null as condition, null as gst, null as dispatch, 
               confidence, raw_message, created_at
        FROM ignored_messages
      ) AS all_messages
      ORDER BY created_at DESC
    `;
    
    const recentActivity = await executeQuery(recentQuery);
    
    return {
      stats: stats[0],
      recentActivity
    };
  } catch (error) {
    logger.error('Error getting dashboard stats:', error);
    throw error;
  }
};

export const getTodayOfferingsByBrand = async (brand = null, model = null, quantity = null, days = null) => {
  try {
    // For now, get all offerings (not just today's) to ensure we have data
    let query = `
      SELECT TOP 10 *, 
             ROW_NUMBER() OVER (ORDER BY price ASC) as rank
      FROM distributor_offerings 
      WHERE price IS NOT NULL
    `;
    
    let params = [];
    
    if (brand) {
      query += ` AND brand LIKE @brand`;
      params.push({ name: 'brand', value: `%${brand}%`, type: sql.NVarChar });
    }
    
    if (model) {
      query += ` AND model = @model`;
      params.push({ name: 'model', value: model, type: sql.NVarChar });
    }
    
    if (quantity) {
      query += ` AND quantity = @quantity`;
      params.push({ name: 'quantity', value: parseInt(quantity), type: sql.Int });
    }
    
    if (days) {
      // Handle "all" case for all-time data
      if (days === 'all') {
        // Don't add any date filter for "all" - get all-time data
        console.log('Getting all-time offerings (no date filter)');
      } else {
        // Calculate date filter based on days parameter
        const daysNum = parseInt(days);
        if (!isNaN(daysNum)) {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - daysNum);
          cutoffDate.setHours(0, 0, 0, 0);
          
          query += ` AND created_at >= @cutoffDate`;
          params.push({ name: 'cutoffDate', value: cutoffDate.toISOString(), type: sql.DateTime });
          console.log(`Getting offerings from last ${daysNum} days`);
        } else {
          console.warn('Invalid days parameter:', days, '- ignoring date filter');
        }
      }
    }
    
    query += ` ORDER BY price ASC`;
    
    console.log('Final query:', query);
    console.log('Final params:', params);
    
    return await executeQuery(query, params);
  } catch (error) {
    logger.error('Error getting today offerings by brand:', error);
    throw error;
  }
};

export const getAvailableBrands = async () => {
  try {
    // For now, get all brands (not just today's) to ensure we have data
    const query = `
      SELECT DISTINCT brand
      FROM distributor_offerings 
      WHERE brand IS NOT NULL AND brand != ''
      ORDER BY brand
    `;
    
    const result = await executeQuery(query);
    
    return result.map(row => row.brand);
  } catch (error) {
    logger.error('Error getting available brands:', error);
    throw error;
  }
};

export const getAvailableModels = async (brand) => {
  try {
    // Get all models for a specific brand
    const query = `
      SELECT DISTINCT model
      FROM distributor_offerings 
      WHERE brand LIKE @brand AND model IS NOT NULL AND model != ''
      ORDER BY model
    `;
    
    const result = await executeQuery(query, [
      { name: 'brand', value: `%${brand}%`, type: sql.NVarChar }
    ]);
    
    console.log('Available models for brand', brand, ':', result.map(row => row.model));
    return result.map(row => row.model);
  } catch (error) {
    logger.error('Error getting available models:', error);
    throw error;
  }
};

export const searchMessages = async (searchParams) => {
  try {
    const { q, type, minPrice, maxPrice, brand, model } = searchParams;
    let query = '';
    let conditions = [];
    let params = [];
    
    if (type === 'lead' || !type) {
      query += `SELECT 'lead' as type, * FROM dealer_leads WHERE 1=1`;
      if (q) {
        query += ` AND (raw_message LIKE @q OR brand LIKE @q OR model LIKE @q)`;
        params.push({ name: 'q', value: `%${q}%`, type: sql.NVarChar });
      }
      if (minPrice) {
        query += ` AND price >= @minPrice`;
        params.push({ name: 'minPrice', value: minPrice, type: sql.Decimal });
      }
      if (maxPrice) {
        query += ` AND price <= @maxPrice`;
        params.push({ name: 'maxPrice', value: maxPrice, type: sql.Decimal });
      }
      if (brand) {
        query += ` AND brand LIKE @brand`;
        params.push({ name: 'brand', value: `%${brand}%`, type: sql.NVarChar });
      }
      if (model) {
        query += ` AND model LIKE @model`;
        params.push({ name: 'model', value: `%${model}%`, type: sql.NVarChar });
      }
    }
    
    if (type === 'offering' || !type) {
      if (query) query += ' UNION ALL ';
      query += `SELECT 'offering' as type, * FROM distributor_offerings WHERE 1=1`;
      if (q) {
        query += ` AND (raw_message LIKE @q OR brand LIKE @q OR model LIKE @q)`;
        if (!params.find(p => p.name === 'q')) {
          params.push({ name: 'q', value: `%${q}%`, type: sql.NVarChar });
        }
      }
      if (minPrice) {
        query += ` AND price >= @minPrice`;
        if (!params.find(p => p.name === 'minPrice')) {
          params.push({ name: 'minPrice', value: minPrice, type: sql.Decimal });
        }
      }
      if (maxPrice) {
        query += ` AND price <= @maxPrice`;
        if (!params.find(p => p.name === 'maxPrice')) {
          params.push({ name: 'maxPrice', value: maxPrice, type: sql.Decimal });
        }
      }
      if (brand) {
        query += ` AND brand LIKE @brand`;
        if (!params.find(p => p.name === 'brand')) {
          params.push({ name: 'brand', value: `%${brand}%`, type: sql.NVarChar });
        }
      }
      if (model) {
        query += ` AND model LIKE @model`;
        if (!params.find(p => p.name === 'model')) {
          params.push({ name: 'model', value: `%${model}%`, type: sql.NVarChar });
        }
      }
    }
    
    query += ' ORDER BY created_at DESC';
    
    return await executeQuery(query, params);
  } catch (error) {
    logger.error('Error searching messages:', error);
    throw error;
  }
};
