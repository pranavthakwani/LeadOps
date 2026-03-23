# AI Pipeline - Core Extraction Module

Clean, modular AI extraction pipeline for phone data processing.

## Structure

```
AI-PIPE/
├── openaiClient.js    # OpenAI API wrapper
├── extractor.js      # GPT extraction (raw only)
├── normalizer.js    # Local normalization (no AI)
├── pipeline.js       # Main pipeline orchestrator
├── test.js          # CLI test runner
├── package.json      # Dependencies and scripts
└── .env.example     # Environment template
```

## Usage

### Installation
```bash
cd AI-PIPE
npm install
cp .env.example .env
# Add your OpenAI API key to .env
```

### Testing
```bash
npm test
```

## Pipeline Stages

### Stage 1: GPT Extraction (Raw)
- Uses `gpt-4o-mini` (cost-effective)
- Very small, focused prompt
- Returns raw structured data
- **No normalization** in this stage
- **No brand inference** in this stage
- **Keeps model EXACT** as written

### Stage 2: Local Normalization (No AI)
- Converts strings to numbers
- Simple brand detection
- Clean, consistent output
- **No AI required**

## API

### Pipeline Class

```javascript
const Pipeline = require('./pipeline');

const pipeline = new Pipeline();

// Single message processing
const result = await pipeline.processMessage('V50e 8/128 -4-19350');

// Batch processing
const results = await pipeline.processBatch([
    'V50e 8/128 -4-19350',
    'V60 12/256-17-29350'
]);
```

### Expected Output

```javascript
[
  {
    "brand": "Vivo",
    "model": "V50e",
    "ram": 8,
    "rom": 128,
    "price": 19350,
    "qty": 4
  }
]
```

## Brand Detection Rules

- `V`, `Y`, `X` prefix → Vivo
- `iPhone` prefix → Apple
- `S` prefix → Samsung

## Integration

This module is designed to be plugged into your main backend:

```javascript
const Pipeline = require('./AI-PIPE/pipeline');

// In your message handler
const cleanData = await new Pipeline().processMessage(message.text);
```

## Features

- ✅ **Modular design** - easy to integrate
- ✅ **Cost-effective** - uses GPT-4o-mini
- ✅ **Clean output** - consistent format
- ✅ **No hallucination** - only extracts what's present
- ✅ **Fast processing** - minimal prompts
- ✅ **Batch support** - process multiple texts
- ✅ **Error handling** - robust error management
