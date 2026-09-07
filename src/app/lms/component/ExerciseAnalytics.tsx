"use client";

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Search,
  Code,
  Check,
  X,
  RefreshCw,
  Eye,
  FileCode,
  Users,
  BarChart,
  Hash,
  Award,
  ArrowLeft,
  Download,
  Copy,
  ChevronLeft,
  ChevronRight,
  Save,
  Clock,
  Terminal,
  CheckCircle,
  XCircle,
  Calculator,
  FileText,
  ExternalLink,
  Filter,
  User,
  Mail,
  Calendar,
  FileOutput,
  Hash as HashIcon,
  Clock as ClockIcon,
  Cpu,
  MoreVertical,
  Edit,
  Trash2,
  Play,
  CheckSquare,
  Square,
  AlertCircle,
  Zap,
  Percent,
  Info,
  Home,
  Folder,
  BookOpen,
  Layers,
  FolderTree
} from "lucide-react";
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExerciseQuestion {
  _id: string;
  title: string;
  description: string;
  points: number;
  timeLimit: number;
  memoryLimit: number;
  difficulty: string;
  sampleInput: string;
  sampleOutput: string;
  constraints?: string[];
  hints?: Array<{
    hintText: string;
    pointsDeduction: number;
    isPublic: boolean;
    sequence: number;
  }>;
  testCases?: Array<{
    input: string;
    expectedOutput: string;
    isSample: boolean;
    isHidden: boolean;
    points: number;
    explanation?: string;
  }>;
  solutions?: {
    startedCode: string;
    functionName: string;
    language: string;
  };
}

interface Exercise {
  _id: string;
  exerciseInformation: {
    exerciseId: string;
    exerciseName: string;
    description: string;
    exerciseLevel: 'beginner' | 'intermediate' | 'advanced';
    totalPoints: number;
    totalQuestions: number;
    estimatedTime: number;
  };
  programmingSettings: {
    selectedModule: string;
    selectedLanguages: string[];
    levelConfiguration: {
      levelType: 'levelBased' | 'general';
      levelBased?: {
        easy: number;
        medium: number;
        hard: number;
      };
      general?: number;
    };
  };
  questions: ExerciseQuestion[];
  createdAt: string;
}

interface SubmissionQuestion {
  _id: string;
  questionId: string;
  codeAnswer: string;
  language: string;
  isCorrect: boolean;
  score: number;
  status: 'attempted' | 'evaluated' | 'pending';
  attempts: number;
  submittedAt: string;
}

interface ExerciseAnswer {
  _id: string;
  exerciseId: string;
  questions: SubmissionQuestion[];
  nodeId: string;
  nodeName: string;
  nodeType: string;
  subcategory: string;
  createdAt: string;
}

interface UserCourse {
  courseId: string;
  answers?: {
    We_Do?: {
      practical?: ExerciseAnswer[];
      project_development?: any[];
    };
  };
  lastAccessed: string;
  _id: string;
  createdAt: string;
  updatedAt: string;
}

interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  profile: string;
  role: {
    renameRole: string;
  };
  department?: string;
  courses?: UserCourse[];
  permissions?: any[];
}

