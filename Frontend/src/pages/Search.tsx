import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, ExternalLink, Phone } from 'lucide-react';
import { searchProducts } from '../services/api';
import { Loader } from '../components/common/Loader';
import { Button } from '../components/common/Button';
import { openWhatsApp, formatPhoneNumber } from '../services/whatsapp';
import type { Product } from '../types/message';

export const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | 'lead' | 'offering'>('all');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const handleSearch = async () => {
    if (!query.trim()) {
      setProducts([]);
      setTotal(0);
      return;
    }
    
    setLoading(true);
    try {
      const result = await searchProducts({
        query: query.trim(),
        type,
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      });
      setProducts(result.products);
      setTotal(result.total);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Trigger search when query or filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch();
    }, 300); // Debounce for 300ms

    return () => clearTimeout(timeoutId);
  }, [query, type, brand, model, minPrice, maxPrice]);

  const clearFilters = () => {
    setBrand('');
    setModel('');
    setMinPrice('');
    setMaxPrice('');
    setType('all');
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Product Search</h1>
        <p className="text-gray-600 dark:text-gray-400">Search for specific products, models, or brands</p>
      </div>

      <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <div className="mb-4">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search products by brand, model, or keywords..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
            >
              <option value="all">All</option>
              <option value="offering">Offerings</option>
              <option value="lead">Leads</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Brand</label>
            <input
              type="text"
              placeholder="e.g., Apple, Samsung"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Model</label>
            <input
              type="text"
              placeholder="e.g., iPhone 15, Galaxy S24"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Min Price</label>
            <input
              type="number"
              placeholder="0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Max Price</label>
            <input
              type="number"
              placeholder="100000"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
        </div>

        <div className="flex justify-between items-center mt-4">
          <Button variant="ghost" onClick={clearFilters} className="text-sm">
            Clear Filters
          </Button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {total} results found
          </span>
        </div>
      </div>

      {loading ? (
        <Loader type="search" />
      ) : products.length > 0 ? (
        <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Search Results ({products.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {products.map((product) => (
              <div key={product.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {product.brand} {product.model}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${product.source === 'dealer_leads' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800'}`}>
                        {product.source === 'dealer_leads' ? 'Lead' : 'Offering'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {product.ram && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">RAM:</span>
                          <span className="font-medium text-gray-900 dark:text-white ml-1">{product.ram}</span>
                        </div>
                      )}
                      {product.storage && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Storage:</span>
                          <span className="font-medium text-gray-900 dark:text-white ml-1">{product.storage}</span>
                        </div>
                      )}
                      {product.quantity && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Quantity:</span>
                          <span className="font-medium text-gray-900 dark:text-white ml-1">{product.quantity}</span>
                        </div>
                      )}
                      {product.price && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Price:</span>
                          <span className="font-medium text-gray-900 dark:text-white ml-1">
                            ₹{product.price.toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}
                      {product.gst && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">GST:</span>
                          <span className="font-medium text-gray-900 dark:text-white ml-1">{product.gst}</span>
                        </div>
                      )}
                      {product.dispatch && (
                        <div className="col-span-2">
                          <span className="text-gray-500 dark:text-gray-400">Dispatch:</span>
                          <span className="font-medium text-gray-900 dark:text-white ml-1">{product.dispatch}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Seller: <span className="font-medium text-gray-900 dark:text-white">{product.seller}</span>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            <Phone className="w-3 h-3 inline mr-1" />
                            {formatPhoneNumber(product.sellerNumber)}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => openWhatsApp(product.whatsappDeepLink)}
                          className="flex items-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Contact
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-12 text-center">
          <div className="text-gray-500 dark:text-gray-400 mb-4">
            <SearchIcon className="w-16 h-16 mx-auto mb-4" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No products found</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try adjusting your search terms or filters
          </p>
        </div>
      )}
    </div>
  );
};