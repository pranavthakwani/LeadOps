import { getSupabaseChat, initSupabaseChat } from '../config/supabase-chat.js';
import { createLogger } from '../utils/logger.js';
import { baileysService } from '../services/baileys.js';

// Ensure Supabase is initialized when this module is loaded
try {
  initSupabaseChat();
  console.log('✅ Supabase initialized in supabase-chatRepository.js');
} catch (error) {
  console.error('❌ Failed to initialize Supabase in repository:', error);
}

const logger = createLogger('SupabaseChatRepository');

// Helper function to fetch group metadata
async function fetchGroupMetadata(groupJid) {
  try {
    const sock = baileysService?.getClient();
    if (!sock) {
      logger.warn('WhatsApp socket not available, cannot fetch group metadata');
      return null;
    }

    const metadata = await sock.groupMetadata(groupJid);
    logger.info('Fetched group metadata', { 
      groupJid, 
      subject: metadata.subject,
      desc: metadata.desc,
      participants: metadata.participants?.length || 0
    });

    return {
      groupName: metadata.subject,
      groupDesc: metadata.desc,
      participantsCount: metadata.participants?.length || 0
    };
  } catch (error) {
    logger.error('Failed to fetch group metadata', { groupJid, error: error.message });
    return null;
  }
}

// DB safety wrapper
async function safeQuery(fn, operation = 'database operation') {
  try {
    return await fn();
  } catch (err) {
    logger.error(`Supabase query failed: ${operation}`, { 
      error: err.message,
      stack: err.stack 
    });
    return null;
  }
}

