const Extractor = require('./extractor');
const Normalizer = require('./normalizer');

class Pipeline {
    constructor() {
        this.extractor = new Extractor();
    }
    
    async processMessage(text) {
        if (!text || typeof text !== 'string') {
            throw new Error('Valid text input is required');
        }
        
        console.log('🔍 Processing:', text);
        
        try {
            // Stage 1: GPT extraction (raw)
            const rawItems = await this.extractor.extract(text);
            console.log('📤 Raw extraction:', JSON.stringify(rawItems, null, 2));
            
            // Stage 2: Local normalization (no AI)
            const cleanItems = Normalizer.normalize(rawItems);
            console.log('✨ Normalized output:', JSON.stringify(cleanItems, null, 2));
            
            return cleanItems;
            
        } catch (error) {
            console.error('❌ Pipeline failed:', error.message);
            throw error;
        }
    }
    
    // Batch processing for multiple texts
    async processBatch(texts) {
        if (!Array.isArray(texts)) {
            throw new Error('Input must be an array of texts');
        }
        
        const results = [];
        
        for (const text of texts) {
            try {
                const result = await this.processMessage(text);
                results.push({ text, result, success: true });
            } catch (error) {
                results.push({ text, error: error.message, success: false });
            }
        }
        
        return results;
    }
}

module.exports = Pipeline;
