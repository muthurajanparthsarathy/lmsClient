import React from 'react';
import { CheckCircle, XCircle, Hash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface McqOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface McqQuestion {
  _id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  options: McqOption[];
  explanation: string;
}

interface McqQuestionDisplayProps {
  questions: McqQuestion[];
  onRegenerate: () => void;
  onUseQuestions: () => void;
}

const McqQuestionDisplay: React.FC<McqQuestionDisplayProps> = ({
  questions,
  onRegenerate,
  onUseQuestions
}) => {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'medium': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'hard': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getOptionLetter = (index: number) => {
    return String.fromCharCode(65 + index); // A, B, C, D, etc.
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-500" />
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {questions.length} Question{questions.length > 1 ? 's' : ''} Generated
            </h3>
            <p className="text-sm text-slate-500">Review and use these MCQ questions</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          AI Generated
        </Badge>
      </div>

      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
        {questions.map((question, questionIndex) => (
          <div key={question._id} className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-700 font-medium">
                  <Hash className="h-4 w-4" />
                  <span className="text-xs">{questionIndex + 1}</span>
                </div>
                <div>
                  <h4 className="font-medium text-slate-900">{question.title}</h4>
                  <p className="text-sm text-slate-600 mt-1">{question.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`${getDifficultyColor(question.difficulty)} capitalize`}>
                  {question.difficulty}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {question.points} pts
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-slate-500">Options:</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {question.options.map((option, optionIndex) => (
                  <div
                    key={option.id}
                    className={`flex items-start gap-3 p-3 rounded border ${option.isCorrect
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-white border-slate-200'
                      }`}
                  >
                    <div className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center ${option.isCorrect
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                      {getOptionLetter(optionIndex)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-700">{option.text}</p>
                    </div>
                    {option.isCorrect && (
                      <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {question.explanation && (
              <div className="pt-2 border-t border-slate-200">
                <span className="text-xs font-medium text-slate-500">Explanation:</span>
                <p className="text-sm text-slate-600 mt-1">{question.explanation}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">
            Total points: <span className="font-medium text-slate-900">
              {questions.reduce((sum, q) => sum + q.points, 0)} points
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onRegenerate}
              className="text-slate-600 hover:text-slate-900"
            >
              Regenerate All
            </Button>
            <Button
              onClick={onUseQuestions}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-sm shadow-purple-600/20"
            >
              Use These Questions
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default McqQuestionDisplay;