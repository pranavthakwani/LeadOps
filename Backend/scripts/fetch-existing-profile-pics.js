import { createLogger } from '../src/utils/logger.js';
import { initSQLServer, getSQLPool } from '../src/config/sqlserver.js';
import { fetchProfilePicture } from '../src/services/profileService.js';
import { chatRepository } from '../src/repositories/chatRepository.js';

const logger = createLogger('FetchExistingProfilePics');

async function fetchExistingProfilePics() {
  try {
    logger.info('Starting profile picture fetch for existing contacts...');
    
    // Initialize SQL Server
    await initSQLServer();
    
    const pool = await getSQLPool();
    
    // Get all contacts that have conversations but no profile picture
    const result = await pool.request().query(`
      SELECT DISTINCT c.id, c.phone_number, c.profile_pic_fetched
      FROM contacts c
      INNER JOIN conversations conv ON c.id = conv.contact_id
      WHERE c.profile_pic_url IS NULL 
        OR c.profile_pic_fetched = 0
        OR c.profile_pic_fetched IS NULL
    `);
    
    const contacts = result.recordset;
    logger.info(`Found ${contacts.length} contacts without profile pictures`);
    
    // Get socket directly from global (if server is running)
    let sock = global.baileysSock;
    
    // If no socket, try to initialize Baileys
    if (!sock) {
      logger.info('No global socket found, attempting to initialize Baileys...');
      try {
        // Import and initialize Baileys service
        const { default: BaileysService } = await import('../src/services/baileys.js');
        const baileysService = BaileysService;
        
        // Wait a bit for socket to be available
        let attempts = 0;
        while (!sock && attempts < 10) {
          sock = global.baileysSock;
          if (sock) break;
          logger.info('Waiting for Baileys socket...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++;
        }
      } catch (error) {
        logger.error('Failed to initialize Baileys:', error);
      }
    }
    
    if (!sock) {
      logger.error('Baileys socket not available');
      return;
    }
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const contact of contacts) {
      try {
        const jid = `${contact.phone_number}@s.whatsapp.net`;
        logger.info(`Fetching profile picture for ${contact.phone_number}`);
        
        const profilePicUrl = await fetchProfilePicture(sock, jid);
        
        if (profilePicUrl) {
          await chatRepository.updateProfilePic(contact.id, profilePicUrl);
          logger.info(`✓ Updated profile pic for ${contact.phone_number}`);
          successCount++;
        } else {
          // Mark as fetched even if no picture available
          await pool.request()
            .input('id', contact.id)
            .query(`UPDATE contacts SET profile_pic_fetched = 1 WHERE id = @id`);
          logger.info(`✓ No profile pic available for ${contact.phone_number} (marked as fetched)`);
        }
      } catch (error) {
        logger.error(`Failed to fetch profile pic for ${contact.phone_number}:`, error);
        failureCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    logger.info(`Profile picture fetch complete: ${successCount} success, ${failureCount} failures`);
    
  } catch (error) {
    logger.error('Error in fetchExistingProfilePics:', error);
  } finally {
    process.exit(0);
  }
}

fetchExistingProfilePics();
