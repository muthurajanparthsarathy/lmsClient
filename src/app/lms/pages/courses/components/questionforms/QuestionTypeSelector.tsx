// components/question/QuestionTypeSelector.tsx
import React from 'react';
import { Code, FileText } from 'lucide-react';

interface QuestionTypeSelectorProps {
  selectedType: 'PROGRAMMING' | 'MCQ' | null;
  onSelectType: (type: 'PROGRAMMING' | 'MCQ') => void;
}

const QuestionTypeSelector: React.FC<QuestionTypeSelectorProps> = ({
  selectedType,
  onSelectType
}) => {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Select Question Type</h3>
        <p className="text-sm text-gray-600 mt-1">Choose the type of question you want to create</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
        {/* Programming Question Card */}
        <button
          type="button"
          onClick={() => onSelectType('PROGRAMMING')}
          className={`p-6 border-2 rounded-xl transition-all duration-200 flex flex-col items-center gap-3 ${
            selectedType === 'PROGRAMMING'
              ? 'border-blue-500 bg-blue-50 shadow-md'
              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
          }`}
        >
          <div className={`p-3 rounded-full ${
            selectedType === 'PROGRAMMING' ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            <Code className={`h-8 w-8 ${
              selectedType === 'PROGRAMMING' ? 'text-blue-600' : 'text-gray-600'
            }`} />
          </div>
          <div className="text-center">
            <h4 className="font-medium text-gray-900">Programming Question</h4>
            <p className="text-sm text-gray-600 mt-1">
              Write code to solve problems with test cases
            </p>
          </div>
          {selectedType === 'PROGRAMMING' && (
            <div className="mt-2 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
              Selected
            </div>
          )}
        </button>

        {/* MCQ Question Card */}
        <button
          type="button"
          onClick={() => onSelectType('MCQ')}
          className={`p-6 border-2 rounded-xl transition-all duration-200 flex flex-col items-center gap-3 ${
            selectedType === 'MCQ'
              ? 'border-green-500 bg-green-50 shadow-md'
              : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
          }`}
        >
          <div className={`p-3 rounded-full ${
            selectedType === 'MCQ' ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            <FileText className={`h-8 w-8 ${
              selectedType === 'MCQ' ? 'text-green-600' : 'text-gray-600'
            }`} />
          </div>
          <div className="text-center">
            <h4 className="font-medium text-gray-900">Multiple Choice</h4>
            <p className="text-sm text-gray-600 mt-1">
              Select correct answer from given options
            </p>
          </div>
          {selectedType === 'MCQ' && (
            <div className="mt-2 px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
              Selected
            </div>
          )}
        </button>
      </div>

      {/* Instruction */}
      <div className="text-center mt-6">
        <p className="text-sm text-gray-500">
          You can add both types of questions in this exercise
        </p>
      </div>
    </div>
  );
};

export default QuestionTypeSelector;