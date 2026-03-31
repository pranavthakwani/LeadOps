import { getSupabaseChat } from './src/config/supabase-chat.js';
const supabase = getSupabaseChat();

async function checkConversations() {
  try {
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('id, jid, contact_id, last_message_at')
      .order('id', { ascending: true });
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('=== CONVERSATIONS IN DB ===');
    conversations.forEach(conv => {
      console.log(`ID: ${conv.id}, JID: ${conv.jid}, Contact: ${conv.contact_id}`);
    });
    
    const { data: contacts, error: contactError } = await supabase
      .from('contacts')
      .select('id, display_name, primary_jid')
      .order('id', { ascending: true });
    
    if (contactError) {
      console.error('Contact error:', contactError);
      return;
    }
    
    console.log('\n=== CONTACTS IN DB ===');
    contacts.forEach(contact => {
      console.log(`ID: ${contact.id}, Name: ${contact.display_name}, JID: ${contact.primary_jid}`);
    });
    
    const { data: messages, error: messageError } = await supabase
      .from('chat_messages')
      .select('conversation_id, wa_message_id, message_text, from_me')
      .order('id', { ascending: true })
      .limit(10);
    
    if (messageError) {
      console.error('Message error:', messageError);
      return;
    }
    
    console.log('\n=== RECENT MESSAGES ===');
    messages.forEach(msg => {
      console.log(`Conv: ${msg.conversation_id}, FromMe: ${msg.from_me}, Text: ${msg.message_text?.substring(0, 30)}`);
    });
    
  } catch (err) {
    console.error('Query failed:', err);
  }
  
  process.exit(0);
}

checkConversations();
