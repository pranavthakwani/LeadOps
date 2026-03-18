#!/usr/bin/env node

/**
 * WhatsApp Session Management Utility
 * 
 * This script helps manage WhatsApp session files to prevent session clearing issues.
 * 
 * Usage:
 *   node scripts/manage-whatsapp-session.js status    - Show session status
 *   node scripts/manage-whatsapp-session.js cleanup   - Clean old session files
 *   node scripts/manage-whatsapp-session.js backup    - Backup current session
 */

import fs from 'fs';
import path from 'path';
import { createLogger } from '../src/utils/logger.js';

const logger = createLogger('SessionManager');

// Get session path from environment or use default
const sessionPath = process.env.WHATSAPP_SESSION_PATH || './sessions';

function getSessionStatus() {
  console.log('\n📱 WhatsApp Session Status');
  console.log('================================');
  
  if (!fs.existsSync(sessionPath)) {
    console.log('❌ Session directory does not exist');
    return;
  }

  try {
    const files = fs.readdirSync(sessionPath);
    const credsFile = path.join(sessionPath, 'creds.json');
    const hasSession = fs.existsSync(credsFile);
    
    console.log(`📁 Session Directory: ${sessionPath}`);
    console.log(`📊 Total Files: ${files.length}`);
    console.log(`🔐 Session Exists: ${hasSession ? '✅ Yes' : '❌ No'}`);
    
    if (files.length > 0) {
      console.log('\n📋 Session Files:');
      files.forEach(file => {
        const filePath = path.join(sessionPath, file);
        const stats = fs.statSync(filePath);
        const size = (stats.size / 1024).toFixed(2);
        console.log(`  📄 ${file} (${size} KB)`);
      });
    }
    
    // Warnings
    if (files.length > 1000) {
      console.log('\n⚠️  WARNING: Session has too many files and may be cleared!');
    } else if (files.length > 500) {
      console.log('\n⚠️  WARNING: Session is getting large, consider cleanup');
    }
    
  } catch (error) {
    console.error('❌ Error reading session directory:', error.message);
  }
}

function cleanupSession() {
  console.log('\n📊 WhatsApp Session Information');
  console.log('================================');
  
  if (!fs.existsSync(sessionPath)) {
    console.log('❌ Session directory does not exist');
    return;
  }

  try {
    const files = fs.readdirSync(sessionPath);
    const credsFile = path.join(sessionPath, 'creds.json');
    const hasSession = fs.existsSync(credsFile);
    
    console.log(`📁 Session Directory: ${sessionPath}`);
    console.log(`📊 Total Files: ${files.length}`);
    console.log(`🔐 Session Exists: ${hasSession ? '✅ Yes' : '❌ No'}`);
    
    if (files.length > 0) {
      console.log('\n� Session Files:');
      files.forEach(file => {
        const filePath = path.join(sessionPath, file);
        const stats = fs.statSync(filePath);
        const size = (stats.size / 1024).toFixed(2);
        console.log(`  � ${file} (${size} KB)`);
      });
    }
    
    // Warnings
    if (files.length > 800) {
      console.log('\n⚠️  WARNING: Session has many files, monitor performance');
    }
    
    console.log('\n💡 Session persistence is now automatic - no manual cleanup needed');
    console.log('� Sessions are only cleared on repeated connection failures');
    
  } catch (error) {
    console.error('❌ Error reading session directory:', error.message);
  }
}

function backupSession() {
  console.log('\n💾 Backing Up WhatsApp Session');
  console.log('================================');
  
  if (!fs.existsSync(sessionPath)) {
    console.log('❌ Session directory does not exist');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${sessionPath}-backup-${timestamp}`;
  
  try {
    fs.cpSync(sessionPath, backupPath, { recursive: true });
    console.log(`✅ Session backed up to: ${backupPath}`);
    
    const files = fs.readdirSync(sessionPath);
    console.log(`📊 Backed up ${files.length} files`);
    
  } catch (error) {
    console.error('❌ Error backing up session:', error.message);
  }
}

// Main execution
const command = process.argv[2];

switch (command) {
  case 'status':
    getSessionStatus();
    break;
  case 'cleanup':
    cleanupSession();
    break;
  case 'backup':
    backupSession();
    break;
  default:
    console.log('📱 WhatsApp Session Management Utility');
    console.log('=====================================');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/manage-whatsapp-session.js status    - Show session status');
    console.log('  node scripts/manage-whatsapp-session.js cleanup   - Show session information');
    console.log('  node scripts/manage-whatsapp-session.js backup    - Backup current session');
    console.log('');
    console.log('Note: Session persistence is now automatic!');
    console.log('Sessions are only cleared on repeated connection failures.');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/manage-whatsapp-session.js status');
    console.log('  node scripts/manage-whatsapp-session.js cleanup');
    break;
}
