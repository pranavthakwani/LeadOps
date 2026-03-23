require('dotenv').config();
const Pipeline = require('./pipeline');

// Test data
const testInput = `
V50e 8/128 -4-19350
V60 12/256-17-29350
`;

async function runTest() {
    console.log('🚀 Starting AI Pipeline Test');
    console.log('📝 Input text:', testInput);
    console.log('');
    
    try {
        const result = await new Pipeline().processMessage(testInput);
        
        console.log('✅ Final Result:');
        console.log(JSON.stringify(result, null, 2));
        
        console.log('');
        console.log('📊 Summary:');
        console.log(`- Extracted ${result.length} item(s)`);
        result.forEach((item, index) => {
            console.log(`  ${index + 1}. ${item.brand || 'Unknown'} ${item.model} - ${item.ram}GB/${item.rom}GB - ₹${item.price}`);
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Check environment
if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in .env file');
    console.log('📝 Create .env file with your OpenAI API key');
    process.exit(1);
}

runTest();
