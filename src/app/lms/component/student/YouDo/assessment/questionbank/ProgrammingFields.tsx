import React, { useState } from 'react';
import { Plus, Trash2, Code, Info, Clock, Cpu, Eye, EyeOff, FileText, CheckSquare, Square } from 'lucide-react';
import { Hint, TestCase, Solution } from '../../../../apiServices/type/question';

interface ProgrammingFieldsProps {
  data: {
    title: string;
    description: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    sampleInput: string;
    sampleOutput: string;
    score: number;
    constraints: string[];
    hints: Hint[];
    testCases: TestCase[];
    solutions?: Solution;
    timeLimit?: number;
    memoryLimit?: number;
  };
  onChange: (field: string, value: any) => void;
}

const ProgrammingFields: React.FC<ProgrammingFieldsProps> = ({
  data,
  onChange,
}) => {
  const [newConstraint, setNewConstraint] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('basic');

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Constraints Management
  const handleAddConstraint = () => {
    if (newConstraint.trim()) {
      onChange('constraints', [...(data.constraints || []), newConstraint.trim()]);
      setNewConstraint('');
    }
  };

  const handleRemoveConstraint = (index: number) => {
    const updated = [...(data.constraints || [])];
    updated.splice(index, 1);
    onChange('constraints', updated);
  };

  // Hints Management
  const handleAddHint = () => {
    const hintText = prompt('Enter hint text:');
    if (hintText?.trim()) {
      const newHint: Hint = {
        hintText: hintText.trim(),
        pointsDeduction: 0,
        isPublic: false,
        sequence: (data.hints?.length || 0) + 1,
      };
      onChange('hints', [...(data.hints || []), newHint]);
    }
  };

  const handleRemoveHint = (index: number) => {
    const updated = [...(data.hints || [])];
    updated.splice(index, 1);
    onChange('hints', updated);
  };

  // Test Cases Management
  const handleTestCaseChange = (index: number, field: keyof TestCase, value: any) => {
    const updated = [...(data.testCases || [])];
    updated[index] = { ...updated[index], [field]: value };
    onChange('testCases', updated);
  };

  const handleAddTestCase = () => {
    onChange('testCases', [
      ...(data.testCases || []),
      {
        input: '',
        expectedOutput: '',
        isSample: false,
        isHidden: false,
        points: 10,
        explanation: '',
      },
    ]);
  };

  const handleRemoveTestCase = (index: number) => {
    const updated = [...(data.testCases || [])];
    updated.splice(index, 1);
    onChange('testCases', updated);
  };

  return (
    <div className="space-y-4">
      {/* Basic Information - Always Expanded */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={data.title || ''}
              onChange={(e) => onChange('title', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Difficulty *
            </label>
            <select
              value={data.difficulty || 'Medium'}
              onChange={(e) => onChange('difficulty', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              required
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Score
            </label>
            <input
              type="number"
              value={data.score || 0}
              onChange={(e) => onChange('score', parseInt(e.target.value) || 0)}
              min="0"
              max="100"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description *
          </label>
          <textarea
            value={data.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            rows={3}
            required
          />
        </div>
      </div>

      {/* Sample Input/Output */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => toggleSection('sample')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center">
            <FileText size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sample Input/Output</span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">{expandedSection === 'sample' ? '▼' : '▶'}</span>
        </button>
        
        {expandedSection === 'sample' && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sample Input *
                </label>
                <textarea
                  value={data.sampleInput || ''}
                  onChange={(e) => onChange('sampleInput', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                  rows={2}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sample Output *
                </label>
                <textarea
                  value={data.sampleOutput || ''}
                  onChange={(e) => onChange('sampleOutput', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                  rows={2}
                  required
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Constraints */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => toggleSection('constraints')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center">
            <Square size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Constraints ({data.constraints?.length || 0})
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">{expandedSection === 'constraints' ? '▼' : '▶'}</span>
        </button>
        
        {expandedSection === 'constraints' && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-2">
              {data.constraints?.map((constraint, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <span className="text-gray-500 dark:text-gray-400 text-xs">•</span>
                  <input
                    type="text"
                    value={constraint}
                    onChange={(e) => {
                      const updated = [...(data.constraints || [])];
                      updated[index] = e.target.value;
                      onChange('constraints', updated);
                    }}
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveConstraint(index)}
                    className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              
              <div className="flex items-center space-x-2 pt-2">
                <span className="text-gray-500 dark:text-gray-400 text-xs">•</span>
                <input
                  type="text"
                  value={newConstraint}
                  onChange={(e) => setNewConstraint(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddConstraint()}
                  placeholder="Add new constraint..."
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <button
                  type="button"
                  onClick={handleAddConstraint}
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Limits */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => toggleSection('limits')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center">
            <Cpu size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Limits</span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">{expandedSection === 'limits' ? '▼' : '▶'}</span>
        </button>
        
        {expandedSection === 'limits' && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Clock size={14} className="inline mr-1" />
                  Time Limit (ms)
                </label>
                <input
                  type="number"
                  value={data.timeLimit || ''}
                  onChange={(e) => onChange('timeLimit', parseInt(e.target.value) || undefined)}
                  min="0"
                  placeholder="1000"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Cpu size={14} className="inline mr-1" />
                  Memory Limit (MB)
                </label>
                <input
                  type="number"
                  value={data.memoryLimit || ''}
                  onChange={(e) => onChange('memoryLimit', parseInt(e.target.value) || undefined)}
                  min="0"
                  placeholder="256"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hints */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <div className="flex items-center">
            <Info size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Hints ({data.hints?.length || 0})
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleAddHint}
              className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-800/40 transition-colors"
            >
              <Plus size={14} className="inline mr-1" />
              Add Hint
            </button>
            <button
              type="button"
              onClick={() => toggleSection('hints')}
              className="text-xs text-gray-500 dark:text-gray-400"
            >
              {expandedSection === 'hints' ? '▼' : '▶'}
            </button>
          </div>
        </div>
        
        {expandedSection === 'hints' && data.hints && data.hints.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-3">
              {data.hints.map((hint, index) => (
                <div key={index} className="p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Hint #{hint.sequence}</span>
                      {hint.isPublic && (
                        <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">Public</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveHint(index)}
                      className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                      title="Remove hint"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{hint.hintText}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Points: -{hint.pointsDeduction}</span>
                    <label className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={hint.isPublic}
                        onChange={(e) => {
                          const updated = [...(data.hints || [])];
                          updated[index].isPublic = e.target.checked;
                          onChange('hints', updated);
                        }}
                        className="h-3 w-3 text-blue-600 dark:text-blue-400 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                      />
                      <span className="text-gray-600 dark:text-gray-400">Public</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Test Cases */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <div className="flex items-center">
            <Code size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Test Cases ({data.testCases?.length || 0})
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleAddTestCase}
              className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors"
            >
              <Plus size={14} className="inline mr-1" />
              Add Test Case
            </button>
            <button
              type="button"
              onClick={() => toggleSection('testcases')}
              className="text-xs text-gray-500 dark:text-gray-400"
            >
              {expandedSection === 'testcases' ? '▼' : '▶'}
            </button>
          </div>
        </div>
        
        {expandedSection === 'testcases' && data.testCases && data.testCases.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-3">
              {data.testCases.map((testCase, index) => (
                <div key={index} className="p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Test #{index + 1}</span>
                      <div className="flex items-center space-x-3">
                        <label className="flex items-center space-x-1 text-xs">
                          <input
                            type="checkbox"
                            checked={testCase.isSample}
                            onChange={(e) =>
                              handleTestCaseChange(index, 'isSample', e.target.checked)
                            }
                            className="h-3 w-3 text-blue-600 dark:text-blue-400 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                          />
                          <span className="text-gray-600 dark:text-gray-400">Sample</span>
                        </label>
                        <label className="flex items-center space-x-1 text-xs">
                          <input
                            type="checkbox"
                            checked={testCase.isHidden}
                            onChange={(e) =>
                              handleTestCaseChange(index, 'isHidden', e.target.checked)
                            }
                            className="h-3 w-3 text-blue-600 dark:text-blue-400 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                          />
                          <span className="text-gray-600 dark:text-gray-400">Hidden</span>
                        </label>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTestCase(index)}
                      className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                      title="Remove test case"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Input
                      </label>
                      <textarea
                        value={testCase.input}
                        onChange={(e) =>
                          handleTestCaseChange(index, 'input', e.target.value)
                        }
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        rows={2}
                        placeholder="Input..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Expected Output
                      </label>
                      <textarea
                        value={testCase.expectedOutput}
                        onChange={(e) =>
                          handleTestCaseChange(index, 'expectedOutput', e.target.value)
                        }
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        rows={2}
                        placeholder="Expected output..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Points
                      </label>
                      <input
                        type="number"
                        value={testCase.points}
                        onChange={(e) =>
                          handleTestCaseChange(index, 'points', parseInt(e.target.value) || 0)
                        }
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Explanation
                      </label>
                      <input
                        type="text"
                        value={testCase.explanation || ''}
                        onChange={(e) =>
                          handleTestCaseChange(index, 'explanation', e.target.value)
                        }
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                        placeholder="Optional..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Solution Template */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => toggleSection('solution')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center">
            <Code size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Solution Template</span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">{expandedSection === 'solution' ? '▼' : '▶'}</span>
        </button>
        
        {expandedSection === 'solution' && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Function Name
                  </label>
                  <input
                    type="text"
                    value={data.solutions?.functionName || ''}
                    onChange={(e) =>
                      onChange('solutions', {
                        ...data.solutions,
                        functionName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="solveProblem"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Language
                  </label>
                  <select
                    value={data.solutions?.language || 'javascript'}
                    onChange={(e) =>
                      onChange('solutions', {
                        ...data.solutions,
                        language: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                    <option value="c">C</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Starter Code
                </label>
                <textarea
                  value={data.solutions?.startedCode || ''}
                  onChange={(e) =>
                    onChange('solutions', {
                      ...data.solutions,
                      startedCode: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono placeholder-gray-400 dark:placeholder-gray-500"
                  rows={5}
                  placeholder="Enter starter code..."
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgrammingFields;