'use client';

import React, { useState } from 'react';
import { Tag, List, Search, X } from 'lucide-react';

interface CommonFieldsProps {
  data: {
    questionCategory: string;
    isActive: boolean;
  };
  onChange: (field: string, value: any) => void;
  categories: string[];
}

const CommonFields: React.FC<CommonFieldsProps> = ({
  data,
  onChange,
  categories,
}) => {
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState('');

  const handleCategorySelect = (category: string) => {
    onChange('questionCategory', category);
    setShowCategoryModal(false);
    setCategorySearch('');
  };

  const handleCategorySearch = (search: string) => {
    setCategorySearch(search);
    const filtered = categories.filter(cat => 
      cat.toLowerCase().includes(search.toLowerCase())
    );
    setFilteredCategories(filtered);
  };

  // Open modal handler
  const openCategoryModal = () => {
    setShowCategoryModal(true);
    setFilteredCategories(categories);
    setCategorySearch('');
  };

  // Close modal handler
  const closeCategoryModal = () => {
    setShowCategoryModal(false);
    setCategorySearch('');
  };

  return (
    <div className="space-y-4">
      {/* Question Category Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Category *
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={data.questionCategory}
              onChange={(e) => onChange('questionCategory', e.target.value)}
              placeholder="e.g., Data Structures"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <button
            type="button"
            onClick={openCategoryModal}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm flex items-center gap-1.5 whitespace-nowrap transition-colors"
            title="Browse existing categories"
          >
            <List size={14} />
            <span>Browse</span>
          </button>
        </div>
      </div>

      {/* Active Status */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="isActive"
          checked={data.isActive}
          onChange={(e) => onChange('isActive', e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
          Active Question
        </label>
      </div>

      {/* Transparent Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50">
          {/* Transparent Backdrop */}
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
            onClick={closeCategoryModal}
          />
          
          {/* Modal Content */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-sm">
            <div className="bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl border border-white/30 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-200/50 bg-gradient-to-r from-gray-50/80 to-white/80">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Select Category</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Choose from existing</p>
                  </div>
                  <button
                    onClick={closeCategoryModal}
                    className="p-1 hover:bg-gray-100/50 rounded-full transition-colors"
                  >
                    <X size={16} className="text-gray-500" />
                  </button>
                </div>
                
                {/* Search */}
                <div className="relative mt-3">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => handleCategorySearch(e.target.value)}
                    placeholder="Search categories..."
                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-white/60 border border-gray-300/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
                    autoFocus
                  />
                </div>
              </div>

              {/* Categories List */}
              <div className="px-2 py-2 max-h-64 overflow-y-auto">
                {filteredCategories.length > 0 ? (
                  <div className="space-y-1">
                    {filteredCategories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => handleCategorySelect(category)}
                        className={`w-full px-3 py-2 text-left rounded-lg transition-all duration-150 hover:bg-blue-50/50 hover:border-blue-200/50 flex items-center gap-2 group ${
                          data.questionCategory === category 
                            ? 'bg-blue-50/80 border border-blue-200 shadow-sm' 
                            : 'border border-transparent hover:shadow-sm'
                        }`}
                      >
                        <Tag size={12} className={`flex-shrink-0 ${
                          data.questionCategory === category 
                            ? 'text-blue-500' 
                            : 'text-gray-400 group-hover:text-blue-400'
                        }`} />
                        <span className={`text-sm ${
                          data.questionCategory === category 
                            ? 'text-blue-700 font-medium' 
                            : 'text-gray-700'
                        }`}>
                          {category}
                        </span>
                        {data.questionCategory === category && (
                          <span className="ml-auto text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                            Selected
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100/50 mb-2">
                      <Tag size={18} className="text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500">No categories found</p>
                    {categorySearch && (
                      <p className="text-xs text-gray-400 mt-1">
                        Try a different search
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-gray-200/50 bg-gray-50/30">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {filteredCategories.length} category{filteredCategories.length !== 1 ? 's' : ''}
                  </div>
                  <button
                    type="button"
                    onClick={closeCategoryModal}
                    className="px-3 py-1.5 text-xs bg-white/60 hover:bg-white border border-gray-300/50 text-gray-700 rounded-lg transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommonFields;