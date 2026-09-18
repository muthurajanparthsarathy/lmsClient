import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Loader2, Copy, CheckCircle, FileQuestion, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from 'react-toastify';
import McqQuestionDisplay from './McqQuestionDisplay';

interface GenerateQuestionProps {
    breadcrumbs: {
        name: string;
        type: string;
    }[];
    exerciseData: {
        exerciseId: string;
        exerciseName: string;
        exerciseLevel: string;
        selectedLanguages: string[];
        nodeId: string;
        nodeName: string;
        subcategory: string;
        nodeType: string;
        exerciseType: string;
        topic?: string;
    };
    onClose: () => void;
    onSave: (questions: any[]) => void;
}

interface McqQuestion {
    _id: string;
    title: string;
    description: string;
    difficulty: 'easy' | 'medium' | 'hard';
    points: number;
    options: {
        id: string;
        text: string;
        isCorrect: boolean;
    }[];
    explanation: string;
}

interface ApiError {
    message: string;
    details?: string;
}

// Gemini API Configuration
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_API_URL_FALLBACK = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

const GenerateQuestion: React.FC<GenerateQuestionProps> = ({
    breadcrumbs,
    exerciseData,
    onClose,
    onSave
}) => {
    const [loading, setLoading] = useState(false);
    const [generatedContent, setGeneratedContent] = useState<any>(null);
    const [generatedMcqQuestions, setGeneratedMcqQuestions] = useState<McqQuestion[]>([]);
    const [topicInput, setTopicInput] = useState('');
    const [numQuestions, setNumQuestions] = useState(1);
    const [generationType, setGenerationType] = useState<'single' | 'mcq'>('single');
    const [apiError, setApiError] = useState<ApiError | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        console.log('🔧 GenerateQuestion Props:', exerciseData);
        const isMcq = exerciseData.exerciseType?.toUpperCase() === 'MCQ';
        setGenerationType(isMcq ? 'mcq' : 'single');
        if (isMcq) {
            setNumQuestions(5);
        }
    }, [exerciseData]);

    const callGeminiAI = async (prompt: string): Promise<string> => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();
        setApiError(null);

        try {
            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 1,
                        topP: 0.95,
                        maxOutputTokens: 4096,
                    },
                    safetySettings: [
                        {
                            category: "HARM_CATEGORY_HARASSMENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_HATE_SPEECH",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        }
                    ]
                }),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) {
                console.log('Trying fallback API...');
                return await callGeminiAIFallback(prompt);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) {
                throw new Error("No response generated from AI");
            }

            return text;

        } catch (error: any) {
            if (error.name === 'AbortError') {
                return "Request was cancelled.";
            }

            setApiError({
                message: "Failed to connect to AI service",
                details: error.message
            });

            return await callGeminiAIFallback(prompt);
        }
    };

    const callGeminiAIFallback = async (prompt: string): Promise<string> => {
        try {
            const response = await fetch(GEMINI_API_URL_FALLBACK, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 1,
                        topP: 0.95,
                        maxOutputTokens: 2048,
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Fallback API error:', errorText);
                throw new Error(`Fallback API failed: ${response.status}`);
            }

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";

        } catch (error: any) {
            setApiError({
                message: "Both AI services failed",
                details: error.message
            });
            throw error;
        }
    };

    const parseAIResponse = (response: string): any => {
        try {
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
                response.match(/{[\s\S]*}/);

            if (jsonMatch) {
                const jsonString = jsonMatch[1] || jsonMatch[0];
                return JSON.parse(jsonString);
            }

            return { text: response };
        } catch (error) {
            console.error('Failed to parse AI response:', error);
            return { text: response };
        }
    };

    const generateSingleQuestion = async () => {
        const prompt = `Generate a programming question with the following details:

Topic: ${topicInput}
Exercise Name: ${exerciseData.exerciseName}
Difficulty Level: ${exerciseData.exerciseLevel}
Programming Languages: ${exerciseData.selectedLanguages.join(', ') || 'Any'}
Exercise Type: Programming Question
Node Type: ${exerciseData.nodeType}
Subcategory: ${exerciseData.subcategory}

Please generate a complete programming question in JSON format with the following structure:
{
  "title": "Question title",
  "description": "Detailed question description",
  "difficulty": "${exerciseData.exerciseLevel.toLowerCase()}",
  "points": ${exerciseData.exerciseLevel === 'beginner' ? 10 : exerciseData.exerciseLevel === 'intermediate' ? 20 : 30},
  "sampleInput": "Sample input",
  "sampleOutput": "Expected output",
  "constraints": ["Constraint 1", "Constraint 2"],
  "timeLimit": 2000,
  "solutions": {
    "startedCode": "// Starter code",
    "functionName": "solution",
    "language": "${exerciseData.selectedLanguages[0] || 'javascript'}"
  },
  "testCases": [
    {
      "input": "Test input 1",
      "expectedOutput": "Expected output 1"
    }
  ]
}

Make sure the question is relevant to the topic and appropriate for the difficulty level.`;

        try {
            const aiResponse = await callGeminiAI(prompt);
            const parsedResponse = parseAIResponse(aiResponse);

            if (parsedResponse.text) {
                toast.info('AI returned text response. Creating question from description.');
                const generatedQuestion = {
                    _id: `generated-${Date.now()}`,
                    title: `${topicInput} - Challenge`,
                    description: parsedResponse.text,
                    difficulty: exerciseData.exerciseLevel.toLowerCase(),
                    points: exerciseData.exerciseLevel === 'beginner' ? 10 :
                        exerciseData.exerciseLevel === 'intermediate' ? 20 : 30,
                    isActive: true,
                    sequence: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    sampleInput: 'See description',
                    sampleOutput: 'Expected output based on description',
                    constraints: ['Time limit: 2 seconds'],
                    timeLimit: 2000,
                    solutions: {
                        startedCode: `// Write your solution for: ${topicInput}\nfunction solution() {\n  // Your code here\n}`,
                        functionName: 'solution',
                        language: exerciseData.selectedLanguages?.[0] || 'javascript'
                    },
                    testCases: [
                        {
                            input: 'Test case input',
                            expectedOutput: 'Expected output'
                        }
                    ]
                };
                setGeneratedContent(generatedQuestion);
            } else {
                const generatedQuestion = {
                    _id: `generated-${Date.now()}`,
                    ...parsedResponse,
                    isActive: true,
                    sequence: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                setGeneratedContent(generatedQuestion);
            }

            toast.success('Question generated successfully!');

        } catch (error) {
            console.error('Error generating question:', error);
            toast.error('Failed to generate question');
        }
    };

const generateMcqQuestions = async () => {
    if (!topicInput.trim()) {
        toast.error('Please enter a topic for the questions');
        return;
    }

    // Format breadcrumbs for the prompt
    const breadcrumbsText = breadcrumbs
        .map(b => `${b.type}: ${b.name}`)
        .join(' → ');

    const prompt = `Generate exactly ${numQuestions} multiple choice questions about "${topicInput}".

LEARNING CONTEXT:
- Course: ${breadcrumbs.find(b => b.type === 'course')?.name || 'N/A'}
- Module: ${breadcrumbs.find(b => b.type === 'module')?.name || 'N/A'}
- Topic: ${breadcrumbs.find(b => b.type === 'topic')?.name || topicInput}
- Difficulty: ${exerciseData.exerciseLevel}
- Exercise Type: MCQ

IMPORTANT INSTRUCTIONS:
1. Generate EXACTLY ${numQuestions} questions - NO MORE, NO LESS
2. Each question must be UNIQUE and different
3. Each question must have 4 options (A, B, C, D) with exactly ONE correct answer
4. Return ONLY a valid JSON array, no additional text

OUTPUT FORMAT:
[
  {
    "title": "Question title",
    "description": "Specific question description",
    "difficulty": "easy/medium/hard",
    "points": 5,
    "options": [
      {"id": "a", "text": "Option A", "isCorrect": false},
      {"id": "b", "text": "Option B", "isCorrect": true},
      {"id": "c", "text": "Option C", "isCorrect": false},
      {"id": "d", "text": "Option D", "isCorrect": false}
    ],
    "explanation": "Explanation for correct answer"
  }
]

Now generate ${numQuestions} specific questions about "${topicInput}":`;

    try {
        setLoading(true);
        setGeneratedMcqQuestions([]);
        setApiError(null);
        
        console.log('📤 Sending prompt to AI for', numQuestions, 'questions...');
        const aiResponse = await callGeminiAI(prompt);
        console.log('📥 Raw AI Response (first 500 chars):', aiResponse.substring(0, 500));

        // Clean and parse the response
        let parsedQuestions: any[] = [];
        
        try {
            // First, try to extract JSON from the response
            let cleanResponse = aiResponse.trim();
            
            // Remove markdown code blocks
            cleanResponse = cleanResponse.replace(/```json\s*/gi, '');
            cleanResponse = cleanResponse.replace(/```\s*/gi, '');
            
            // Find JSON array boundaries
            const startIndex = cleanResponse.indexOf('[');
            const endIndex = cleanResponse.lastIndexOf(']');
            
            if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                const jsonString = cleanResponse.substring(startIndex, endIndex + 1);
                console.log('📦 Extracted JSON string:', jsonString.substring(0, 200) + '...');
                
                parsedQuestions = JSON.parse(jsonString);
                
                if (!Array.isArray(parsedQuestions)) {
                    console.warn('Parsed content is not an array, trying to wrap in array');
                    parsedQuestions = [parsedQuestions];
                }
            } else {
                // If no JSON found, try to parse the whole response
                parsedQuestions = JSON.parse(cleanResponse);
                if (!Array.isArray(parsedQuestions)) {
                    parsedQuestions = [parsedQuestions];
                }
            }
        } catch (parseError) {
            console.error('JSON parsing failed:', parseError);
            // If parsing fails, return empty array - we'll create questions manually
            parsedQuestions = [];
        }

        console.log('✅ Parsed questions count:', parsedQuestions.length);

        let finalQuestions: McqQuestion[] = [];

        if (parsedQuestions.length > 0) {
            // Use parsed questions from AI
            finalQuestions = parsedQuestions.slice(0, numQuestions).map((q, index) => {
                // Validate and format options
                const options = Array.isArray(q.options) && q.options.length >= 4
                    ? q.options.slice(0, 4).map((opt: any, optIndex: number) => ({
                        id: (opt.id || String.fromCharCode(97 + optIndex)).toLowerCase(),
                        text: (opt.text || `Option ${String.fromCharCode(65 + optIndex)}`).trim(),
                        isCorrect: Boolean(opt.isCorrect)
                    }))
                    : [
                        { id: 'a', text: 'Option A', isCorrect: false },
                        { id: 'b', text: 'Option B', isCorrect: true },
                        { id: 'c', text: 'Option C', isCorrect: false },
                        { id: 'd', text: 'Option D', isCorrect: false }
                    ];

                // Ensure exactly one correct answer
                const correctCount = options.filter(opt => opt.isCorrect).length;
                if (correctCount !== 1) {
                    options.forEach((opt, idx) => {
                        opt.isCorrect = idx === 1; // Set option B as correct by default
                    });
                }

                return {
                    _id: `mcq-ai-${Date.now()}-${index}`,
                    title: (q.title || `${topicInput} - Question ${index + 1}`).trim(),
                    description: (q.description || `Question ${index + 1} about ${topicInput}`).trim(),
                    difficulty: (['easy', 'medium', 'hard'].includes(q.difficulty?.toLowerCase()) 
                        ? q.difficulty.toLowerCase() 
                        : exerciseData.exerciseLevel.toLowerCase()) as 'easy' | 'medium' | 'hard',
                    points: typeof q.points === 'number' && q.points > 0 
                        ? q.points 
                        : exerciseData.exerciseLevel === 'beginner' ? 5 :
                          exerciseData.exerciseLevel === 'intermediate' ? 10 : 15,
                    options: options,
                    explanation: (q.explanation || `Explanation for question ${index + 1}`).trim()
                };
            });
            
            console.log('🎯 AI Generated questions count:', finalQuestions.length);
        }

        // If we don't have enough questions from AI, create the remaining ones
        if (finalQuestions.length < numQuestions) {
            console.log(`Creating ${numQuestions - finalQuestions.length} additional template questions`);
            
            const additionalQuestions: McqQuestion[] = [];
            const questionStartIndex = finalQuestions.length;
            
            for (let i = 0; i < numQuestions - finalQuestions.length; i++) {
                const questionIndex = questionStartIndex + i + 1;
                const questionTypes = [
                    `What is the correct syntax for ${topicInput}?`,
                    `Which of the following best describes ${topicInput}?`,
                    `What is the primary purpose of ${topicInput}?`,
                    `How does ${topicInput} differ from similar concepts?`,
                    `What is a common use case for ${topicInput}?`,
                    `Which statement about ${topicInput} is accurate?`,
                    `What is a key characteristic of ${topicInput}?`,
                    `How should ${topicInput} be properly implemented?`
                ];
                
                const description = questionTypes[i % questionTypes.length];
                
                additionalQuestions.push({
                    _id: `mcq-template-${Date.now()}-${i}`,
                    title: `${topicInput} - Question ${questionIndex}`,
                    description: description,
                    difficulty: exerciseData.exerciseLevel.toLowerCase() as 'easy' | 'medium' | 'hard',
                    points: exerciseData.exerciseLevel === 'beginner' ? 5 :
                           exerciseData.exerciseLevel === 'intermediate' ? 10 : 15,
                    options: [
                        { id: 'a', text: 'Correct answer option', isCorrect: true },
                        { id: 'b', text: 'Plausible but incorrect option', isCorrect: false },
                        { id: 'c', text: 'Another incorrect option', isCorrect: false },
                        { id: 'd', text: 'Common misconception option', isCorrect: false }
                    ],
                    explanation: `Detailed explanation for the correct answer to: "${description}"`
                });
            }
            
            finalQuestions = [...finalQuestions, ...additionalQuestions];
        }

        // Ensure we have exactly numQuestions
        finalQuestions = finalQuestions.slice(0, numQuestions);
        
        console.log('📊 Final questions to display:', finalQuestions.length);
        console.log('First question:', finalQuestions[0]?.description);
        console.log('Second question:', finalQuestions[1]?.description);

        setGeneratedMcqQuestions(finalQuestions);
        
        if (finalQuestions.length === numQuestions) {
            toast.success(`Generated ${finalQuestions.length} MCQ questions!`);
        } else {
            toast.info(`Generated ${finalQuestions.length} questions (requested ${numQuestions})`);
        }

    } catch (error: any) {
        console.error('❌ Error generating MCQ questions:', error);
        
        // Create only numQuestions on error
        const errorQuestions: McqQuestion[] = Array.from({ length: numQuestions }, (_, index) => ({
            _id: `mcq-error-${Date.now()}-${index}`,
            title: `${topicInput} - Question ${index + 1}`,
            description: `Create a question about ${topicInput}`,
            difficulty: 'medium' as const,
            points: 10,
            options: [
                { id: 'a', text: 'Edit this to be correct', isCorrect: true },
                { id: 'b', text: 'Edit this option', isCorrect: false },
                { id: 'c', text: 'Edit this option', isCorrect: false },
                { id: 'd', text: 'Edit this option', isCorrect: false }
            ],
            explanation: 'Please provide an explanation for the correct answer.'
        }));
        
        setGeneratedMcqQuestions(errorQuestions);
        toast.error('AI generation failed. Created editable questions.');
        
    } finally {
        setLoading(false);
    }
};

    const handleGenerate = async () => {
        if (!topicInput.trim()) {
            toast.error('Please enter a topic for the questions');
            return;
        }

        if (numQuestions > 10) {
            toast.warning('For optimal performance, please generate 10 or fewer questions at once');
            return;
        }

        setLoading(true);
        setGeneratedContent(null);
        setGeneratedMcqQuestions([]);
        setApiError(null);

        try {
            if (generationType === 'single') {
                await generateSingleQuestion();
            } else {
                await generateMcqQuestions();
            }

        } catch (error) {
            console.error('Error in handleGenerate:', error);
            toast.error('Failed to generate. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyToClipboard = () => {
        if (generationType === 'single' && generatedContent) {
            const textToCopy = `
Title: ${generatedContent.title}
Description: ${generatedContent.description}
Difficulty: ${generatedContent.difficulty}
Points: ${generatedContent.points}
Sample Input: ${generatedContent.sampleInput}
Sample Output: ${generatedContent.sampleOutput}
Constraints: ${generatedContent.constraints?.join(', ')}
      `.trim();

            navigator.clipboard.writeText(textToCopy);
            toast.success('Copied to clipboard!');
        }
    };

    const handleUseQuestions = () => {
        if (generationType === 'single' && generatedContent) {
            const fullQuestion = {
                ...generatedContent,
                metadata: {
                    nodeType: exerciseData.nodeType,
                    nodeId: exerciseData.nodeId,
                    exerciseId: exerciseData.exerciseId,
                    generatedFrom: topicInput,
                    timestamp: new Date().toISOString(),
                    aiGenerated: true
                }
            };
            onSave([fullQuestion]);
        } else if (generationType === 'mcq' && generatedMcqQuestions.length > 0) {
            const questionsWithMetadata = generatedMcqQuestions.map(q => ({
                ...q,
                metadata: {
                    nodeType: exerciseData.nodeType,
                    nodeId: exerciseData.nodeId,
                    exerciseId: exerciseData.exerciseId,
                    generatedFrom: topicInput,
                    isMcq: true,
                    aiGenerated: true,
                    timestamp: new Date().toISOString()
                }
            }));
            onSave(questionsWithMetadata);
        }
        onClose();
    };

    const handleRegenerate = () => {
        setGeneratedContent(null);
        setGeneratedMcqQuestions([]);
        setApiError(null);
    };

    const isMcqMode = generationType === 'mcq';
    const hasGeneratedContent = generatedContent || generatedMcqQuestions.length > 0;

    return (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl border border-slate-200 max-h-[90vh] overflow-hidden">

                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 rounded-lg">
                            <Sparkles className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900">Generate {isMcqMode ? 'MCQ Questions' : 'Question'} with AI</h3>
                            <p className="text-sm text-slate-500">
                                Powered by Gemini AI
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Modal Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {apiError && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                {apiError.message}
                                {apiError.details && (
                                    <span className="block text-xs mt-1 opacity-75">{apiError.details}</span>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    {!hasGeneratedContent ? (
                        <div className="space-y-6">
                            <div className="space-y-4">
                                {/* Generation Type Indicator */}
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
                                    {isMcqMode ? (
                                        <>
                                            <FileQuestion className="h-4 w-4 text-blue-600" />
                                            <span className="text-sm font-medium text-blue-700">MCQ Mode</span>
                                            <Badge variant="secondary" className="ml-1 text-xs">
                                                {exerciseData.exerciseType}
                                            </Badge>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-4 w-4 text-purple-600" />
                                            <span className="text-sm font-medium text-purple-700">Programming Question</span>
                                        </>
                                    )}
                                </div>

                                {/* Topic Input */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-700">
                                        Topic / Concept
                                        <span className="text-red-500 ml-1">*</span>
                                    </Label>
                                    <Textarea
                                        value={topicInput}
                                        onChange={(e) => setTopicInput(e.target.value)}
                                        placeholder={isMcqMode
                                            ? "e.g., Data Structures, Algorithms, Web Development, Database Concepts..."
                                            : "e.g., Binary Search, React Hooks, SQL Joins, Array Manipulation..."
                                        }
                                        className="min-h-[100px] resize-none"
                                        disabled={loading}
                                    />
                                    <p className="text-xs text-slate-500">
                                        {isMcqMode
                                            ? 'Describe the subject or topic for multiple choice questions'
                                            : 'Describe the programming concept or algorithm for the question'
                                        }
                                    </p>
                                </div>

                                {/* Number of Questions (for MCQ) */}
                                {isMcqMode && (
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium text-slate-700">
                                            Number of Questions
                                        </Label>
                                        <div className="flex items-center gap-3">
                                            <Input
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={numQuestions}
                                                onChange={(e) => setNumQuestions(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                                                className="w-24"
                                                disabled={loading}
                                            />
                                            <div className="flex-1">
                                                <p className="text-xs text-slate-500">
                                                    Generate {numQuestions} question{numQuestions > 1 ? 's' : ''} with 4 options each
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Context Information */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="space-y-1">
                                        <span className="text-xs text-slate-500">Exercise</span>
                                        <p className="text-sm font-medium text-slate-900 truncate">{exerciseData.exerciseName}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-xs text-slate-500">Level</span>
                                        <p className="text-sm font-medium text-slate-900 capitalize">{exerciseData.exerciseLevel}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-xs text-slate-500">Type</span>
                                        <p className="text-sm font-medium text-slate-900">{isMcqMode ? 'MCQ' : 'Programming'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-xs text-slate-500">Topic</span>
                                        <p className="text-sm font-medium text-slate-900 truncate">{exerciseData.nodeName || 'General'}</p>
                                    </div>
                                </div>

                                {/* AI Disclaimer */}
                                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <p className="text-xs text-blue-700">
                                        <strong>Note:</strong> This feature uses Gemini AI to generate questions.
                                        Generated content should be reviewed and may require editing for accuracy and context appropriateness.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                <Button
                                    variant="outline"
                                    onClick={onClose}
                                    disabled={loading}
                                    className="text-slate-600 hover:text-slate-900"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleGenerate}
                                    disabled={loading || !topicInput.trim()}
                                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-sm shadow-purple-600/20"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            {isMcqMode ? `Generating ${numQuestions} questions...` : 'Generating with AI...'}
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="mr-2 h-4 w-4" />
                                            {isMcqMode ? `Generate ${numQuestions} Questions` : 'Generate with AI'}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        /* Generated Content Section */
                        <div className="space-y-6">
                            {isMcqMode ? (
                                <McqQuestionDisplay
                                    questions={generatedMcqQuestions}
                                    onRegenerate={handleRegenerate}
                                    onUseQuestions={handleUseQuestions}
                                />
                            ) : (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="h-5 w-5 text-emerald-500" />
                                                <span className="text-sm font-medium text-emerald-600">AI Generated Question</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                                    Gemini AI
                                                </Badge>
                                                <Badge variant="outline" className="text-xs">
                                                    Review Required
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-sm font-semibold text-slate-900 mb-2">Generated Question:</h4>
                                                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-3">
                                                    <div>
                                                        <span className="text-xs font-medium text-slate-500">Title</span>
                                                        <p className="text-sm font-medium text-slate-900">{generatedContent.title}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-medium text-slate-500">Description</span>
                                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{generatedContent.description}</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <span className="text-xs font-medium text-slate-500">Difficulty</span>
                                                            <p className="text-sm font-medium text-slate-900 capitalize">{generatedContent.difficulty}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-medium text-slate-500">Points</span>
                                                            <p className="text-sm font-medium text-slate-900">{generatedContent.points} pts</p>
                                                        </div>
                                                    </div>
                                                    {generatedContent.sampleInput && (
                                                        <div>
                                                            <span className="text-xs font-medium text-slate-500">Sample Input</span>
                                                            <pre className="text-xs bg-slate-100 p-2 rounded mt-1 font-mono text-slate-700 whitespace-pre-wrap">
                                                                {generatedContent.sampleInput}
                                                            </pre>
                                                        </div>
                                                    )}
                                                    {generatedContent.sampleOutput && (
                                                        <div>
                                                            <span className="text-xs font-medium text-slate-500">Sample Output</span>
                                                            <pre className="text-xs bg-slate-100 p-2 rounded mt-1 font-mono text-slate-700 whitespace-pre-wrap">
                                                                {generatedContent.sampleOutput}
                                                            </pre>
                                                        </div>
                                                    )}
                                                    {generatedContent.constraints && generatedContent.constraints.length > 0 && (
                                                        <div>
                                                            <span className="text-xs font-medium text-slate-500">Constraints</span>
                                                            <ul className="text-xs text-slate-700 mt-1 list-disc list-inside">
                                                                {generatedContent.constraints.map((constraint: string, index: number) => (
                                                                    <li key={index}>{constraint}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                                            <p className="text-xs text-amber-700">
                                                <strong>Review Note:</strong> This question was generated by AI. Please review for:
                                            </p>
                                            <ul className="text-xs text-amber-700 mt-1 list-disc list-inside">
                                                <li>Technical accuracy</li>
                                                <li>Clarity and completeness</li>
                                                <li>Appropriate difficulty level</li>
                                                <li>Test case correctness</li>
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                onClick={handleCopyToClipboard}
                                                className="text-slate-600 hover:text-slate-900"
                                            >
                                                <Copy className="mr-2 h-4 w-4" />
                                                Copy
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={handleRegenerate}
                                                className="text-slate-600 hover:text-slate-900"
                                            >
                                                <Sparkles className="mr-2 h-4 w-4" />
                                                Regenerate
                                            </Button>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Button
                                                variant="outline"
                                                onClick={onClose}
                                                className="text-slate-600 hover:text-slate-900"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={handleUseQuestions}
                                                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-sm shadow-purple-600/20"
                                            >
                                                Use This Question
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GenerateQuestion;