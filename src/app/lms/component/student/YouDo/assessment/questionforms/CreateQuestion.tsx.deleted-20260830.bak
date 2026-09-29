// components/question/CreateQuestion.tsx
import React, { useState } from 'react';
import AddQuestionForm from './AddQuestionForm';
import MCQQuestionForm from './mcq/MCQQuestionForm';
import QuestionTypeSelector from './QuestionTypeSelector';
import { AlertCircle } from 'lucide-react';

interface CreateQuestionProps {
  exerciseData: any;
  tabType: string;
  initialData?: any;
  isEditing?: boolean;
  onClose: () => void;
  onSave: (questionData: any) => void;
}

const CreateQuestion: React.FC<CreateQuestionProps> = ({
  exerciseData,
  tabType,
  initialData,
  isEditing = false,
  onClose,
  onSave
}) => {
  // Get exercise type from exercise data
  const exerciseType = exerciseData.fullExerciseData?.exerciseInformation?.exerciseType || 'PROGRAMMING';
  
  // State for question type selection (only for COMBINED mode)
  const [selectedQuestionType, setSelectedQuestionType] = useState<'PROGRAMMING' | 'MCQ' | null>(
    exerciseType === 'COMBINED' ? null : 
    exerciseType === 'MCQ' ? 'MCQ' : 'PROGRAMMING'
  );

  console.log('📋 Exercise Type:', exerciseType);
  console.log('📋 Selected Question Type:', selectedQuestionType);

  // Determine what to render based on exercise type
  const renderContent = () => {
    // If exercise is specifically MCQ type
    if (exerciseType === 'MCQ') {
      return (
        <MCQQuestionForm
          exerciseData={exerciseData}
          initialData={initialData}
          isEditing={isEditing}
          onClose={onClose}
          onSave={onSave}
        />
      );
    }

    // If exercise is specifically PROGRAMMING type
    if (exerciseType === 'PROGRAMMING') {
      return (
        <AddQuestionForm
          exerciseData={exerciseData}
          tabType={tabType}
          initialData={initialData}
          isEditing={isEditing}
          onClose={onClose}
          onSave={onSave}
        />
      );
    }

    // If exercise is COMBINED type
    if (exerciseType === 'COMBINED') {
      // Show type selector if no type selected yet
      if (!selectedQuestionType) {
        return (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <QuestionTypeSelector
                selectedType={selectedQuestionType}
                onSelectType={setSelectedQuestionType}
              />
              
              {/* Close button */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      }

      // Show appropriate form based on selection
      if (selectedQuestionType === 'MCQ') {
        return (
          <MCQQuestionForm
            exerciseData={exerciseData}
            initialData={initialData}
            isEditing={isEditing}
            onClose={onClose}
            onSave={onSave}
          />
        );
      }

      if (selectedQuestionType === 'PROGRAMMING') {
        return (
          <AddQuestionForm
            exerciseData={exerciseData}
            tabType={tabType}
            initialData={initialData}
            isEditing={isEditing}
            onClose={onClose}
            onSave={onSave}
          />
        );
      }
    }

    // Fallback - show warning
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle className="h-6 w-6" />
            <h3 className="text-lg font-semibold">Invalid Exercise Type</h3>
          </div>
          <p className="text-gray-600 mb-6">
            Unknown exercise type: {exerciseType}. Please check the exercise configuration.
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  return renderContent();
};

export default CreateQuestion;