class Normalizer {
    static normalize(rawItems) {
        if (!Array.isArray(rawItems)) {
            rawItems = [rawItems];
        }
        
        return rawItems.map(item => this.normalizeItem(item));
    }
    
    static normalizeItem(item) {
        return {
            brand: this.detectBrand(item.model),
            model: item.model || null,
            ram: this.parseNumber(item.ram),
            rom: this.parseNumber(item.rom),
            price: this.parseNumber(item.price),
            qty: this.parseNumber(item.qty)
        };
    }
    
    static detectBrand(model) {
        if (!model || typeof model !== 'string') {
            return null;
        }
        
        const modelLower = model.toLowerCase().trim();
        
        if (modelLower.startsWith('v') || modelLower.startsWith('y') || modelLower.startsWith('x')) {
            return 'Vivo';
        } else if (modelLower.startsWith('iphone')) {
            return 'Apple';
        } else if (modelLower.startsWith('s')) {
            return 'Samsung';
        }
        
        return null;
    }
    
    static parseNumber(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        
        const parsed = parseInt(value);
        return isNaN(parsed) ? null : parsed;
    }
}

module.exports = Normalizer;
