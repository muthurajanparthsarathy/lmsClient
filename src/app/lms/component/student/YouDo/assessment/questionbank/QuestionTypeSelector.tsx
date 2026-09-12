import React from 'react';

interface QuestionTypeSelectorProps {
  questionType: 'MCQ' | 'Programming';
  onChange: (type: 'MCQ' | 'Programming') => void;
}

const QuestionTypeSelector: React.FC<QuestionTypeSelectorProps> = ({
  questionType,
  onChange,
}) => {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Question Type
      </label>
      <div className="flex space-x-4">
        <button
          type="button"
          onClick={() => onChange('MCQ')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            questionType === 'MCQ'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Multiple Choice (MCQ)
        </button>
        <button
          type="button"
          onClick={() => onChange('Programming')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            questionType === 'Programming'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Programming Question
        </button>
      </div>
    </div>
  );
};

export default QuestionTypeSelector;