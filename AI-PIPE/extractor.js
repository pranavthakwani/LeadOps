const OpenAIClient = require('./openaiClient');

class Extractor {
    constructor() {
        this.client = new OpenAIClient();
    }
    
    async extract(rawText) {
        if (!rawText || typeof rawText !== 'string') {
            throw new Error('Valid text input is required');
        }
        
        try {
            const gptOutput = await this.client.extractPhoneData(rawText);
            console.log('🤖 GPT raw output:', gptOutput);
            
            // Parse GPT response
            const parsed = JSON.parse(gptOutput);
            
            // Ensure array format
            return Array.isArray(parsed) ? parsed : [parsed];
            
        } catch (error) {
            console.error('❌ Extraction failed:', error.message);
            throw new Error('Failed to extract phone data');
        }
    }
}

module.exports = Extractor;
