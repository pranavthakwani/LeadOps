import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingDown, TrendingDown as EmptyIcon } from 'lucide-react';
import { getTodayOfferingsByBrand, getAvailableBrands, getAvailableModels } from '../../services/api';
import { OfferingCard } from './DetailCard';
import { CustomSelect } from './CustomSelect';
import type { Message } from '../../types/message';

interface BrandOfferingsCardProps {
  className?: string;
}

// Skeleton Components
const SkeletonCard = () => (
  <div className="bg-white/80 dark:bg-[#151821]/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
    <div className="flex items-center gap-5">
      {/* Brand Logo Skeleton */}
      <div className="w-14 h-14 bg-gray-200/80 dark:bg-[#1c1f29]/80 rounded-xl animate-pulse flex-shrink-0" />
      
      {/* Content Skeleton */}
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-20 h-5 bg-gray-200/80 dark:bg-[#1c1f29]/80 rounded animate-pulse" />
          <div className="w-24 h-4 bg-gray-200/80 dark:bg-[#1c1f29]/80 rounded animate-pulse" />
        </div>
        <div className="w-32 h-3 bg-gray-200/80 dark:bg-[#1c1f29]/80 rounded animate-pulse" />
        <div className="w-24 h-3 bg-gray-200/80 dark:bg-[#1c1f29]/80 rounded animate-pulse" />
      </div>
      
      {/* Price Skeleton */}
      <div className="text-right space-y-2">
        <div className="w-24 h-6 bg-gray-200/80 dark:bg-[#1c1f29]/80 rounded animate-pulse" />
        <div className="w-16 h-3 bg-gray-200/80 dark:bg-[#1c1f29]/80 rounded animate-pulse ml-auto" />
      </div>
    </div>
  </div>
);

const SkeletonRankBadge = () => (
  <div className="w-7 h-7 rounded-full bg-gray-200/80 dark:bg-[#1c1f29]/80 animate-pulse" />
);

export const BrandOfferingsCard: React.FC<BrandOfferingsCardProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<string>('1');
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [offerings, setOfferings] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Memoized options for CustomSelect
  const brandOptions = useMemo(() => 
    availableBrands.map(brand => ({
      value: brand,
      label: brand.charAt(0).toUpperCase() + brand.slice(1)
    })),
    [availableBrands]
  );

  const modelOptions = useMemo(() => 
    availableModels.map(model => ({
      value: model,
      label: model
    })),
    [availableModels]
  );


  const daysOptions = useMemo(() => [
    { value: '1', label: '1 day' },
    { value: '2', label: '2 days' },
    { value: '3', label: '3 days' },
    { value: 'all', label: 'ALL' },
  ], []);

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        setBrandsLoading(true);
        const brands = await getAvailableBrands();
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
          const models = await getAvailableModels(selectedBrand);
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
          const data = await getTodayOfferingsByBrand(selectedBrand, selectedModel, '', selectedDays);
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
  }, [selectedBrand, selectedModel, selectedDays]);

  const handleBrandChange = (brand: string) => {
    setSelectedBrand(brand);
    setSelectedModel(''); // Reset model when brand changes
  };

  return (
    <div className={`
      bg-white/80 dark:bg-[#151821]/80 
      backdrop-blur-sm 
      rounded-2xl 
      border border-gray-200/50 dark:border-gray-700/50
      shadow-lg shadow-black/5
      hover:shadow-xl hover:shadow-black/10
      transition-all duration-300
      ${className}
    `}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <div className="p-2 bg-[#128c7e]/10 dark:bg-[#128c7e]/20 rounded-xl backdrop-blur-sm">
                <TrendingDown className="w-5 h-5 text-[#128c7e]" />
              </div>
              Lowest Price Offerings
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Filter by brand, model, and days
            </p>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-2">
            {/* Brand Selector */}
            <CustomSelect
              value={selectedBrand}
              onChange={handleBrandChange}
              options={brandOptions}
              placeholder={availableBrands.length === 0 ? 'No brands' : 'Select brand'}
              loading={brandsLoading}
            />

            {/* Model Selector */}
            <CustomSelect
              value={selectedModel}
              onChange={setSelectedModel}
              options={modelOptions}
              placeholder={availableModels.length === 0 ? 'No models' : 'Select model'}
              disabled={!selectedBrand || availableModels.length === 0}
              loading={modelsLoading}
            />

            {/* Days Selector */}
            <CustomSelect
              value={selectedDays}
              onChange={setSelectedDays}
              options={daysOptions}
              width="w-32"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          // Skeleton Loading State
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="relative">
                <div className="absolute left-2 top-2 z-10">
                  <SkeletonRankBadge />
                </div>
                <div className="ml-9">
                  <SkeletonCard />
                </div>
              </div>
            ))}
          </div>
        ) : offerings.length === 0 ? (
          // Empty State
          <div className="text-center py-12">
            <div className="
              w-20 h-20 
              bg-gradient-to-br from-gray-100 to-gray-200 dark:from-[#1c1f29] dark:to-[#242a38]
              rounded-2xl 
              flex items-center justify-center 
              mx-auto mb-4
              shadow-inner
            ">
              <EmptyIcon className="w-10 h-10 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              {selectedBrand ? `No offerings found for ${selectedBrand} in selected time period` : 'Select a brand to view offerings'}
            </p>
          </div>
        ) : (
          // Offerings List
          <div className="space-y-3">
            {offerings.map((offering, index) => (
              <div key={offering.id} className="relative group">
                {/* Rank Badge */}
                <div className="absolute left-2 top-2 z-10">
                  <div className={`
                    w-7 h-7 
                    rounded-full 
                    flex items-center justify-center 
                    text-xs font-bold
                    shadow-md
                    transform transition-transform duration-200 group-hover:scale-110
                    ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow-yellow-500/30' :
                      index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white shadow-gray-400/30' :
                      index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-orange-500/30' :
                      'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-[#2a2f3a] dark:to-[#343b4a] text-gray-700 dark:text-gray-300 shadow-black/5'
                    }
                  `}>
                    {index + 1}
                  </div>
                </div>
                
                {/* Offering Card */}
                <div className="ml-9">
                  <OfferingCard
                    message={offering}
                    onClick={() => navigate(`/message/${offering.id}`, { 
                      state: { 
                        from: 'dashboard',
                        tab: 'offering',
                        messageType: 'offering'
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
        <div className="px-6 py-4 bg-gray-50/80 dark:bg-[#1c1f29]/80 border-t border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm rounded-b-2xl">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Showing {offerings.length} offerings from {selectedBrand}
            </span>
            <span className="text-[#128c7e] font-semibold">
              Lowest: ₹{Math.min(...offerings.map(o => o.parsedData?.price || 0)).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