interface Participant {
  _id: string;
  user: User;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface CourseModule {
  _id: string;
  title: string;
  subModules: Array<{
    _id: string;
    title: string;
    topics: Array<{
      _id: string;
      title: string;
      pedagogy?: {
        We_Do?: {
          practical?: Exercise[];
        };
      };
    }>;
  }>;
}

interface CourseData {
  _id: string;
  courseName: string;
  modules: CourseModule[];
  batchAndParticipants: Array<{
    _id?: string;
    batchName?: string;
    users?: Participant[];
  }>;
}

interface BreadcrumbItem {
  title: string;
  icon: React.ReactNode;
  type: 'course' | 'module' | 'submodule' | 'topic' | 'exercise' | 'analytics';
}

export default function ExerciseAnalytics() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [courseId] = useState('694389557b0e5589298055ca');
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [search, setSearch] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<ExerciseAnswer | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<ExerciseQuestion | null>(null);
  const [submissionQuestion, setSubmissionQuestion] = useState<SubmissionQuestion | null>(null);
  const [score, setScore] = useState(0);
  const [maxScore, setMaxScore] = useState(10);
  const [viewMode, setViewMode] = useState<'list' | 'details'>('list');
  const [isSaving, setIsSaving] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf' | 'excel'>('csv');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [modalQuestion, setModalQuestion] = useState<ExerciseQuestion | null>(null);
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);

  const exerciseId = searchParams.get('exerciseId');
  const nodeId = searchParams.get('nodeId');
  const nodeType = searchParams.get('nodeType');

  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    }
  }, [courseId]);

  useEffect(() => {
    if (exerciseId && exercises.length > 0) {
      const exercise = exercises.find(ex => ex._id === exerciseId);
      if (exercise) {
        setSelectedExercise(exercise);
        buildBreadcrumb(exercise);
      }
    }
  }, [exerciseId, exercises, courseData]);

  const fetchCourseData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5533/getAll/courses-data/${courseId}`);
      const result = await response.json();

      if (result.success && result.data) {
        setCourseData(result.data);
        setParticipants(
          (result.data.batchAndParticipants || []).flatMap((b: any) => b?.users || [])
        );

        const allExercises: Exercise[] = [];
        if (result.data.modules) {
          result.data.modules.forEach((module: CourseModule) => {
            module.subModules?.forEach((subModule) => {
              subModule.topics?.forEach((topic) => {
                if (topic.pedagogy?.We_Do?.practical) {
                  allExercises.push(...topic.pedagogy.We_Do.practical);
                }
              });
            });
          });
        }
        setExercises(allExercises);

        if (exerciseId) {
          const exercise = allExercises.find(ex => ex._id === exerciseId);
          if (exercise) {
            setSelectedExercise(exercise);
            buildBreadcrumb(exercise);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching course data:', err);
      toast.error('Failed to load course data');
    } finally {
      setLoading(false);
    }
  };

  const buildBreadcrumb = (exercise: Exercise) => {
    if (!courseData || !exercise) return;

    const breadcrumbItems: BreadcrumbItem[] = [];

    // Add course level
    breadcrumbItems.push({
      title: courseData.courseName || 'Course',
      icon: <Home className="h-3 w-3" />,
      type: 'course'
    });

    // Try to find the exercise in the course hierarchy
    let found = false;

    for (const module of courseData.modules || []) {
      for (const subModule of module.subModules || []) {
        for (const topic of subModule.topics || []) {
          if (topic.pedagogy?.We_Do?.practical?.some(ex => ex._id === exercise._id)) {
            // Found the exercise, build breadcrumb hierarchy
            breadcrumbItems.push({
              title: module.title || 'Module',
              icon: <Layers className="h-3 w-3" />,
              type: 'module'
            });

            breadcrumbItems.push({
              title: subModule.title || 'Submodule',
              icon: <Folder className="h-3 w-3" />,
              type: 'submodule'
            });

            breadcrumbItems.push({
              title: topic.title || 'Topic',
              icon: <BookOpen className="h-3 w-3" />,
              type: 'topic'
            });

            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (found) break;
    }

    // If exercise not found in hierarchy, just add it directly
    if (!found) {
      breadcrumbItems.push({
        title: 'Exercises',
        icon: <FileCode className="h-3 w-3" />,
        type: 'exercise'
      });
    }

    // Add the exercise itself
    breadcrumbItems.push({
      title: exercise.exerciseInformation.exerciseName,
      icon: <FileCode className="h-3 w-3" />,
      type: 'exercise'
    });

    // Add analytics as current page
    breadcrumbItems.push({
      title: 'Analytics',
      icon: <BarChart className="h-3 w-3" />,
      type: 'analytics'
    });

    setBreadcrumb(breadcrumbItems);
  };

  const getExerciseAnswers = (participant: Participant): ExerciseAnswer[] => {
    if (participant.user.courses && participant.user.courses.length > 0) {
      const course = participant.user.courses.find(c => c.courseId === courseId);
      if (course?.answers?.We_Do?.practical) {
        return course.answers.We_Do.practical;
      }
    }
    return [];
  };

  const getExerciseAnswersForSelectedExercise = (participant: Participant): ExerciseAnswer[] => {
    const allAnswers = getExerciseAnswers(participant);
    if (selectedExercise) {
      return allAnswers.filter(answer => answer.exerciseId === selectedExercise._id);
    }
    return allAnswers;
  };

  const findQuestionById = (questionId: string): ExerciseQuestion | null => {
    if (!selectedExercise) return null;
    return selectedExercise.questions.find(q => q._id === questionId) || null;
  };

  // Calculate participants with submissions for each exercise
  const calculateParticipantsWithSubmissions = (): Map<string, number> => {
    const map = new Map<string, number>();
    
    exercises.forEach(exercise => {
      let count = 0;
      participants.forEach(participant => {
        const answers = getExerciseAnswers(participant);
        const hasSubmission = answers.some(answer => answer.exerciseId === exercise._id);
        if (hasSubmission) count++;
      });
      map.set(exercise._id, count);
    });
    
    return map;
  };

  // Calculate average scores for each exercise
  const calculateAverageScores = (): Map<string, string> => {
    const map = new Map<string, string>();
    
    exercises.forEach(exercise => {
      let totalScore = 0;
      let submissionCount = 0;
      
      participants.forEach(participant => {
        const answers = getExerciseAnswers(participant);
        const exerciseAnswers = answers.filter(answer => answer.exerciseId === exercise._id);
        
        exerciseAnswers.forEach(answer => {
          const exerciseScore = answer.questions.reduce((sum, q) => sum + q.score, 0);
          if (exerciseScore > 0) {
            totalScore += exerciseScore;
            submissionCount++;
          }
        });
      });
      
      const avgScore = submissionCount > 0 ? Math.round(totalScore / submissionCount) : 0;
      map.set(exercise._id, `${avgScore}/${exercise.exerciseInformation.totalPoints}`);
    });
    
    return map;
  };

  const filteredParticipants = participants.filter(p => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    const fullName = `${p.user.firstName} ${p.user.lastName}`.toLowerCase();
    const email = p.user.email.toLowerCase();

    return fullName.includes(searchLower) || email.includes(searchLower);
  });

  const getQuestionsAttemptedCount = (participant: Participant) => {
    const answers = getExerciseAnswersForSelectedExercise(participant);
    const attemptedQuestions = new Set();

    answers.forEach(answer => {
      answer.questions.forEach(submission => {
        if (submission.status === 'attempted' || submission.status === 'evaluated') {
          attemptedQuestions.add(submission.questionId);
        }
      });
    });

    return attemptedQuestions.size;
  };

  const isQuestionAttempted = (questionId: string, participant: Participant | null) => {
    if (!participant) return false;

    const answers = getExerciseAnswersForSelectedExercise(participant);
    return answers.some(answer =>
      answer.questions.some(q =>
        q.questionId === questionId && (q.status === 'attempted' || q.status === 'evaluated')
      )
    );
  };

  const getSubmissionForQuestion = (questionId: string) => {
    if (!selectedAnswer || !selectedParticipant) return null;

    for (const answer of getExerciseAnswersForSelectedExercise(selectedParticipant)) {
      const submission = answer.questions.find(q => q.questionId === questionId);
      if (submission) return submission;
    }
    return null;
  };

  const handleScoreUpdate = async () => {
    if (!selectedAnswer || !selectedQuestion || !selectedParticipant) return;

    setIsSaving(true);
    try {
      const updatedParticipants = [...participants];
      const participantIndex = updatedParticipants.findIndex(p => p._id === selectedParticipant._id);

      if (participantIndex !== -1) {
        const participant = updatedParticipants[participantIndex];
        const answers = getExerciseAnswers(participant);
        const answerIndex = answers.findIndex(a => a._id === selectedAnswer._id);

        if (answerIndex !== -1) {
          const answer = answers[answerIndex];
          const questionIndex = answer.questions.findIndex(
            q => q.questionId === submissionQuestion?.questionId
          );

          if (questionIndex !== -1) {
            answer.questions[questionIndex].score = score;
            answer.questions[questionIndex].isCorrect = score >= maxScore * 0.6;
            answer.questions[questionIndex].status = 'evaluated';

            setParticipants(updatedParticipants);

            toast.success('Score updated successfully');

            handleNextQuestion();
          }
        }
      }
    } catch (err) {
      console.error('Error updating score:', err);
      toast.error('Failed to update score');
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewSubmission = (participant: Participant, answer: ExerciseAnswer, submission: SubmissionQuestion) => {
    const question = findQuestionById(submission.questionId);
    if (question) {
      setSelectedParticipant(participant);
      setSelectedAnswer(answer);
      setSubmissionQuestion(submission);
      setSelectedQuestion(question);
      setScore(submission.score || 0);
      setMaxScore(question.points);
      setViewMode('details');

      const index = selectedExercise?.questions.findIndex(q => q._id === question._id) || 0;
      setCurrentQuestionIndex(index);
    }
  };

  const handleQuestionClick = (question: ExerciseQuestion, index: number) => {
    setSelectedQuestion(question);
    setCurrentQuestionIndex(index);
    setMaxScore(question.points);

    const submission = getSubmissionForQuestion(question._id);
    if (submission) {
      setSubmissionQuestion(submission);
      setScore(submission.score || 0);
    } else {
      setSubmissionQuestion(null);
      setScore(0);
    }
  };

  const handleNextQuestion = () => {
    if (!selectedExercise) return;

    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < selectedExercise.questions.length) {
      const nextQuestion = selectedExercise.questions[nextIndex];
      handleQuestionClick(nextQuestion, nextIndex);
    } else {
      toast.success('All questions reviewed');
    }
  };

  const handlePrevQuestion = () => {
    if (!selectedExercise) return;

    const prevIndex = currentQuestionIndex - 1;
    if (prevIndex >= 0) {
      const prevQuestion = selectedExercise.questions[prevIndex];
      handleQuestionClick(prevQuestion, prevIndex);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'bg-green-100 text-green-800 text-xs px-2 py-1 rounded';
      case 'medium': return 'bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded';
      case 'hard': return 'bg-red-100 text-red-800 text-xs px-2 py-1 rounded';
      default: return 'bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded';
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied');
  };

  const handleViewQuestionDetails = (question: ExerciseQuestion) => {
    setModalQuestion(question);
    setShowQuestionModal(true);
  };

  const calculateParticipantStats = (participant: Participant) => {
    const answers = getExerciseAnswersForSelectedExercise(participant);
    const totalQuestions = selectedExercise?.questions.length || 0;
    const questionsAttempted = getQuestionsAttemptedCount(participant);
    const totalScore = answers.reduce((sum, a) =>
      sum + a.questions.reduce((s, q) => s + q.score, 0), 0);
    const maxPossibleScore = selectedExercise?.exerciseInformation.totalPoints || 0;
    const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;

    return {
      totalQuestions,
      questionsAttempted,
      totalScore,
      maxPossibleScore,
      percentage
    };
  };

  const getExerciseStats = () => {
    const participantsWithSubmissions = participants.filter(p => getExerciseAnswersForSelectedExercise(p).length > 0);
    const totalParticipants = participants.length;
    const attendedParticipants = participantsWithSubmissions.length;

    const allScores = participantsWithSubmissions
      .map(p => calculateParticipantStats(p).totalScore)
      .filter(score => score > 0);
    const avgScore = allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : 0;
    const maxScore = selectedExercise?.exerciseInformation.totalPoints || 0;

    return {
      totalParticipants,
      attendedParticipants,
      totalQuestions: selectedExercise?.questions.length || 0,
      totalPoints: maxScore,
      avgScore: `${avgScore}/${maxScore}`,
      attendanceRate: totalParticipants > 0 ? Math.round((attendedParticipants / totalParticipants) * 100) : 0
    };
  };

  const getExerciseStatsTooltipContent = () => {
    const stats = getExerciseStats();

    return (
      <div className="space-y-3 p-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Total Participants</p>
            <p className="text-base font-semibold text-gray-900">{stats.totalParticipants}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Attended</p>
            <p className="text-base font-semibold text-green-600">{stats.attendedParticipants}</p>
          </div>
        </div>

        <Separator className="my-1" />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Total Questions</p>
            <p className="text-base font-semibold text-gray-900">{stats.totalQuestions}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Total Points</p>
            <p className="text-base font-semibold text-gray-900">{stats.totalPoints}</p>
          </div>
        </div>

        <Separator className="my-1" />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Avg. Score</p>
            <p className="text-base font-semibold text-blue-600">{stats.avgScore}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Attendance</p>
            <p className="text-base font-semibold text-green-600">{stats.attendanceRate}%</p>
          </div>
        </div>
      </div>
    );
  };

  const renderBreadcrumb = () => {
    if (breadcrumb.length === 0) {
      return (
        <div className="flex items-center space-x-1.5 text-xs">
          <div className="flex items-center space-x-1 text-gray-600">
            <Home className="h-3 w-3" />
            <span>Loading...</span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-1.5 text-xs">
        {breadcrumb.map((item, index) => (
          <div key={index} className="flex items-center space-x-1.5">
            {index > 0 && (
              <ChevronRight className="h-3 w-3 text-gray-400" />
            )}
            <div className={`flex items-center space-x-1 ${index === breadcrumb.length - 1
                ? 'text-gray-900 font-semibold'
                : 'text-gray-600'
              }`}>
              {item.icon}
              <span className={`truncate max-w-[120px] ${item.type === 'analytics' ? 'text-blue-600' : ''
                }`}>
                {item.title}
              </span>
              {item.type === 'exercise' && index === breadcrumb.length - 2 && selectedExercise && (
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-xs px-1.5 py-0 font-mono ml-1">
                  <Hash className="h-2.5 w-2.5 mr-0.5" />
                  {selectedExercise.exerciseInformation.exerciseId}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // NEW: ExerciseTable component integrated
  const ExerciseTable = ({ exercises, onExerciseSelect, selectedExerciseId }: {
    exercises: Exercise[];
    onExerciseSelect: (exercise: Exercise) => void;
    selectedExerciseId?: string | null;
  }) => {
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    };

    const getDifficultyColor = (level: string) => {
      switch (level.toLowerCase()) {
        case 'beginner':
        case 'easy':
          return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-[11px]';
        case 'intermediate':
        case 'medium':
          return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 text-[11px]';
        case 'advanced':
        case 'hard':
          return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 text-[11px]';
        default:
          return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 text-[11px]';
      }
    };

    const calculateTotalQuestions = (exercise: Exercise): number => {
      const levelConfig = exercise.programmingSettings?.levelConfiguration;

      if (!levelConfig) {
        return exercise.questions?.length || 0;
      }

      if (levelConfig.levelType === "levelBased" && levelConfig.levelBased) {
        return (levelConfig.levelBased.easy || 0) +
          (levelConfig.levelBased.medium || 0) +
          (levelConfig.levelBased.hard || 0);
      } else if (levelConfig.levelType === "general" && levelConfig.general) {
        return levelConfig.general;
      }

      return exercise.questions?.length || 0;
    };

    const getLevelBreakdown = (exercise: Exercise): string => {
      const levelConfig = exercise.programmingSettings?.levelConfiguration;
      
      if (levelConfig?.levelType === "levelBased" && levelConfig.levelBased) {
        return `${levelConfig.levelBased.easy || 0}E / ${levelConfig.levelBased.medium || 0}M / ${levelConfig.levelBased.hard || 0}H`;
      }
      return "";
    };

    const getAnalyticsStats = (exerciseId: string) => {
      const participantsWithSubmissions = participants.filter(p => {
        const answers = getExerciseAnswers(p);
        return answers.some(answer => answer.exerciseId === exerciseId);
      }).length;
      
      const avgScore = "0/0"; // You can implement this calculation based on your data
      const submissionRate = participants.length > 0 
        ? Math.round((participantsWithSubmissions / participants.length) * 100) 
        : 0;
      
      return {
        submissions: participantsWithSubmissions,
        avgScore,
        submissionRate
      };
    };

    if (exercises.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
            <Code className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            No Exercises
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No exercises available for analytics.
          </p>
        </div>
      );
    }

    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Exercise
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Level
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Questions
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Points
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Submissions
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Avg. Score
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {exercises.map((exercise) => {
                const isSelected = selectedExerciseId === exercise._id;
                const totalQuestions = calculateTotalQuestions(exercise);
                const levelBreakdown = getLevelBreakdown(exercise);
                const stats = getAnalyticsStats(exercise._id);

                return (
                  <tr
                    key={exercise._id}
                    onClick={() => onExerciseSelect(exercise)}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                  >
                    {/* Exercise Column */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-6 h-6 rounded flex items-center justify-center mr-2 flex-shrink-0 ${isSelected ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-800'
                          }`}>
                          <Code className={`w-3 h-3 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                            }`} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate max-w-[180px]">
                            {exercise.exerciseInformation.exerciseName}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
                            {exercise.exerciseInformation.description || 'No description'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Level Column */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full font-medium ${getDifficultyColor(exercise.exerciseInformation.exerciseLevel)}`}>
                        {exercise.exerciseInformation.exerciseLevel}
                      </span>
                    </td>

                    {/* Questions Column */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center">
                        <Hash className="w-3 h-3 mr-1.5 text-gray-400 flex-shrink-0" />
                        <div>
                          <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
                            {totalQuestions}
                          </div>
                          {levelBreakdown && (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              {levelBreakdown}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Points Column */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center">
                        <Award className="w-3 h-3 mr-1.5 text-gray-400 flex-shrink-0" />
                        <div className="text-xs text-gray-900 dark:text-gray-100">
                          {exercise.exerciseInformation.totalPoints}
                        </div>
                      </div>
                    </td>

                    {/* Submissions Column */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center">
                        <Users className="w-3 h-3 mr-1.5 text-gray-400 flex-shrink-0" />
                        <div>
                          <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
                            {stats.submissions}/{participants.length}
                          </div>
                          <div className={`text-[11px] ${stats.submissionRate >= 70 ? 'text-green-600 dark:text-green-400' : 
                              stats.submissionRate >= 40 ? 'text-yellow-600 dark:text-yellow-400' : 
                              'text-red-600 dark:text-red-400'
                            }`}>
                            {stats.submissionRate}%
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Average Score Column */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        {stats.avgScore}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        of {exercise.exerciseInformation.totalPoints}
                      </div>
                    </td>

                    {/* Actions Column */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExerciseSelect(exercise);
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View Analytics
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3">
            <RefreshCw className="h-10 w-10 animate-spin text-blue-600" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-gray-900">Loading Analytics</h3>
            <p className="text-sm text-gray-600">Fetching exercise data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Header with Full Breadcrumb */}
      <div className="sticky top-0 z-50 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="h-7 w-7 p-0 hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            {/* Full Breadcrumb */}
            <div className="max-w-2xl">
              {renderBreadcrumb()}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 hover:bg-gray-100"
                  >
                    <Info className="h-4 w-4 text-gray-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  className="w-72 p-4 bg-white border shadow-lg"
                  side="bottom"
                  align="end"
                >
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <BarChart className="h-4 w-4 text-blue-600" />
                      <h3 className="text-sm font-semibold text-gray-900">Exercise Statistics</h3>
                    </div>
                    {getExerciseStatsTooltipContent()}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchCourseData}
              className="h-7 px-2 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {!selectedExercise ? (
          <div className="max-w-6xl mx-auto">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Exercise Analytics Dashboard</CardTitle>
                    <p className="text-sm text-gray-600">Select an exercise to view detailed participant submissions</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input
                        placeholder="Search exercises..."
                        className="pl-9 h-8 text-sm w-48"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ExerciseTable
                  exercises={exercises}
                  onExerciseSelect={(exercise) => {
                    setSelectedExercise(exercise);
                    buildBreadcrumb(exercise);
                  }}
                  selectedExerciseId={selectedExercise?._id}
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            {viewMode === 'list' ? (
              <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">Participant Submissions</CardTitle>
                      <div className="flex items-center space-x-4 mt-1">
                        <p className="text-sm text-gray-600">
                          {filteredParticipants.length} participants
                        </p>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <span className="flex items-center">
                            <Users className="h-3 w-3 mr-1" />
                            {getExerciseStats().attendedParticipants} attended
                          </span>
                          <Separator orientation="vertical" className="h-3" />
                          <span className="flex items-center">
                            <FileText className="h-3 w-3 mr-1" />
                            {getExerciseStats().totalQuestions} questions
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <Input
                          placeholder="Search participants..."
                          className="pl-9 h-8 text-sm w-48"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowExportDialog(true)}
                        className="h-8 px-2"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 border-b">
                          <TableHead className="w-12 px-3 py-2.5 text-xs font-semibold text-gray-700 text-center">#</TableHead>
                          <TableHead className="px-3 py-2.5 text-xs font-semibold text-gray-700">Participant</TableHead>
                          <TableHead className="px-3 py-2.5 text-xs font-semibold text-gray-700">Status</TableHead>
                          <TableHead className="px-3 py-2.5 text-xs font-semibold text-gray-700">Questions</TableHead>
                          <TableHead className="px-3 py-2.5 text-xs font-semibold text-gray-700">Score</TableHead>
                          <TableHead className="px-3 py-2.5 text-xs font-semibold text-gray-700 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredParticipants.map((participant, index) => {
                          const stats = calculateParticipantStats(participant);
                          const answers = getExerciseAnswersForSelectedExercise(participant);
                          const hasSubmissions = answers.length > 0;

                          return (
                            <TableRow key={participant._id} className="border-b hover:bg-gray-50">
                              <TableCell className="px-3 py-2.5 text-center text-xs text-gray-500">
                                {index + 1}
                              </TableCell>
                              <TableCell className="px-3 py-2.5">
                                <div className="flex items-center space-x-2.5">
                                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                                    {participant.user.firstName[0]}{participant.user.lastName[0]}
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {participant.user.firstName} {participant.user.lastName}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate max-w-[180px]">
                                      {participant.user.email}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="px-3 py-2.5">
                                {hasSubmissions ? (
                                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs px-2 py-0.5">
                                    Submitted
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-gray-500 text-xs px-2 py-0.5">
                                    Not Started
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="px-3 py-2.5">
                                <div className="text-sm">
                                  <div className="font-medium text-gray-900">
                                    {stats.questionsAttempted}/{stats.totalQuestions}
                                  </div>
                                  <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
                                    <div
                                      className="h-full bg-blue-600"
                                      style={{ width: `${(stats.questionsAttempted / stats.totalQuestions) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="px-3 py-2.5">
                                <div className="text-sm">
                                  <div className="font-medium text-gray-900">
                                    {stats.totalScore}/{stats.maxPossibleScore}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {Math.round(stats.percentage)}%
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="px-3 py-2.5 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const firstAnswer = answers[0];
                                    if (firstAnswer && firstAnswer.questions.length > 0) {
                                      const firstSubmission = firstAnswer.questions[0];
                                      handleViewSubmission(participant, firstAnswer, firstSubmission);
                                    } else {
                                      setSelectedParticipant(participant);
                                      setSelectedAnswer(answers[0] || null);
                                      setViewMode('details');
                                      setCurrentQuestionIndex(0);
                                      setSelectedQuestion(selectedExercise.questions[0]);
                                    }
                                  }}
                                  className="h-7 px-2 text-xs"
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                                  Review
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {/* Detail View Header */}
                <Card className="border">
                  <CardContent >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setViewMode('list');
                            setSelectedParticipant(null);
                            setSelectedQuestion(null);
                          }}
                          className="h-6 px-1.5 text-xs"
                        >
                          <ArrowLeft className="h-3 w-3 mr-1" />
                          Back
                        </Button>
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                            {selectedParticipant?.user.firstName[0]}{selectedParticipant?.user.lastName[0]}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {selectedParticipant?.user.firstName} {selectedParticipant?.user.lastName}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          Q{currentQuestionIndex + 1}/{selectedExercise?.questions.length}
                        </div>
                        <div className="text-xs text-gray-500">
                          {selectedAnswer?.questions.reduce((sum, q) => sum + q.score, 0)}/{selectedExercise?.exerciseInformation.totalPoints}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Main Content Area */}
                <div className="grid grid-cols-12 gap-3">
                  {/* Left Column - Question List */}
              {/* Left Column - Question List */}
