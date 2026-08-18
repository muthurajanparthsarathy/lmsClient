// In /lms/pages/courses/coursesdetailedview/sql/page.tsx
"use client";

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DBQueryEditor from '@/app/lms/component/student/YouDo/assessment/components/db-queryEditor';
import { ArrowLeft } from 'lucide-react';

const SQLCompilerPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [exerciseData, setExerciseData] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [courseId, setCourseId] = useState<string>("");

  // --- READ PARAMS ---
  const subcategory = searchParams.get('subcategory') || "practical";
  const categoryParam = searchParams.get('category');
  const category = categoryParam || "We_Do";
  
  const exerciseName = searchParams.get('exerciseName');
  const urlCourseId = searchParams.get('courseId') || "";
  const exerciseId = searchParams.get('exerciseId');

  useEffect(() => {
    const loadExerciseData = () => {
      if (typeof window !== 'undefined') {
        let storedData = localStorage.getItem('currentSQLExercise');
        
        if (!storedData) {
          storedData = localStorage.getItem('currentFrontendExercise');
        }
        
        if (storedData) {
          try {
            const parsedData = JSON.parse(storedData);
            
            let extractedCourseId = urlCourseId || 
              parsedData.courseId || 
              parsedData.context?.courseId || 
              "";
            setCourseId(extractedCourseId);
            
            let extractedQuestions = [];
            
            if (parsedData.questions && Array.isArray(parsedData.questions)) {
              extractedQuestions = parsedData.questions;
            } else if (parsedData.exerciseInformation?.questions && Array.isArray(parsedData.exerciseInformation.questions)) {
              extractedQuestions = parsedData.exerciseInformation.questions;
            } else if (parsedData.data?.questions && Array.isArray(parsedData.data.questions)) {
              extractedQuestions = parsedData.data.questions;
            }
            
            setExerciseData(parsedData);
            setQuestions(extractedQuestions);
            
          } catch (error) {
            console.error("❌ Error parsing exercise data:", error);
          }
        }
        setIsLoading(false);
      }
    };
    
    loadExerciseData();
  }, [urlCourseId, exerciseId, exerciseName, subcategory]);

 // In /lms/pages/courses/coursesdetailedview/sql/page.tsx
// Update the handleBack function:

const handleBack = () => {
  console.log("Going back from SQL compiler...");
  
  // Clear storage
  localStorage.removeItem('currentSQLExercise');
  localStorage.removeItem('currentFrontendExercise');
  
  // Get return path from exercise data or go back in history
  const context = exerciseData?.context;
  if (context?.nodeId) {
    // Build return URL to specific node in LMS
    router.push(`/lms/pages/courses/coursesdetailedview/${courseId}`);
  } else {
    // Fallback to router back
    router.back();
  }
};
  if (isLoading) {
    return (
      <div className="w-full h-screen bg-[#1e1e1e] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!exerciseData || questions.length === 0) {
    return (
      <div className="w-full h-screen bg-[#1e1e1e] flex flex-col items-center justify-center">
        <div className="text-center p-8 bg-gray-900 rounded-lg">
          <h1 className="text-2xl text-white mb-4">No Exercise Data Found</h1>
          <p className="text-gray-400 mb-6">Please select an exercise from the LMS page.</p>
          <button
            onClick={() => {
              localStorage.removeItem('currentSQLExercise');
              localStorage.removeItem('currentFrontendExercise');
              router.back();
            }}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  const behaviorSettings = exerciseData?.questionBehavior || {};
  const exerciseInfo = exerciseData?.exerciseInformation || exerciseData || {};
  const security = exerciseData?.securitySettings || {};

  const entityId = exerciseData?.nodeId || exerciseData?.context?.entityId || "";
  const entityType = exerciseData?.nodeType || exerciseData?.context?.entityType || "topics";

  return (
    <div className="w-full h-screen bg-[#1e1e1e] overflow-hidden">
      {/* Simple icon-only back button like FrontendCompiler */}
      {/* <div className="absolute top-4 left-4 z-50">
        <button
          onClick={handleBack}
          className="p-2.5 text-white rounded-lg transition-colors shadow-lg"
          title="Go Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div> */}

      <DBQueryEditor
        onBack={handleBack}
        exercise={exerciseData}
        defaultQuestions={questions}
        theme="light"
        courseId={courseId}
        nodeId={entityId}
        nodeName={exerciseInfo.exerciseName || exerciseName}
        nodeType={entityType}
        subcategory={subcategory}
        category={category}
        skipSecurityModal={searchParams.get('securityAck') === '1'}
        onCloseExercise={handleBack}
        onResetExercise={() => {
          if (questions.length > 0 && questions[0]?.schema) {
            // This will be handled by the DBQueryEditor component
          }
        }}
      />
    </div>
  );
};

export default function SQLCompilerPage() {
  return (
    <Suspense fallback={
      <div className="w-full h-screen bg-[#1e1e1e] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <SQLCompilerPageContent />
    </Suspense>
  );
}