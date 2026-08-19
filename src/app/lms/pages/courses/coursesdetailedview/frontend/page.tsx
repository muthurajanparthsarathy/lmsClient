"use client";
import { getToken } from "@/lib/session";

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FrontendCompiler from '@/app/lms/component/student/frontendCompiler';
import { Loading } from '@/components/loading-ui/loading';

const CompilerPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [exerciseData, setExerciseData] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [courseId, setCourseId] = useState<string>("");
  const [previousSubmission, setPreviousSubmission] = useState<any>(null);
  const [isLoadingSubmission, setIsLoadingSubmission] = useState(false);

  // --- READ PARAMS ---
  const subcategory = searchParams.get('subcategory') || "practical";
  const categoryParam = searchParams.get('category');
  const category = categoryParam || "We_Do";
  const exerciseName = searchParams.get('exerciseName');
  const urlCourseId = searchParams.get('courseId') || "";
  const exerciseId = searchParams.get('exerciseId');
  const nodeId = searchParams.get('nodeId');
  const hierarchy = searchParams.get('hierarchy')?.split(',') || [];

  // Function to fetch exercise data from API
  const fetchExerciseData = async () => {
    if (!exerciseId) {
      console.error("No exercise ID provided");
      setIsLoading(false);
      return;
    }

    try {
      const token = getToken() || localStorage.getItem('token') || '';
      
      if (!token) {
        console.error("Authentication token missing");
        setIsLoading(false);
        return;
      }

      const response = await fetch(`https://lmsserver-yeve.onrender.com/exercise/${exerciseId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Frontend",data)

      if (data.message?.[0]?.key === 'success' && data.data?.exercise) {
        const fetchedExercise = data.data.exercise;
        setExerciseData(fetchedExercise);
        
        // Extract questions
        let extractedQuestions = [];
        if (fetchedExercise.questions && Array.isArray(fetchedExercise.questions)) {
          extractedQuestions = fetchedExercise.questions;
        } else if (fetchedExercise.exerciseInformation?.questions) {
          extractedQuestions = fetchedExercise.exerciseInformation.questions;
        }
        
        setQuestions(extractedQuestions);
        setCourseId(urlCourseId || fetchedExercise.courseId || "");

        console.log("Loaded exercise data:", {
          exerciseId: fetchedExercise._id,
          questionsCount: extractedQuestions.length
        });

        // If there are questions, try to load previous submission for the first question
        if (extractedQuestions.length > 0) {
          const firstQuestion = extractedQuestions[0];
          const questionId = getQuestionId(firstQuestion);
          
          if (questionId) {
            const submission = await fetchPreviousSubmission(questionId);
            if (submission) {
              setPreviousSubmission(submission);
            }
          }
        }
      }
    } catch (error) {
      console.error("❌ Error fetching exercise:", error);
      toast.error("Failed to load exercise data");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to fetch previous submission
  const fetchPreviousSubmission = async (questionId: string) => {
    if (!courseId || !exerciseId || !questionId || !category) {
      console.warn("Missing required parameters for fetching submission");
      return null;
    }

    setIsLoadingSubmission(true);
    try {
      const token = getToken() || localStorage.getItem('token') || '';
      
      if (!token) {
        console.error("Authentication token missing");
        return null;
      }

      const response = await fetch(
        `https://lmsserver-yeve.onrender.com/courses/answers/previous-submission?courseId=${courseId}&exerciseId=${exerciseId}&questionId=${questionId}&category=${category}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          console.log("Loaded submission data:", {
            files: data.data.files?.length || 0,
            folders: data.data.folders?.length || 0
          });
          return data.data;
        }
      }
      return null;
    } catch (error) {
      console.error("Error fetching previous submission:", error);
      return null;
    } finally {
      setIsLoadingSubmission(false);
    }
  };

  // Enhanced function to transform submission data
  const transformSubmissionToCompilerFormat = (submission: any) => {
    if (!submission) return null;

    // Transform files from submission
    const transformedFiles = (submission.files || []).map((file: any, index: number) => {
      let language = file.language;
      if (!language && file.filename) {
        const ext = file.filename.split('.').pop()?.toLowerCase();
        if (ext === 'html' || ext === 'htm') language = 'html';
        else if (ext === 'css') language = 'css';
        else if (ext === 'js') language = 'javascript';
        else if (ext === 'json') language = 'json';
        else if (ext === 'xml') language = 'xml';
        else if (ext === 'md' || ext === 'markdown') language = 'markdown';
        else if (ext === 'txt') language = 'text';
        else language = 'text';
      }

      return {
        id: file.id || `file-${Date.now()}-${index}`,
        filename: file.filename || `file${index}.txt`,
        content: file.content || '',
        language: language || 'text',
        path: file.path || `/${file.filename}`,
        folderPath: file.folderPath || '/',
        isEntryPoint: file.isEntryPoint || false,
        lastModified: file.lastModified ? new Date(file.lastModified) : new Date(),
        size: file.size || (file.content ? Buffer.byteLength(file.content, 'utf8') : 0),
        isDirty: false
      };
    });

    // Transform folders from submission
    const transformedFolders = (submission.folders || []).map((folder: any, index: number) => {
      const path = folder.path || `/${folder.name}`;
      const parentPath = folder.parentPath || '/';
      
      return {
        id: folder.id || `folder-${Date.now()}-${index}`,
        name: folder.name || `folder${index}`,
        path: path,
        parentPath: parentPath,
        children: [],
        folderChildren: [],
        isOpen: true,
        depth: folder.depth || (path.split('/').filter(Boolean).length - 1)
      };
    });

    // If we have files but no folders, create a root folder
    if (transformedFiles.length > 0 && transformedFolders.length === 0) {
      transformedFolders.push({
        id: 'folder-root',
        name: 'Root',
        path: '/',
        parentPath: '',
        children: [],
        folderChildren: [],
        isOpen: true,
        depth: 0
      });
    }

    return {
      files: transformedFiles,
      folders: transformedFolders,
      submissionData: submission
    };
  };

  // Helper function to get question ID
  const getQuestionId = (question: any) => {
    if (!question) return null;
    
    const possibleIds = [
      question._id,
      question.id,
      question.questionId,
      question.question_id,
      question.questionID
    ];
    
    const foundId = possibleIds.find(id => id && id.toString().trim() !== '');
    
    if (!foundId) {
      console.warn('No question ID found in:', question);
      return null;
    }
    
    return foundId.toString();
  };

  // Load data on component mount
  useEffect(() => {
    fetchExerciseData();
  }, [exerciseId, urlCourseId]);

  const handleBack = () => {
    const cId = courseId || urlCourseId;
    if (cId) {
      // Return to the EXACT spot: re-open the same node + tab + activity (exercise list).
      const method = category === 'We_Do' ? 'we-do' : category === 'I_Do' ? 'i-do' : category === 'You_Do' ? 'you-do' : '';
      const qp = new URLSearchParams();
      if (nodeId) qp.set('restoreNodeId', nodeId);
      if (method) qp.set('method', method);
      if (subcategory) qp.set('activity', subcategory);
      router.push(`/lms/pages/courses/coursesdetailedview/${cId}?${qp.toString()}`);
    } else {
      router.back();
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-[#1e1e1e] flex items-center justify-center text-white">
        <Loading size="size-10" color="blue" label="Loading exercise data..." spinnerClassName="text-orange-400" />
      </div>
    );
  }

  if (!exerciseData) {
    return (
      <div className="w-full h-screen bg-[#1e1e1e] flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-red-400 mb-2">Failed to load exercise data</p>
          <button 
            onClick={handleBack}
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const behaviorSettings = exerciseData?.questionBehavior || {};
  const exerciseInfo = exerciseData?.exerciseInformation || {};
  const settings = exerciseData?.programmingSettings || {};
  const security = exerciseData?.securitySettings || {};

  const entityId = exerciseData?.nodeId || exerciseData?.context?.entityId || "";
  const entityType = exerciseData?.nodeType || exerciseData?.context?.entityType || "topics";

  // Transform previous submission if available
  const previousSubmissionData = previousSubmission 
    ? transformSubmissionToCompilerFormat(previousSubmission)
    : null;

  return (
    <div className="w-full h-screen bg-[#1e1e1e] overflow-hidden">
      <FrontendCompiler
        exerciseData={exerciseData} 

        onBack={handleBack}
        title={exerciseInfo.exerciseName || exerciseName || "Frontend Lab"}
        questions={questions}
        selectedLanguages={settings.selectedLanguages}
        level={exerciseInfo.exerciseLevel || "beginner"}
        attemptLimitEnabled={behaviorSettings.attemptLimitEnabled}
        maxAttempts={behaviorSettings.maxAttempts}
        entityId={entityId}
        entityType={entityType}
        security={security}
        exerciseId={exerciseData?._id || exerciseInfo._id || exerciseId || ""}
        courseId={courseId}
        category={category}
        subcategory={subcategory}
        selectedProgrammingLanguage={exerciseData?.programmingSettings?.selectedModule}
        
        // Pass previous submission data if available
        initialFiles={previousSubmissionData?.files}
        initialFolders={previousSubmissionData?.folders}
        isLoadingSubmission={isLoadingSubmission}
        
        // Pass current question index
        initialQuestionIndex={0}
        hierarchy={hierarchy}
      />
    </div>
  );
};

export default function FrontendCompilerPage() {
  return (
    <Suspense fallback={<div className="text-white bg-[#1e1e1e]">Loading compiler...</div>}>
      <CompilerPageContent />
    </Suspense>
  );
}