<div className="col-span-12 lg:col-span-3">
  <Card className="border h-full">
    <CardHeader className="pb-3">
      <CardTitle className="text-sm font-semibold">Questions</CardTitle>
    </CardHeader>
    <CardContent className="p-0">
      <div className="space-y-1 max-h-[500px] overflow-y-auto p-2">
        {selectedExercise?.questions.map((question, index) => {
          const submission = getSubmissionForQuestion(question._id);
          const isCurrent = currentQuestionIndex === index;
          const hasSubmission = submission && submission.codeAnswer && submission.codeAnswer.trim() !== '';
          const isEvaluated = submission?.status === 'evaluated';
          const isCorrect = submission?.isCorrect;
          
          // Determine question status
          let status: 'current' | 'completed' | 'attempted' | 'unattended' = 'unattended';
          let displayIcon = (index + 1).toString();
          
          if (isCurrent) {
            status = 'current';
          } else if (hasSubmission) {
            if (isEvaluated) {
              status = 'completed';
              displayIcon = isCorrect ? '✓' : '✗';
            } else {
              status = 'attempted';
              displayIcon = '⟳';
            }
          }
          
          // Define styles based on status - ONLY CURRENT QUESTION GETS BLUE BACKGROUND
          const getQuestionItemStyles = () => {
            if (isCurrent) {
              return 'bg-blue-50 border border-blue-200'; // Current question: blue highlight
            }
            return 'hover:bg-gray-50 border border-transparent'; // All others: normal hover
          };
          
          const getNumberStyles = () => {
            switch (status) {
              case 'current':
                return 'bg-blue-600 text-white';
              case 'completed':
                return isCorrect 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800';
              case 'attempted':
                return 'bg-yellow-100 text-yellow-800';
              default:
                return 'bg-gray-100 text-gray-600';
            }
          };
          
          // Score badge color based on correctness
          const getScoreBadgeStyles = () => {
            if (!hasSubmission || submission?.score === undefined) return '';
            return submission.isCorrect 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800';
          };
          
          return (
            <div
              key={question._id}
              className={`p-2.5 rounded text-sm transition-all cursor-pointer flex items-center space-x-3 ${getQuestionItemStyles()}`}
              onClick={() => handleQuestionClick(question, index)}
            >
              <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium ${getNumberStyles()}`}>
                {displayIcon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900 truncate">
                  {question.title}
                </div>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    question.difficulty.toLowerCase() === 'easy' ? 'bg-green-100 text-green-800' :
                    question.difficulty.toLowerCase() === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {question.difficulty.charAt(0)}
                  </span>
                  <span className="text-xs text-gray-500">{question.points}p</span>
                </div>
              </div>

              {hasSubmission && submission?.score !== undefined && (
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getScoreBadgeStyles()}`}>
                  {submission.score}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </CardContent>
  </Card>
</div>

                  {/* Middle Column - Code Viewer */}
                  <div className="col-span-12 lg:col-span-6">
                    <Card className="border h-full">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Code className="h-4 w-4 text-blue-600" />
                            <CardTitle className="text-sm font-semibold">
                              {selectedQuestion?.title || 'Select a question'}
                            </CardTitle>
                          </div>
                          <div className="flex items-center space-x-2">
                            {submissionQuestion?.language && (
                              <Badge variant="outline" className="text-xs">
                                {submissionQuestion.language}
                              </Badge>
                            )}
                            {submissionQuestion?.codeAnswer && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyCode(submissionQuestion.codeAnswer)}
                                className="h-6 px-2 text-xs"
                              >
                                <Copy className="h-3.5 w-3.5 mr-1" />
                                Copy
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="bg-gray-900 min-h-[400px] max-h-[500px] overflow-auto">
                          {submissionQuestion?.codeAnswer ? (
                            <pre className="p-3 font-mono text-sm text-gray-100 whitespace-pre-wrap break-all">
                              {submissionQuestion.codeAnswer}
                            </pre>
                          ) : (
                            <div className="h-full flex items-center justify-center p-4">
                              <div className="text-center">
                                <Code className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                                <p className="text-sm text-gray-400">No code submission</p>
                                <p className="text-xs text-gray-500 mt-1">Participant hasn't submitted code</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right Column - Scoring Panel */}
                  <div className="col-span-12 lg:col-span-3">
                    <Card className="border h-full">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold">Score Entry</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Score Display */}
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold text-gray-900 mb-1">
                              {score}/{maxScore}
                            </div>
                            <div className="text-xs text-gray-500">Current Score</div>
                          </div>

                          {/* Score Input */}
                          <div>
                            <Label className="text-xs font-medium text-gray-900 mb-2 block">
                              Enter Score
                            </Label>
                            <div className="relative">
                              <Input
                                type="number"
                                min="0"
                                max={maxScore}
                                value={score}
                                onChange={(e) => setScore(parseInt(e.target.value) || 0)}
                                className="h-9 text-center text-base font-medium pr-12"
                                autoFocus
                              />
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                                /{maxScore}
                              </div>
                            </div>
                          </div>

                          {/* Navigation Buttons */}
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handlePrevQuestion}
                              disabled={currentQuestionIndex === 0}
                              className="flex-1 h-8 text-xs"
                            >
                              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                              Prev
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleNextQuestion}
                              disabled={currentQuestionIndex === (selectedExercise?.questions.length || 0) - 1}
                              className="flex-1 h-8 text-xs"
                            >
                              Next
                              <ChevronRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                          </div>

                          {/* Action Buttons */}
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setScore(0)}
                              className="h-8 text-xs"
                            >
                              <X className="h-3.5 w-3.5 mr-1" />
                              Clear
                            </Button>
                            <Button
                              onClick={handleScoreUpdate}
                              disabled={isSaving}
                              className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                            >
                              {isSaving ? (
                                <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                              ) : (
                                <Save className="h-3.5 w-3.5 mr-1" />
                              )}
                              {isSaving ? 'Saving...' : 'Save'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Question Details Modal */}
      <Dialog open={showQuestionModal} onOpenChange={setShowQuestionModal}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Question Details</DialogTitle>
          </DialogHeader>

          {modalQuestion && (
            <div className="space-y-4 py-2">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{modalQuestion.title}</h3>
                <div className="flex items-center space-x-2">
                  <span className={getDifficultyColor(modalQuestion.difficulty)}>
                    {modalQuestion.difficulty}
                  </span>
                  <span className="text-xs text-gray-600">{modalQuestion.points} points</span>
                  <span className="text-xs text-gray-600">• Time: {modalQuestion.timeLimit}s</span>
                  <span className="text-xs text-gray-600">• Memory: {modalQuestion.memoryLimit}MB</span>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Description</h4>
                <div className="bg-gray-50 p-3 rounded border text-sm">
                  <p className="text-gray-700 whitespace-pre-wrap">{modalQuestion.description}</p>
                </div>
              </div>

              {(modalQuestion.sampleInput || modalQuestion.sampleOutput) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {modalQuestion.sampleInput && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Sample Input</h4>
                      <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-sm">
                        <pre className="whitespace-pre-wrap">{modalQuestion.sampleInput}</pre>
                      </div>
                    </div>
                  )}

                  {modalQuestion.sampleOutput && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Sample Output</h4>
                      <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-sm">
                        <pre className="whitespace-pre-wrap">{modalQuestion.sampleOutput}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Export Analytics</DialogTitle>
          </DialogHeader>

          <div className="py-3">
            <div>
              <Label className="text-xs font-medium text-gray-900 mb-2">Export Format</Label>
              <div className="grid grid-cols-3 gap-2">
                {['CSV', 'PDF', 'Excel'].map((format) => (
                  <Button
                    key={format}
                    variant={exportFormat === format.toLowerCase() ? 'default' : 'outline'}
                    onClick={() => setExportFormat(format.toLowerCase() as any)}
                    className="h-8 text-xs"
                  >
                    {format}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => {
              toast.success(`Exporting as ${exportFormat.toUpperCase()}`);
              setShowExportDialog(false);
            }}>
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}