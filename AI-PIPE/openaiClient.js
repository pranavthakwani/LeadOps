const OpenAI = require('openai');

class OpenAIClient {
    constructor() {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY environment variable is required');
        }
        
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }
    
    async extractPhoneData(text) {
        const response = await this.client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You extract structured phone data. Return JSON only. Do not guess missing values. Keep model EXACT as written.'
                },
                {
                    role: 'user',
                    content: text
                }
            ],
            temperature: 0.1,
            max_tokens: 500
        });
        
        return response.choices[0].message.content;
    }
}

module.exports = OpenAIClient;
