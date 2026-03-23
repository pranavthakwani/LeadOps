const express = require('express');
const cors = require('cors');
require('dotenv').config();
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Simple brand detection mapping
function detectBrand(model) {
    if (!model) return null;
    
    const modelLower = model.toLowerCase();
    
    if (modelLower.startsWith('v') || modelLower.startsWith('y') || modelLower.startsWith('x')) {
        return 'Vivo';
    } else if (modelLower.startsWith('iphone')) {
        return 'Apple';
    } else if (modelLower.startsWith('s')) {
        return 'Samsung';
    }
    
    return null;
}

// Normalize extracted data
function normalizeData(rawItems) {
    return rawItems.map(item => {
        const normalized = {
            model: item.model || null,
            ram: item.ram ? parseInt(item.ram) : null,
            rom: item.rom ? parseInt(item.rom) : null,
            price: item.price ? parseInt(item.price) : null,
            qty: item.qty ? parseInt(item.qty) : null
        };
        
        // Add brand detection
        normalized.brand = detectBrand(item.model);
        
        return normalized;
    });
}

// Main extraction endpoint
app.post('/extract', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'Text is required' });
        }
        
        console.log('🔍 Processing text:', text);
        
        // Stage 1: GPT Extraction
        const gptResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You extract structured phone data from text. Return JSON only. Do not hallucinate unknown values. Keep model exactly as written.'
                },
                {
                    role: 'user',
                    content: text
                }
            ],
            temperature: 0.1,
            max_tokens: 500
        });
        
        const gptOutput = gptResponse.choices[0].message.content;
        console.log('🤖 GPT raw output:', gptOutput);
        
        // Parse GPT response
        let rawItems;
        try {
            rawItems = JSON.parse(gptOutput);
        } catch (parseError) {
            console.error('❌ Failed to parse GPT output:', parseError.message);
            return res.status(500).json({ error: 'Failed to parse AI response' });
        }
        
        // Stage 2: Local Normalization
        const normalizedItems = normalizeData(Array.isArray(rawItems) ? rawItems : [rawItems]);
        
        // Final output format
        const result = {
            items: normalizedItems
        };
        
        console.log('✅ Final result:', JSON.stringify(result, null, 2));
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Extraction error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 AI Pipeline Test Server running on http://localhost:${PORT}`);
    console.log(`📁 Open http://localhost:${PORT} to test extraction`);
    
    if (!process.env.OPENAI_API_KEY) {
        console.log('⚠️  WARNING: OPENAI_API_KEY not found in .env file');
        console.log('📝 Create .env file with your OpenAI API key');
    }
});
