import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, TrendingDown, Loader } from 'lucide-react';
import { getTodayOfferingsByBrand, getAvailableBrands, getAvailableModels } from '../../services/api';
import { OfferingCard } from './DetailCard';
import type { Message } from '../../types/message';

interface BrandOfferingsCardProps {
  className?: string;
}

export const BrandOfferingsCard: React.FC<BrandOfferingsCardProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedQuantity, setSelectedQuantity] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<string>('1');
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [offerings, setOfferings] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [modelsLoading, setModelsLoading] = useState(false);

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        setBrandsLoading(true);
        console.log('Fetching brands...');
        const brands = await getAvailableBrands();
        console.log('Fetched brands:', brands);
        setAvailableBrands(brands);
        if (brands.length > 0 && !selectedBrand) {
          setSelectedBrand(brands[0]);
        }
      } catch (error) {
        console.error('Failed to fetch brands:', error);
      } finally {
        setBrandsLoading(false);
      }
    };

    fetchBrands();
  }, []);

  // Fetch models when brand changes
  useEffect(() => {
    if (selectedBrand) {
      const fetchModels = async () => {
        try {
          setModelsLoading(true);
          console.log('Fetching models for brand:', selectedBrand);
          const models = await getAvailableModels(selectedBrand);
          console.log('Fetched models:', models);
          setAvailableModels(models);
          if (models.length > 0 && !selectedModel) {
            setSelectedModel(models[0]);
          }
        } catch (error) {
          console.error('Failed to fetch models:', error);
          setAvailableModels([]);
        } finally {
          setModelsLoading(false);
        }
      };

      fetchModels();
    }
  }, [selectedBrand]);

  useEffect(() => {
    if (selectedBrand) {
      const fetchOfferings = async () => {
        try {
          setLoading(true);
          console.log('Fetching offerings with brand, model, quantity, days:', selectedBrand, selectedModel, selectedQuantity, selectedDays);
          const data = await getTodayOfferingsByBrand(selectedBrand, selectedModel, selectedQuantity, selectedDays);
          setOfferings(data);
        } catch (error) {
          console.error('Failed to fetch offerings:', error);
          setOfferings([]);
        } finally {
          setLoading(false);
        }
      };

      fetchOfferings();
    }
  }, [selectedBrand, selectedModel, selectedQuantity, selectedDays]);

  const handleBrandChange = (brand: string) => {
    setSelectedBrand(brand);
    setSelectedModel(''); // Reset model when brand changes
  };

  const handleModelChange = (model: string) => {
    console.log('Model changed to:', model);
    setSelectedModel(model);
  };

  const handleQuantityChange = (quantity: string) => {
    console.log('Quantity changed to:', quantity);
    setSelectedQuantity(quantity);
  };

  const handleDaysChange = (days: string) => {
    console.log('Days changed to:', days);
    setSelectedDays(days);
  };

  return (
    <div className={`bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Lowest Price Offerings
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Filter by brand, model, quantity, and days
            </p>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-2">
            {/* Brand Selector */}
            <div className="relative">
              {brandsLoading ? (
                <div className="w-40 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              ) : (
                <div className="relative">
                  <select
                    value={selectedBrand}
                    onChange={(e) => handleBrandChange(e.target.value)}
                    className="appearance-none w-40 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors cursor-pointer shadow-sm"
                    style={{ zIndex: 10 }}
                  >
                    <option value="" disabled>
                      {availableBrands.length === 0 ? 'No brands available' : 'Select brand'}
                    </option>
                    {availableBrands.map((brand) => (
                      <option key={brand} value={brand} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                        {brand.charAt(0).toUpperCase() + brand.slice(1)}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              )}
            </div>

            {/* Model Selector */}
            <div className="relative">
              {modelsLoading ? (
                <div className="w-40 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              ) : (
                <div className="relative">
                  <select
                    value={selectedModel}
                    onChange={(e) => handleModelChange(e.target.value)}
                    disabled={!selectedBrand || availableModels.length === 0}
                    className="appearance-none w-40 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ zIndex: 10 }}
                  >
                    <option value="" disabled>
                      {availableModels.length === 0 ? 'No models available' : 'Select model'}
                    </option>
                    {availableModels.map((model) => (
                      <option key={model} value={model} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                        {model}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              )}
            </div>

            {/* Quantity Selector */}
            <div className="relative">
              <select
                    value={selectedQuantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    className="appearance-none w-32 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors cursor-pointer shadow-sm"
                    style={{ zIndex: 10 }}
                  >
                    <option value="">All quantities</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="5">5</option>
                    <option value="10">10</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </div>
            </div>

            {/* Days Selector */}
            <div className="relative">
              <select
                    value={selectedDays}
                    onChange={(e) => handleDaysChange(e.target.value)}
                    className="appearance-none w-32 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors cursor-pointer shadow-sm"
                    style={{ zIndex: 10 }}
                  >
                    <option value="1">1 day</option>
                    <option value="2">2 days</option>
                    <option value="3">3 days</option>
                    <option value="all">ALL</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader type="default" />
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading offerings...</span>
          </div>
        ) : offerings.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingDown className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {selectedBrand ? `No offerings found for ${selectedBrand} in selected time period` : 'Select a brand to view offerings'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {offerings.map((offering, index) => (
              <div key={offering.id} className="relative">
                {/* Rank Badge */}
                <div className="absolute left-2 top-2 z-10">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    index === 0 ? 'bg-yellow-500 text-white' :
                    index === 1 ? 'bg-gray-400 text-white' :
                    index === 2 ? 'bg-orange-600 text-white' :
                    'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}>
                    {index + 1}
                  </div>
                </div>
                
                {/* Offering Card */}
                <div className="ml-8">
                  <OfferingCard
                    message={offering}
                    onClick={() => navigate(`/message/${offering.id}`, { 
                      state: { 
                        from: 'dashboard',
                        tab: 'offering' 
                      } 
                    })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {offerings.length > 0 && (
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Showing {offerings.length} offerings from {selectedBrand}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              Lowest: ₹{Math.min(...offerings.map(o => o.parsedData?.price || 0)).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