export const supabaseChatRepository = {

  async getOrCreateConversation(jid) {
    const supabase = getSupabaseChat();

    // Determine type
    let type = 'direct';
    if (jid.endsWith('@g.us')) type = 'group';
    if (jid.includes('@broadcast')) type = 'broadcast';

    try {
      // First check if conversation exists
      const { data: existing, error: fetchError } = await supabase
        .from('conversations')
        .select('*')
        .eq('jid', jid)
        .single();

      if (existing) {
        console.log(`📱 Found existing conversation for JID ${jid}: ${existing.id}`);
        
        // For groups, check if metadata needs to be fetched
        if (type === 'group' && !existing.group_name) {
          console.log(`🔍 Group conversation missing metadata, fetching...`);
          const groupData = await fetchGroupMetadata(jid);
          
          if (groupData) {
            const { error: updateError } = await supabase
              .from('conversations')
              .update({
                group_name: groupData.groupName,
                participants_count: groupData.participantsCount,
                metadata_fetched_at: new Date().toISOString()
              })
              .eq('id', existing.id);
              
            if (updateError) {
              logger.error('Failed to update group metadata', { error: updateError.message });
            } else {
              console.log(`✅ Updated group metadata for conversation ${existing.id}: ${groupData.groupName}`);
            }
          }
        }
        
        return existing.id;
      }

      // If not found, create new conversation
      console.log(`🆕 Creating new conversation for JID: ${jid}`);
      
      // For groups, fetch metadata before creating
      let groupData = null;
      if (type === 'group') {
        groupData = await fetchGroupMetadata(jid);
      }
      
      const { data: inserted, error: insertError } = await supabase
        .from('conversations')
        .insert({
          jid,
          type,
          created_at: new Date().toISOString(),
          // Add group metadata if available
          ...(groupData && {
            group_name: groupData.groupName,
            participants_count: groupData.participantsCount,
            metadata_fetched_at: new Date().toISOString()
          })
        })
        .select('id')
        .single();

      if (insertError) {
        throw insertError;
      }

      const conversationId = inserted.id;
      console.log(`✅ Created new conversation ${conversationId} for JID: ${jid}`);

      // Auto-link to existing contact ONLY for direct chats (NOT groups)
      if (type === 'direct' && jid.endsWith('@s.whatsapp.net')) {
        const phone = jid.replace('@s.whatsapp.net', '');
        
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('phone_number', phone)
          .single();

        if (existingContact) {
          // Check if conversation is already linked to a contact
          const { data: convCheck } = await supabase
            .from('conversations')
            .select('contact_id')
            .eq('id', conversationId)
            .not('contact_id', 'is', null)
            .single();

          // Only auto-link if conversation is not already linked
          if (!convCheck) {
            await this.linkContact(conversationId, existingContact.id);
            console.log(`Auto-linked conversation ${conversationId} to existing contact ${existingContact.id}`);
          } else {
            console.log(`Conversation ${conversationId} already linked to contact ${convCheck.contact_id}, skipping auto-link`);
          }
        }
      }

      return conversationId;

    } catch (err) {
      logger.error('getOrCreateConversation failed', { error: err.message, jid });
      throw err;
    }
  },

  // Group metadata and profile picture management
  async fetchGroupMetadata(groupJid, sock) {
    const supabase = getSupabaseChat();
    
    try {
      // Check if metadata was recently fetched (within 30 days)
      const { data: existing } = await supabase
        .from('conversations')
        .select('metadata_fetched_at, group_name')
        .eq('jid', groupJid)
        .single();

      if (existing && existing.metadata_fetched_at) {
        const lastFetch = new Date(existing.metadata_fetched_at);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        if (lastFetch > thirtyDaysAgo) {
          console.log(`📋 Group metadata recently fetched for ${groupJid}, skipping`);
          return existing.group_name;
        }
      }

      console.log(`🔄 Fetching group metadata for ${groupJid}`);
      
      // Fetch metadata from WhatsApp
      const metadata = await sock.groupMetadata(groupJid);
      
      if (metadata) {
        const updateData = {
          group_name: metadata.subject,
          participants_count: metadata.participants?.length || 0,
          metadata_fetched_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('conversations')
          .update(updateData)
          .eq('jid', groupJid);

        if (error) {
          logger.error('Failed to update group metadata', { error: error.message, groupJid });
        } else {
          console.log(`✅ Updated group metadata for ${groupJid}:`, updateData);
        }

        return metadata.subject;
      }
    } catch (error) {
      logger.error('Failed to fetch group metadata', { error: error.message, groupJid });
    }
    
    return null;
  },

  async fetchGroupProfilePicture(groupJid, sock) {
    const supabase = getSupabaseChat();
    
    try {
      // Check if profile picture was recently fetched (within 30 days)
      const { data: existing } = await supabase
        .from('conversations')
        .select('profile_pic_fetched_at, profile_pic_url')
        .eq('jid', groupJid)
        .single();

      if (existing && existing.profile_pic_fetched_at) {
        const lastFetch = new Date(existing.profile_pic_fetched_at);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        if (lastFetch > thirtyDaysAgo && existing.profile_pic_url) {
          console.log(`🖼️ Group profile picture recently fetched for ${groupJid}, skipping`);
          return existing.profile_pic_url;
        }
      }

      console.log(`🔄 Fetching group profile picture for ${groupJid}`);
      
      // Fetch profile picture from WhatsApp
      const profilePicUrl = await sock.profilePictureUrl(groupJid, 'image');
      
      if (profilePicUrl) {
        const updateData = {
          profile_pic_url: profilePicUrl,
          profile_pic_fetched_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('conversations')
          .update(updateData)
          .eq('jid', groupJid);

        if (error) {
          logger.error('Failed to update group profile picture', { error: error.message, groupJid });
        } else {
          console.log(`✅ Updated group profile picture for ${groupJid}`);
        }

        return profilePicUrl;
      }
    } catch (error) {
      logger.error('Failed to fetch group profile picture', { error: error.message, groupJid });
    }
    
    return null;
  },

  async insertMessage(data) {
    return await safeQuery(async () => {
      const supabase = getSupabaseChat();

      // Check if message already exists
      const { data: existingMessage } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('wa_message_id', data.waMessageId)
        .single();

      if (existingMessage) {
        console.log('Message already exists, skipping insert:', data.waMessageId);
        
        // Still need to return conversationId for socket emission
        const conversation = await this.getOrCreateConversation(data.jid);
        return conversation;
      }

      // Determine conversation JID and participant JID
      let conversationJid = data.jid;
      let participantJid = data.jid;
      let isGroupMessage = false;

      // Handle group messages
      if (data.jid.endsWith('@g.us')) {
        isGroupMessage = true;
        conversationJid = data.jid; // Group JID for conversation
        participantJid = data.participantJid || data.jid; // Real participant JID
      }

      // Get or create conversation (group or direct)
      const conversationId = await this.getOrCreateConversation(conversationJid);
      
      // Resolve or create contact for participant (for group messages)
      let contactId = null;
      if (participantJid && participantJid !== conversationJid) {
        // This is a group message, resolve contact for participant
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('primary_jid', participantJid)
          .single();

        if (contact) {
          contactId = contact.id;
          // Update contact's last_push_name if provided
          if (data.pushName) {
            await supabase
              .from('contacts')
              .update({ last_push_name: data.pushName })
              .eq('id', contactId);
          }
        }
      }

      // Insert message with group support and media metadata
      console.log('🔍 DEBUG: Inserting message with data:', {
        waMessageId: data.waMessageId,
        fromMe: data.fromMe,
        text: data.text,
        timestamp: data.timestamp,
        mediaType: data.mediaType,
        mediaUrl: data.mediaUrl,
        mediaFilesize: data.mediaFilesize,
        mediaDuration: data.mediaDuration,
        mediaWidth: data.mediaWidth,
        mediaHeight: data.mediaHeight,
        mediaPageCount: data.mediaPageCount,
        mediaThumbnailUrl: data.mediaThumbnailUrl,
        mediaCaption: data.mediaCaption
      });

      const { data: messageData, error: insertError } = await supabase
        .from('chat_messages')
        .insert({
          jid: participantJid, // Store participant JID for contact mapping
          conversation_id: conversationId,
          wa_message_id: data.waMessageId,
          from_me: data.fromMe,
          message_text: data.text,
          message_timestamp: data.timestamp,
          created_at: new Date().toISOString(),
          quoted_message_id: data.quotedMessageId || null,
          quoted_text: data.quotedText || null,
          quoted_sender: data.quotedSender || null,
          raw_message: data.rawMessage || null,
          // Group message specific fields
          is_group_message: isGroupMessage ? 1 : 0,
          original_group_jid: isGroupMessage ? conversationJid : null,
          sender_jid: isGroupMessage ? participantJid : null,
          push_name: data.pushName || null,
          // 🎥🖼️🎵 Media metadata fields
          media_type: data.mediaType || null,
          media_url: data.mediaUrl || null,
          media_filename: data.mediaFilename || null,
          media_filesize: data.mediaFilesize ? (typeof data.mediaFilesize === 'object' ? data.mediaFilesize.low : data.mediaFilesize) : null,
          media_mimetype: data.mediaMimetype || null,
          media_duration: data.mediaDuration || null,
          media_width: data.mediaWidth || null,
          media_height: data.mediaHeight || null,
          media_page_count: data.mediaPageCount || null,
          media_thumbnail_url: data.mediaThumbnailUrl || null,
          media_caption: data.mediaCaption || null
        })
        .select('id')
        .single();

      if (insertError) {
        logger.error('Failed to insert message', { error: insertError.message, waMessageId: data.waMessageId });
        throw insertError;
      }

      // Update conversation metadata and unread count
      const updateData = {
        last_message_at: Date.now() // ✅ Send as number (milliseconds)
      };

      console.log('🔄 Updating conversation metadata:', {
        conversationId,
        last_message_at: updateData.last_message_at,
        fromMe: data.fromMe,
        isGroupMessage
      });

      if (data.fromMe === 0) {
        // For incoming messages, increment unread count
        const { data: conv } = await supabase
          .from('conversations')
          .select('unread_count')
          .eq('id', conversationId)
          .single();

        updateData.unread_count = (conv?.unread_count || 0) + 1;
      }

      const { data: updateResult, error: updateError } = await supabase
        .from('conversations')
        .update(updateData)
        .eq('id', conversationId)
        .select();

      if (updateError) {
        console.error('❌ Failed to update conversation:', updateError);
      } else {
        console.log('✅ Conversation updated successfully:', updateResult);
      }

      return conversationId;
    }, 'insertMessage');
  },

  async getMessageById(messageId) {
    const supabase = getSupabaseChat();

    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        id,
        wa_message_id,
        message_text,
        from_me,
        message_timestamp,
        jid,
        raw_message
      `)
      .eq('wa_message_id', messageId)
      .maybeSingle();

    if (error) {
      logger.error('getMessageById failed', { error: error.message, messageId });
      return null;
    }

    return data;
  },

  async getConversationByJid(jid) {
    const supabase = getSupabaseChat();

    const { data, error } = await supabase
      .from('conversations')
      .select('id, jid, type, contact_id')
      .eq('jid', jid)
      .single();

    if (error) {
      logger.error('getConversationByJid failed', { error: error.message, jid });
      return null;
    }

    return data;
  },

  async getMessagesByJid(jid) {
    const supabase = getSupabaseChat();

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('jid', jid)
      .order('message_timestamp', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      logger.error('getMessagesByJid failed', { error: error.message, jid });
      return [];
    }

    return data;
  },

  async getMessagesByConversationId(conversationId, limit = null, offset = null) {
    const supabase = getSupabaseChat();

    console.log('🔍 getMessagesByConversationId called:', { conversationId, limit, offset });

    // Simple query - NO nested joins, but include all media fields
    let query = supabase
      .from('chat_messages')
      .select(`
        id,
        jid,
        conversation_id,
        wa_message_id,
        from_me,
        message_text,
        message_timestamp,
        created_at,
        quoted_message_id,
        quoted_text,
        quoted_sender,
        raw_message,
        is_group_message,
        original_group_jid,
        sender_jid,
        push_name,
        media_type,
        media_url,
        media_filename,
        media_filesize,
        media_mimetype,
        media_duration,
        media_width,
        media_height,
        media_page_count,
        media_thumbnail_url,
        media_caption
      `)
      .eq('conversation_id', conversationId)
      .order('message_timestamp', { ascending: true })
      .order('id', { ascending: true });

    // Add pagination if provided
    if (limit) {
      query = query.limit(limit);
    }
    if (offset) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ getMessagesByConversationId failed:', error);
      logger.error('getMessagesByConversationId failed', { error: error.message, conversationId });
      return [];
    }

    console.log('✅ getMessagesByConversationId found messages:', data?.length || 0);

    return data || [];
  },

  async linkContact(conversationId, contactId) {
    const supabase = getSupabaseChat();

    // First, get the conversation JID
    const { data: convResult, error: convError } = await supabase
      .from('conversations')
      .select('jid')
      .eq('id', conversationId)
      .single();

    if (convError || !convResult) {
      console.log('Conversation not found for linking:', conversationId);
      return;
    }

    const jid = convResult.jid;
    console.log('Linking conversation', conversationId, 'with JID', jid, 'to contact', contactId);

    // Update the conversation with the contact
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ contact_id: contactId })
      .eq('id', conversationId);

    if (updateError) {
      logger.error('Failed to link contact to conversation', { error: updateError.message, conversationId, contactId });
      return;
    }

    // If this is a @lid JID, also create a jid_mapping entry
    if (jid.endsWith('@lid')) {
      // Check if mapping already exists
      const { data: existingMapping } = await supabase
        .from('jid_mappings')
        .select('id')
        .eq('jid', jid)
        .eq('contact_id', contactId)
        .single();

      if (!existingMapping) {
        // Create mapping for @lid JIDs
        const { error: mappingError } = await supabase
          .from('jid_mappings')
          .insert({
            jid,
            contact_id: contactId,
            created_at: new Date().toISOString()
          });

        if (mappingError) {
          logger.error('Failed to create JID mapping', { error: mappingError.message, jid, contactId });
        } else {
          logger.info(`Created JID mapping for @lid: ${jid} -> contact ${contactId}`);
        }
      }
    }

    console.log('Successfully linked conversation', conversationId, 'to contact', contactId);
  },

  async findContactByPhone(phone, name = null) {
    const supabase = getSupabaseChat();

    if (!phone || phone.trim() === '') {
      throw new Error('Phone number is required');
    }

    const normalizedPhone = this.normalizePhone(phone);
    console.log('Looking for existing contact by phone:', normalizedPhone);

    const { data: existing, error: fetchError } = await supabase
      .from('contacts')
      .select('id, display_name, is_auto_generated')
      .eq('phone_number', normalizedPhone)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error('❌ Error finding contact:', fetchError);
      return null;
    }

    if (existing) {
      console.log('Found existing contact:', existing.id);
      return existing.id; // Return just the ID
    }

    console.log('No existing contact found for phone:', normalizedPhone);
    return null; // Return null if not found (don't create)
  },

  async getOrCreateContactByPhone(phone, name = null) {
    const supabase = getSupabaseChat();

    if (!phone || phone.trim() === '') {
      throw new Error('Phone number is required');
    }

    const normalizedPhone = this.normalizePhone(phone);
    console.log('Looking for phone:', normalizedPhone);

    const { data: existing, error: fetchError } = await supabase
      .from('contacts')
      .select('id, display_name, is_auto_generated')
      .eq('phone_number', normalizedPhone)
      .single();

    if (existing) {
      const contact = existing;
      console.log('Found existing contact:', contact.id);

      // Update contact if new pushName is available
      if (name && name !== 'Unknown' && name !== contact.display_name) {
        const shouldUpdate = 
          (contact.is_auto_generated === true) || 
          (!contact.display_name || contact.display_name === 'Unknown' || contact.display_name === '');
          
        if (shouldUpdate) {
          console.log('Updating contact name:', contact.id, 'from', contact.display_name, 'to', name);
          await supabase
            .from('contacts')
            .update({ display_name: name })
            .eq('id', contact.id);
        }
      }

      return contact.id;
    }

    // Create new contact with is_auto_generated = true for auto-created contacts
    const { data: inserted, error: insertError } = await supabase
      .from('contacts')
      .insert({
        display_name: name || 'Unknown',
        phone_number: normalizedPhone,
        is_auto_generated: true,
        primary_jid: `${normalizedPhone}@s.whatsapp.net`
      })
      .select('id')
      .single();

    if (insertError) {
      logger.error('Failed to create contact', { error: insertError.message, phone: normalizedPhone });
      throw insertError;
    }

    console.log('Created new auto-generated contact:', inserted.id);
    return inserted.id;
  },

  async getOrCreateContactByJid(jid, name = null) {
    const supabase = getSupabaseChat();

    if (!jid || jid.trim() === '') {
      throw new Error('JID is required');
    }

    console.log('Looking for JID:', jid);

    // First check if this JID is already mapped to a contact via jid_mappings
    const { data: mappedContact } = await supabase
      .from('jid_mappings')
      .select(`
        contacts!inner(
          id, 
          display_name, 
          is_auto_generated, 
          phone_number
        )
      `)
      .eq('jid', jid)
      .single();

    if (mappedContact) {
      const contact = mappedContact.contacts;
      console.log('Found mapped contact by JID:', contact.id, 'with name:', contact.display_name);
      
      // Update contact name if needed (only if auto-generated or empty)
      if (name && name !== 'Unknown' && name !== contact.display_name) {
        const shouldUpdate = 
          (contact.is_auto_generated === true) || 
          (!contact.display_name || contact.display_name === 'Unknown' || contact.display_name === '');
          
        if (shouldUpdate) {
          console.log('Updating mapped contact name:', contact.id, 'from', contact.display_name, 'to', name);
          await supabase
            .from('contacts')
            .update({ display_name: name })
            .eq('id', contact.id);
        }
      }
      
      return contact.id;
    }

    // Check primary_jid directly on contacts
    const { data: existing, error: fetchError } = await supabase
      .from('contacts')
      .select('id, display_name, is_auto_generated')
      .eq('primary_jid', jid)
      .single();

    if (existing) {
      const contact = existing;
      console.log('Found existing contact by JID:', contact.id);

      // Update contact if new name is available
      if (name && name !== 'Unknown' && name !== contact.display_name) {
        const shouldUpdate = 
          (contact.is_auto_generated === true) || 
          (!contact.display_name || contact.display_name === 'Unknown' || contact.display_name === '');
          
        if (shouldUpdate) {
          console.log('Updating contact name by JID:', contact.id, 'from', contact.display_name, 'to', name);
          await supabase
            .from('contacts')
            .update({ display_name: name })
            .eq('id', contact.id);
        }
      }

      return contact.id;
    }

    // Create new contact with is_auto_generated = true for auto-created contacts
    const { data: inserted, error: insertError } = await supabase
      .from('contacts')
      .insert({
        display_name: name || 'Unknown Business',
        primary_jid: jid,
        is_auto_generated: true
      })
      .select('id')
      .single();

    if (insertError) {
      logger.error('Failed to create contact by JID', { error: insertError.message, jid });
      throw insertError;
    }

    console.log('Created new auto-generated contact by JID:', inserted.id);
    return inserted.id;
  },

  async mapJidToContact(jid, contactId) {
    const supabase = getSupabaseChat();

    // Check if JID is already mapped to any contact
    const { data: existingJid } = await supabase
      .from('jid_mappings')
      .select('contact_id')
      .eq('jid', jid)
      .single();

    // If JID is already mapped to a different contact, we need to handle it
    if (existingJid) {
      const existingContactId = existingJid.contact_id;
      
      if (existingContactId !== contactId) {
        // JID is mapped to a different contact - this is a conflict
        // Update the existing mapping to point to the new contact
        await supabase
          .from('jid_mappings')
          .update({ 
            contact_id: contactId, 
            created_at: new Date().toISOString() 
          })
          .eq('jid', jid);
        
        logger.info(`Updated JID ${jid} mapping from contact ${existingContactId} to contact ${contactId}`);
      }
      // If it's already mapped to the same contact, no action needed
    } else {
      // Create new mapping if JID doesn't exist
      const { error: insertError } = await supabase
        .from('jid_mappings')
        .insert({
          jid,
          contact_id: contactId,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        logger.error('Failed to create JID mapping', { error: insertError.message, jid, contactId });
        throw insertError;
      }
      
      logger.info(`Mapped JID ${jid} to contact ${contactId}`);
    }

    // Also link any conversations with this JID to the contact
    await supabase
      .from('conversations')
      .update({ contact_id: contactId })
      .eq('jid', jid)
      .or(`contact_id.is.null,contact_id.neq.${contactId}`);

    // Get the conversation ID for the mapped JID to return
    const { data: convResult } = await supabase
      .from('conversations')
      .select('id')
      .eq('jid', jid)
      .single();

    const conversationId = convResult?.id || null;
    
    return {
      success: true,
      conversationId: conversationId
    };
  },

  async getContactByJid(jid) {
    const supabase = getSupabaseChat();

    // First check jid_mappings
    const { data: mappedResult } = await supabase
      .from('jid_mappings')
      .select('contacts!inner(*)')
      .eq('jid', jid)
      .single();

    if (mappedResult) {
      return mappedResult.contacts;
    }

    // Then check primary_jid
    const { data: primaryResult } = await supabase
      .from('contacts')
      .select('*')
      .eq('primary_jid', jid)
      .single();

    return primaryResult || null;
  },

  async transferJidMappings(sourceContactId, targetContactId) {
    const supabase = getSupabaseChat();

    // Transfer all JID mappings from source to target contact
    const { error } = await supabase
      .from('jid_mappings')
      .update({ 
        contact_id: targetContactId, 
        created_at: new Date().toISOString() 
      })
      .eq('contact_id', sourceContactId);

    if (error) {
      logger.error('Failed to transfer JID mappings', { error: error.message, sourceContactId, targetContactId });
      throw error;
    }

    logger.info(`Transferred JID mappings from contact ${sourceContactId} to contact ${targetContactId}`);
  },

  async updatePrimaryJid(contactId, jid) {
    const supabase = getSupabaseChat();

    const { error } = await supabase
      .from('contacts')
      .update({ primary_jid: jid })
      .eq('id', contactId);

    if (error) {
      logger.error('Failed to update primary JID', { error: error.message, contactId, jid });
      throw error;
    }

    logger.info(`Primary JID updated for contact ${contactId}`, { jid });
  },

  // 🔥 CRITICAL: Resolve JID to conversation (handles merged contacts)
  async resolveJidToConversation(jid) {
    const supabase = getSupabaseChat();

    try {
      // First check if JID is mapped to a contact
      const { data: mappedContact } = await supabase
        .from('jid_mappings')
        .select(`
          contacts!inner(
            id,
            display_name,
            phone_number,
            primary_jid,
            is_auto_generated,
            profile_pic_url
          )
        `)
        .eq('jid', jid)
        .single();

      if (mappedContact) {
        const contact = mappedContact.contacts;
        
        // Get all conversations for this contact
        const { data: conversations } = await supabase
          .from('conversations')
          .select('id, jid, type, last_message_at')
          .eq('contact_id', contact.id)
          .order('last_message_at', { ascending: false })
          .limit(1);

        if (conversations && conversations.length > 0) {
          // Return the most recent conversation for this contact
          const latestConversation = conversations[0];
          logger.info('🔍 Resolved JID to contact conversation', { 
            jid, 
            contactId: contact.id, 
            conversationId: latestConversation.id,
            conversationJid: latestConversation.jid,
            type: latestConversation.type 
          });
          return {
            conversationId: latestConversation.id,
            contactId: contact.id,
            contact: contact,
            conversation: latestConversation
          };
        }
      }

      // If no mapping found, check direct contact lookup
      const { data: directContact } = await supabase
        .from('contacts')
        .select('*')
        .eq('primary_jid', jid)
        .single();

      if (directContact) {
        // Get conversations for this contact
        const { data: conversations } = await supabase
          .from('conversations')
          .select('id, jid, type, last_message_at')
          .eq('contact_id', directContact.id)
          .order('last_message_at', { ascending: false })
          .limit(1);

        if (conversations && conversations.length > 0) {
          const latestConversation = conversations[0];
          logger.info('🔍 Resolved JID to direct contact conversation', { 
            jid, 
            contactId: directContact.id, 
            conversationId: latestConversation.id,
            conversationJid: latestConversation.jid,
            type: latestConversation.type 
          });
          return {
            conversationId: latestConversation.id,
            contactId: directContact.id,
            contact: directContact,
            conversation: latestConversation
          };
        }
      }

      logger.info('🔍 No conversation found for JID', { jid });
      return null;

    } catch (error) {
      logger.error('resolveJidToConversation failed', { error: error.message, jid });
      throw error;
    }
  },

  async getConversationsWithContacts() {
    const supabase = getSupabaseChat();

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        jid,
        display_name,
        type,
        last_message_at,
        unread_count,
        contact_id,
        source_jid,
        contacts!left(
          display_name,
          phone_number,
          is_auto_generated,
          profile_pic_url,
          id
        ),
        jid_mappings!left(
          contacts!inner(
            display_name,
            phone_number,
            is_auto_generated,
            profile_pic_url,
            id
          )
        )
      `)
      .order('last_message_at', { ascending: false });

    if (error) {
      logger.error('getConversationsWithContacts failed', { error: error.message });
      return [];
    }

    console.log('✅ getConversationsWithContacts found conversations:', data?.length || 0);
    
    // Debug: Log first conversation to check display_name
    if (data && data.length > 0) {
      console.log('🔍 First conversation sample:', {
        jid: data[0].jid,
        display_name: data[0].display_name,
        type: data[0].type,
        resolved_display_name: data[0].resolved_display_name
      });
    }

    return data.map(conv => {
      const directContact = conv.contacts;
      const mappedContact = conv.jid_mappings?.contacts;
      
      // Determine contact info priority
      const contact = mappedContact || directContact;
      
      // Determine JID type
      let jidType = 'unknown';
      if (conv.jid.endsWith('@lid')) {
        jidType = contact ? 'mapped_lid' : 'unmapped_lid';
      } else if (conv.jid.endsWith('@s.whatsapp.net')) {
        jidType = 'whatsapp';
      } else if (conv.jid.endsWith('@g.us')) {
        jidType = 'group';
      } else if (conv.jid.endsWith('@broadcast')) {
        jidType = 'broadcast';
      }

      // Resolve display name priority
      let resolvedDisplayName = conv.jid;
      // Priority 1: Conversation's own display_name (for groups)
      if (conv.display_name) {
        resolvedDisplayName = conv.display_name;
      } else if (mappedContact?.display_name) {
        resolvedDisplayName = mappedContact.display_name;
      } else if (directContact?.display_name) {
        resolvedDisplayName = directContact.display_name;
      } else if (conv.jid.endsWith('@s.whatsapp.net')) {
        // Format phone number from JID
        const phone = conv.jid.replace('@s.whatsapp.net', '');
        if (phone.length > 10) {
          const countryCode = phone.slice(0, -10);
          const firstPart = phone.slice(-10, -5);
          const secondPart = phone.slice(-5);
          resolvedDisplayName = `+${countryCode} ${firstPart}-${secondPart}`;
        } else {
          resolvedDisplayName = phone;
        }
      }

      return {
        id: conv.id,
        display_name: conv.display_name, // Add conversation's display_name
        phone_number: contact?.phone_number || null,
        primary_jid: conv.jid, // Changed from jid to primary_jid to match frontend
        is_auto_generated: contact?.is_auto_generated || null,
        profile_pic_url: contact?.profile_pic_url || null,
        conversation_id: conv.id,
        last_message_at: conv.last_message_at,
        unread_count: conv.unread_count,
        type: conv.type,
        contact_id: conv.contact_id,
        source_jid: conv.source_jid,
        contact_display_name: contact?.display_name || null,
        contact_phone: contact?.phone_number || null,
        contact_is_auto_generated: contact?.is_auto_generated || null,
        contact_profile_pic: contact?.profile_pic_url || null,
        resolved_contact_id: contact?.id || null,
        jid_type: jidType,
        resolved_display_name: resolvedDisplayName
      };
    });
  },

  async getContactsNeedingProfilePics() {
    const supabase = getSupabaseChat();
    
    // First get contact IDs from conversations
    const { data: contactIdsData } = await supabase
      .from('conversations')
      .select('contact_id')
      .not('contact_id', 'is', null);

    if (!contactIdsData || contactIdsData.length === 0) {
      return [];
    }

    const contactIds = contactIdsData.map(c => c.contact_id);
    
    const { data, error } = await supabase
      .from('contacts')
      .select(`
        id,
        phone_number,
        profile_pic_fetched
      `)
      .in('id', contactIds)
      .or('profile_pic_url.is.null,profile_pic_fetched.eq.0,profile_pic_fetched.is.null');

    if (error) {
      logger.error('getContactsNeedingProfilePics failed', { error: error.message });
      return [];
    }

    return data || [];
  },

  async getContactsWithConversationsPaginated(offset = 0, limit = 30) {
    const supabase = getSupabaseChat();
    
    console.log('🔍 getContactsWithConversationsPaginated called:', { offset, limit });

    try {
      // Get ALL conversations (both direct and group)
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select(`
          id,
          jid,
          type,
          contact_id,
          last_message_at,
          unread_count,
          created_at,
          group_name,
          profile_pic_url,
          participants_count
        `)
        .order('last_message_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (convError) {
        console.error('❌ Conversations query failed:', convError);
        return [];
      }

      if (!conversations || conversations.length === 0) {
        console.log('📝 No conversations found');
        return [];
      }

      // Get contact info ONLY for direct conversations (contact_id is not null)
      const directConversationIds = conversations
        .filter(c => c.type === 'direct' && c.contact_id)
        .map(c => c.contact_id);
      
      let contacts = [];
      if (directConversationIds.length > 0) {
        const { data: contactData, error: contactError } = await supabase
          .from('contacts')
          .select(`
            id,
            display_name,
            phone_number,
            primary_jid,
            is_auto_generated,
            profile_pic_url
          `)
          .in('id', directConversationIds);

        if (!contactError) {
          contacts = contactData || [];
        }
      }

      // Get latest message for each conversation
      const conversationIds = conversations.map(c => c.id);
      
      const { data: messages, error: msgError } = await supabase
        .from('chat_messages')
        .select(`
          conversation_id,
          message_text,
          from_me,
          message_timestamp,
          push_name,
          sender_jid
        `)
        .in('conversation_id', conversationIds)
        .order('message_timestamp', { ascending: false });

      if (msgError) {
        console.error('❌ Messages query failed:', msgError);
        return [];
      }

      // Combine data with group support
      const result = conversations.map(conv => {
        const contact = contacts.find(c => c.id === conv.contact_id);
        const latestMsg = messages?.find(m => m.conversation_id === conv.id);

        // For group conversations, use group metadata
        if (conv.type === 'group') {
          return {
            id: conv.id, // Use conversation ID as ID for groups
            display_name: conv.group_name || conv.jid || 'Group Chat',
            phone_number: null, // Groups don't have phone numbers
            primary_jid: conv.jid, // Use group JID
            is_auto_generated: false, // Groups are not auto-generated
            profile_pic_url: conv.profile_pic_url || null,
            conversation_id: conv.id,
            last_message_at: conv.last_message_at,
            unread_count: conv.unread_count || 0,
            all_conversation_ids: conv.id.toString(),
            last_message_text: latestMsg?.message_text || null,
            last_message_from_me: latestMsg?.from_me || null,
            type: 'group' // Add type field for frontend
          };
        } else {
          // Direct conversation (existing logic)
          return {
            id: contact?.id || conv.contact_id,
            display_name: contact?.display_name || 'Unknown',
            phone_number: contact?.phone_number || null,
            primary_jid: contact?.primary_jid || conv.jid,
            is_auto_generated: contact?.is_auto_generated || true,
            profile_pic_url: contact?.profile_pic_url || null,
            conversation_id: conv.id,
            last_message_at: conv.last_message_at,
            unread_count: conv.unread_count || 0,
            all_conversation_ids: conv.id.toString(),
            last_message_text: latestMsg?.message_text || null,
            last_message_from_me: latestMsg?.from_me || null,
            type: 'direct' // Add type field for frontend
          };
        }
      });

      // 🔥 CRITICAL: Remove duplicates by primary_jid for direct conversations
      // This ensures same person (same JID) appears only once
      const deduplicated = [];
      const seenPrimaryJids = new Set();
      
      for (const item of result) {
        if (item.type === 'group') {
          // Groups are always included (unique by conversation_id)
          deduplicated.push(item);
        } else {
          // Direct conversations - deduplicate by primary_jid
          if (!seenPrimaryJids.has(item.primary_jid)) {
            seenPrimaryJids.add(item.primary_jid);
            deduplicated.push(item);
          } else {
            console.log('🔄 Removing duplicate contact:', { 
              primary_jid: item.primary_jid, 
              display_name: item.display_name,
              conversation_id: item.conversation_id 
            });
          }
        }
      }
      
      // Sort by last message time (newest first)
      deduplicated.sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime());
      
      console.log('✅ API returning:', deduplicated.length, 'deduplicated conversations (including groups)');
      return deduplicated;

    } catch (error) {
      console.error('❌ getContactsWithConversationsPaginated failed:', error);
      return [];
    }
  },

  async getContactsWithConversationsCount() {
    const supabase = getSupabaseChat();

    // Get distinct contacts that have conversations
    const { data, error } = await supabase
      .from('conversations')
      .select('contact_id', { count: 'exact', head: true })
      .not('contact_id', 'is', null);

    if (error) {
      logger.error('getContactsWithConversationsCount failed', { error: error.message });
      return 0;
    }

    return data?.length || 0;
  },

  async getUniqueConversationsWithContacts() {
    const supabase = getSupabaseChat();

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        jid,
        type,
        last_message_at,
        unread_count,
        contact_id,
        contacts!left(
          display_name,
          phone_number
        )
      `)
      .order('last_message_at', { ascending: false });

    if (error) {
      logger.error('getUniqueConversationsWithContacts failed', { error: error.message });
      return [];
    }

    // Filter to unique by contact_id or jid
    const seen = new Set();
    const unique = [];

    for (const conv of data) {
      const key = conv.contact_id || conv.jid;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push({
          id: conv.id,
          jid: conv.jid,
          type: conv.type,
          last_message_at: conv.last_message_at,
          unread_count: conv.unread_count,
          contact_id: conv.contact_id,
          display_name: conv.contacts?.display_name || null,
          phone_number: conv.contacts?.phone_number || null
        });
      }
    }

    return unique;
  },

  async resetUnreadCount(conversationId) {
    const supabase = getSupabaseChat();

    const { error } = await supabase
      .from('conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId);

    if (error) {
      logger.error('resetUnreadCount failed', { error: error.message, conversationId });
      throw error;
    }
  },

  async updateContact(contactId, displayName, phoneNumber) {
    const supabase = getSupabaseChat();

    const { error } = await supabase
      .from('contacts')
      .update({
        display_name: displayName,
        phone_number: phoneNumber
      })
      .eq('id', contactId);

    if (error) {
      logger.error('updateContact failed', { error: error.message, contactId });
      throw error;
    }

    console.log('Updated contact:', contactId);
    return true;
  },

  normalizePhone(phone) {
    if (!phone) return '';
    return String(phone).replace(/\D/g, '');
  },

  generateJid(phone) {
    return `${this.normalizePhone(phone)}@s.whatsapp.net`;
  },

  async getContactsWithConversations() {
    const supabase = getSupabaseChat();

    const { data, error } = await supabase
      .from('contacts')
      .select(`
        id,
        display_name,
        phone_number,
        is_auto_generated,
        profile_pic_url,
        conversations!left(
          id,
          last_message_at,
          unread_count
        )
      `)
      .order('display_name', { ascending: true });

    if (error) {
      logger.error('getContactsWithConversations failed', { error: error.message });
      return [];
    }

    return data;
  },

  async createContact(displayName, phoneNumber) {
    const supabase = getSupabaseChat();
    
    const normalizedPhone = this.normalizePhone(phoneNumber);
    const primaryJid = `${normalizedPhone}@s.whatsapp.net`;

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        display_name: displayName,
        phone_number: normalizedPhone,
        primary_jid: primaryJid
      })
      .select('id')
      .single();

    if (error) {
      logger.error('createContact failed', { error: error.message, displayName, phoneNumber });
      throw error;
    }

    return data.id;
  },

  async getConversationByContactId(contactId) {
    const supabase = getSupabaseChat();

    const { data, error } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows returned
      logger.error('getConversationByContactId failed', { error: error.message, contactId });
      return null;
    }

    return data?.id || null;
  },

  async createConversationForContact(contactId) {
    const supabase = getSupabaseChat();
    
    const jid = this.generateJid(contactId.toString());

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        jid,
        contact_id: contactId
      })
      .select('id')
      .single();

    if (error) {
      logger.error('createConversationForContact failed', { error: error.message, contactId });
      throw error;
    }

    return data.id;
  },

  // ✅ Optimistic message insertion for instant UI
  async insertOptimisticMessage(messageData) {
    const supabase = getSupabaseChat();
    
    try {
      // Create a basic raw message structure for quoting
      const rawMessage = JSON.stringify({
        key: {
          remoteJid: messageData.jid,
          fromMe: messageData.from_me,
          id: messageData.wa_message_id
        },
        message: {
          conversation: messageData.message_text
        },
        messageTimestamp: Math.floor(messageData.message_timestamp / 1000)
      });
      
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          jid: messageData.jid,
          wa_message_id: messageData.wa_message_id,
          from_me: messageData.from_me,
          message_text: messageData.message_text,
          message_type: messageData.message_type || 'text',
          message_timestamp: messageData.message_timestamp,
          conversation_id: messageData.conversation_id,
          push_name: messageData.push_name,
          quoted_message_id: messageData.quoted_message_id,
          raw_message: rawMessage // ✅ Add raw_message for quoting
        })
        .select()
        .single();

      if (error) {
        console.error('❌ insertOptimisticMessage failed:', error);
        return null;
      }

      console.log('⚡ Optimistic message inserted:', data.wa_message_id);
      return data;
    } catch (error) {
      console.error('❌ insertOptimisticMessage error:', error);
      return null;
    }
  },

  // ✅ Update conversation timestamp immediately
  async updateConversationTimestamp(conversationId) {
    const supabase = getSupabaseChat();
    
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ 
          last_message_at: Date.now() 
        })
        .eq('id', conversationId);

      if (error) {
        console.error('❌ updateConversationTimestamp failed:', error);
        return false;
      }

      console.log('⚡ Conversation timestamp updated:', conversationId);
      return true;
    } catch (error) {
      console.error('❌ updateConversationTimestamp error:', error);
      return false;
    }
  },

  // ✅ Update conversation timestamp with ISO date
  async updateConversationTimestampIso(conversationId) {
    const supabase = getSupabaseChat();
    
    try {
      const { error } = await supabase
        .from('conversations')
        .eq('id', conversationId)
        .update({ 
          last_message_at: new Date().toISOString()
        });

      if (error) {
        console.error('❌ updateConversationTimestamp failed:', error);
        return false;
      }

      console.log('⚡ Conversation timestamp updated:', conversationId);
      return true;
    } catch (error) {
      console.error('❌ updateConversationTimestamp error:', error);
      return false;
    }
  },

  // ✅ Create conversation from lead data
  async createConversationFromLead(leadData) {
    const supabase = getSupabaseChat();
    
    try {
      // Create the conversation first
      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert({
          contact_id: leadData.contact_id,
          jid: leadData.jid,
          display_name: leadData.display_name,
          phone_number: leadData.phone_number,
          type: 'direct', // Always create as direct conversation
          last_message_at: new Date().toISOString(),
          unread_count: 0,
          created_at: new Date().toISOString()
        })
        .select();

      if (error) {
        console.error('❌ createConversationFromLead failed:', error);
        return { success: false, error: error.message || 'Unknown error' };
      }

      // Get the newly created conversation ID
      const conversationId = conversation?.id;

      console.log('✅ Created conversation from lead:', { conversationId, leadData });

      return {
        success: true,
        conversationId: conversationId
      };
    } catch (error) {
      console.error('❌ createConversationFromLead error:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  },

  // ✅ Update conversation contact_id to null (for fixing groups)
  async updateConversationContactId(conversationId, contactId) {
    return await safeQuery(async () => {
      // Safety check
      if (conversationId == null) {
        throw new Error('conversationId is required for updateConversationContactId');
      }
      
      console.log('🔧 updateConversationContactId called:', { conversationId, contactId });
      
      // Ensure Supabase is properly initialized
      let supabase;
      try {
        supabase = getSupabaseChat();
      } catch (error) {
        console.error('❌ Supabase not initialized, trying to initialize...');
        // Try to initialize if not already done
        const { initSupabaseChat } = await import('../config/supabase-chat.js');
        supabase = initSupabaseChat();
        // After initialization, get the client again
        supabase = getSupabaseChat();
      }
      
      console.log('🔧 Supabase client:', supabase ? 'initialized' : 'null');
      
      // Verify supabase client has the required methods
      if (!supabase || typeof supabase.from !== 'function') {
        throw new Error('Invalid Supabase client - from method not available');
      }
      
      const { error } = await supabase
        .from('conversations')
        .update({ 
          contact_id: contactId
        })
        .eq('id', conversationId);

      if (error) {
        console.error('❌ updateConversationContactId failed:', error);
        throw error;
      }

      console.log('⚡ Conversation contact_id updated:', { conversationId, contactId });
      console.log('✅ Supabase update completed successfully');
      return true;
    }, 'updateConversationContactId');
  },

  // ✅ Update contact profile picture with timestamp
  async updateContactProfilePic(contactId, profileData) {
    const supabase = getSupabaseChat();
    
    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          profile_pic_url: profileData.profile_pic_url,
          profile_pic_fetched: profileData.profile_pic_fetched,
          profile_pic_last_updated: profileData.profile_pic_last_updated,
          updated_at: new Date()
        })
        .eq('id', contactId);

      if (error) {
        console.error('❌ updateContactProfilePic failed:', error);
        return false;
      }

      console.log('✅ Profile pic updated for contact:', contactId);
      return true;
    } catch (error) {
      console.error('❌ updateContactProfilePic error:', error);
      return false;
    }
  },

  async getConversationByMessageId(messageId) {
    const supabase = getSupabaseChat();

    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        conversation_id,
        conversations!inner(
          jid,
          contact_id,
          contacts!left(
            display_name,
            phone_number
          )
        )
      `)
      .eq('id', messageId)
      .single();

    if (error) {
      logger.error('getConversationByMessageId failed', { error: error.message, messageId });
      return null;
    }

    return {
      conversation_id: data.conversation_id,
      jid: data.conversations.jid,
      contact_id: data.conversations.contact_id,
      display_name: data.conversations.contacts?.display_name || null,
      phone_number: data.conversations.contacts?.phone_number || null
    };
  },

  async linkBroadcastWithWhatsApp(broadcastJid, phoneNumber) {
    const supabase = getSupabaseChat();
    
    const whatsappJid = this.generateJid(phoneNumber);
    
    const contactId = await this.getOrCreateContactByPhone(phoneNumber);
    
    // Get broadcast conversation
    const { data: broadcastConv, error: broadcastError } = await supabase
      .from('conversations')
      .select('id')
      .eq('jid', broadcastJid)
      .single();

    if (broadcastError || !broadcastConv) {
      throw new Error('Broadcast conversation not found');
    }
    
    const broadcastConvId = broadcastConv.id;
    
    // Get or create WhatsApp conversation
    let whatsappConvId;
    try {
      whatsappConvId = await this.getOrCreateConversation(whatsappJid);
    } catch (err) {
      // If WhatsApp conversation exists, get its ID
      const { data: existingWhatsappConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('jid', whatsappJid)
        .single();
      
      if (existingWhatsappConv) {
        whatsappConvId = existingWhatsappConv.id;
      } else {
        throw err;
      }
    }
    
    // Link both conversations to the same contact
    await supabase
      .from('conversations')
      .update({ contact_id: contactId })
      .in('id', [broadcastConvId, whatsappConvId]);
    
    return {
      contactId,
      broadcastJid,
      whatsappJid,
      broadcastConvId,
      whatsappConvId
    };
  },

  async getMergedMessagesByContactId(contactId, limit = null, offset = null) {
    const supabase = getSupabaseChat();

    console.log('🔍 Simplified getMergedMessagesByContactId called:', { contactId, limit, offset });

    try {
      // Simple approach: Get conversations for this contact, then get messages
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id, jid, type')
        .eq('contact_id', contactId)
        .neq('type', 'group'); // Exclude group conversations

      if (convError) {
        console.error('❌ getMergedMessagesByContactId - conversations failed:', convError);
        return [];
      }

      console.log('📝 Found conversations for contact:', {
        contactId,
        count: conversations?.length || 0,
        conversations: conversations?.map(c => ({ id: c.id, jid: c.jid, type: c.type }))
      });

      if (!conversations || conversations.length === 0) {
        console.log('📝 No conversations found for contact:', contactId);
        return [];
      }

      const conversationIds = conversations.map(c => c.id);

      // Get all messages for these conversations
      let query = supabase
        .from('chat_messages')
        .select(`
          id,
          jid,
          conversation_id,
          wa_message_id,
          from_me,
          message_text,
          message_timestamp,
          created_at,
          quoted_message_id,
          quoted_text,
          quoted_sender,
          raw_message,
          is_group_message,
          original_group_jid,
          sender_jid,
          push_name,
          media_type,
          media_url,
          media_filename,
          media_filesize,
          media_mimetype,
          media_duration,
          media_width,
          media_height,
          media_page_count,
          media_thumbnail_url,
          media_caption
        `)
        .in('conversation_id', conversationIds)
        .order('message_timestamp', { ascending: true })
        .order('id', { ascending: true });

      // Add pagination if provided
      if (limit) {
        query = query.limit(limit);
      }
      if (offset) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data: messages, error: msgError } = await query;

      if (msgError) {
        console.error('❌ getMergedMessagesByContactId - messages failed:', msgError);
        return [];
      }

      console.log('✅ getMergedMessagesByContactId returning:', messages?.length || 0, 'messages');
      return messages || [];

    } catch (error) {
      console.error('❌ getMergedMessagesByContactId failed:', error);
      return [];
    }
  },

  async cleanupDuplicateConversations() {
    const supabase = getSupabaseChat();

    // Find all conversations with phone numbers that could be linked
    const { data: unlinkedConvs, error } = await supabase
      .from('conversations')
      .select(`
        id: id,
        jid,
        contact_id,
        contacts!left(
          id: id,
          phone_number
        )
      `)
      .like('jid', '%@s.whatsapp.net')
      .is('contact_id', null)
      .not('contacts.id', 'is', null);

    if (error) {
      logger.error('cleanupDuplicateConversations failed', { error: error.message });
      return 0;
    }

    let linkedCount = 0;

    for (const conv of unlinkedConvs) {
      await this.linkContact(conv.id, conv.contacts.id);
      linkedCount++;
      console.log(`Linked conversation ${conv.id} to contact ${conv.contacts.id}`);
    }

    return linkedCount;
  },

  async getConversationIdsByContactId(contactId) {
    const supabase = getSupabaseChat();

    const { data, error } = await supabase
      .from('conversations')
      .select('id, jid, type')
      .or(`contact_id.eq.${contactId},jid.in.(
        select jid from jid_mappings where contact_id = ${contactId}
      )`);

    if (error) {
      logger.error('getConversationIdsByContactId failed', { error: error.message, contactId });
      return [];
    }

    return data;
  },

  async getConversationsByContactId(contactId) {
    const supabase = getSupabaseChat();

    console.log('🔍 Simplified getConversationsByContactId called:', { contactId });

    try {
      // Simple approach: Get conversations directly linked to contact, EXCLUDING groups
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select(`
          id,
          jid,
          type,
          contact_id,
          last_message_at,
          unread_count,
          created_at
        `)
        .eq('contact_id', contactId)
        .neq('type', 'group') // ✅ Exclude group conversations - WhatsApp keeps groups separate
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('❌ getConversationsByContactId failed:', error);
        return [];
      }

      console.log('✅ getConversationsByContactId returning:', conversations?.length || 0, 'conversations');
      return conversations || [];

    } catch (error) {
      console.error('❌ getConversationsByContactId failed:', error);
      return [];
    }
  },

  async getConversationById(conversationId) {
    const supabase = getSupabaseChat();

    const { data, error } = await supabase
      .from('conversations')
      .select('id, jid, type, contact_id, last_message_at, unread_count, group_name, participants_count, metadata_fetched_at, profile_pic_url')
      .eq('id', conversationId)
      .single();

    if (error) {
      logger.error('getConversationById failed', { error: error.message, conversationId });
      return null;
    }

    return data;
  },

  async getContactById(contactId) {
    const supabase = getSupabaseChat();
    
    const { data, error } = await supabase
      .from('contacts')
      .select('id, display_name, phone_number, primary_jid, is_auto_generated, profile_pic_url, profile_pic_fetched, profile_pic_last_updated')
      .eq('id', contactId)
      .single();

    if (error) {
      logger.error('getContactById failed', { error: error.message, contactId });
      return null;
    }

    return data;
  },

  async getContactsByPhoneNumbers(phoneNumbers) {
    const supabase = getSupabaseChat();

    if (!phoneNumbers || phoneNumbers.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .in('phone_number', phoneNumbers);

    if (error) {
      logger.error('getContactsByPhoneNumbers failed', { error: error.message });
      return [];
    }

    return data || [];
  },

  async getContactByPhone(phoneNumber) {
    const supabase = getSupabaseChat();
    
    if (!phoneNumber || phoneNumber.trim() === '') {
      return null;
    }

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      logger.error('getContactByPhone failed', { error: error.message, phoneNumber });
      return null;
    }

    return data;
  },

  async getContactsNeedingProfilePics() {
    const supabase = getSupabaseChat();

    const { data, error } = await supabase
      .from('contacts')
      .select(`
        id,
        display_name,
        phone_number,
        primary_jid,
        profile_pic_url,
        profile_pic_fetched
      `)
      .not('primary_jid', 'is', null)
      .like('primary_jid', '%@s.whatsapp.net')
      .or('profile_pic_url.is.null,profile_pic_url.eq.""')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('getContactsNeedingProfilePics failed', { error: error.message });
      return [];
    }

    return data;
  },

  async updateProfilePic(contactId, url) {
    const supabase = getSupabaseChat();

    const { error } = await supabase
      .from('contacts')
      .update({
        profile_pic_url: url,
        profile_pic_fetched: true
      })
      .eq('id', contactId);

    if (error) {
      logger.error('updateProfilePic failed', { error: error.message, contactId });
      throw error;
    }

    logger.info(`Profile picture updated for contact ${contactId}`, { url: url ? 'yes' : 'no' });
    return true;
  },

  async searchContacts(query) {
    return safeQuery(async () => {
      const supabase = getSupabaseChat();
      
      const { data, error } = await supabase
        .from('contacts')
        .select('id, display_name, phone_number, primary_jid')
        .or(`display_name.ilike.%${query.trim()}%,phone_number.ilike.%${query.trim()}%`)
        .order('display_name')
        .limit(20);

      if (error) {
        logger.error('searchContacts failed', { error: error.message, query });
        return [];
      }

      return data;
    }, 'search contacts');
  }
};
