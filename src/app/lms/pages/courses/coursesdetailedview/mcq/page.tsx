"use client";
import { getToken } from "@/lib/session";

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MCQ from '@/app/lms/component/student/mcq';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Loading from '@/components/loading-ui/loading';

const MCQPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [exerciseData, setExerciseData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string>("");
  const [courseName, setCourseName] = useState<string>("Course");
  const [hierarchy, setHierarchy] = useState<string[]>([]);

  // Extract all parameters
  const subcategory = searchParams.get('subcategory') || "Assessment";
  const category = searchParams.get('category') || "Course Work";
  const exerciseName = searchParams.get('exerciseName');
  const urlCourseId = searchParams.get('courseId') || "";
  const urlCourseName = searchParams.get('courseName') || "";
  const exerciseId = searchParams.get('exerciseId');
  const nodeId = searchParams.get('nodeId');
  const nodeName = searchParams.get('nodeName');
  const nodeType = searchParams.get('nodeType');
  const hierarchyParam = searchParams.get('hierarchy') || "";

  useEffect(() => {
    const fetchExerciseData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Get token from localStorage
        const token = getToken() || localStorage.getItem('token') || '';
        
        if (!token) {
          throw new Error('Authentication token not found');
        }

        // Use exerciseId from URL params
        const finalExerciseId = exerciseId;
        
        if (!finalExerciseId) {
          throw new Error('Exercise ID is required');
        }

        console.log("Fetching exercise data for ID:", finalExerciseId);

        // Fetch exercise data from API
        const response = await fetch(`http://localhost:5533/exercise/${finalExerciseId}`, {
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
        console.log("API Response:", data);

        // Check if the response contains exercise data
        if (data.message?.[0]?.key === 'success' && data.data?.exercise) {
          const fetchedExercise = data.data.exercise;
          setExerciseData(fetchedExercise);
          
          // Set course ID from URL or from exercise data
          const extractedCourseId = urlCourseId || 
                                   fetchedExercise.courseId || 
                                   fetchedExercise.context?.courseId || 
                                   "";
          setCourseId(extractedCourseId);
          
          // Set course name from URL or from exercise data
          const extractedCourseName = urlCourseName || 
                                     fetchedExercise.courseName || 
                                     "Course";
          setCourseName(extractedCourseName);
          
          // Parse hierarchy
          if (hierarchyParam) {
            const hierarchyArray = hierarchyParam
              .split(',')
              .map(item => item.trim())
              .filter(item => item !== '');
            
            setHierarchy(hierarchyArray);
            console.log("Dynamic hierarchy loaded:", hierarchyArray);
          } else if (fetchedExercise.context?.hierarchy) {
            setHierarchy(fetchedExercise.context.hierarchy);
          }
        } else {
          throw new Error('Invalid exercise data received from API');
        }
        
      } catch (error: any) {
        console.error("Error loading assessment:", error);
        setError(error.message || 'Failed to load assessment');
        toast.error(error.message || 'Failed to load assessment');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (exerciseId) {
      fetchExerciseData();
    } else {
      setError('No exercise ID provided');
      setIsLoading(false);
    }
  }, [exerciseId, urlCourseId, urlCourseName, hierarchyParam]);

  const handleCloseExercise = () => {
    if (courseId) {
      // Return to the EXACT spot: re-open the same node + tab + activity (exercise list).
      const method = category === 'We_Do' ? 'we-do' : category === 'I_Do' ? 'i-do' : category === 'You_Do' ? 'you-do' : '';
      const qp = new URLSearchParams();
      if (nodeId) qp.set('restoreNodeId', nodeId);
      if (method) qp.set('method', method);
      if (subcategory) qp.set('activity', subcategory);
      router.push(`/lms/pages/courses/coursesdetailedview/${courseId}?${qp.toString()}`);
    } else {
      router.back();
    }
  };

  const getStudentId = () => {
    if (typeof window !== 'undefined') {
      try {
        const userData = localStorage.getItem('userData');
        if (userData) {
          const parsed = JSON.parse(userData);
          return parsed._id || parsed.id || parsed.userId || 'unknown_student';
        }
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }
    return 'unknown_student';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loading size="size-12" color="orange" label="Loading assessment from server..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.back()}
            className="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors w-full"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!exerciseData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Data Available</h2>
          <button
            onClick={() => router.back()}
            className="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const exerciseInfo = exerciseData.exerciseInformation || exerciseData;
  const questionConfig = exerciseData.questionConfiguration?.mcqQuestionConfiguration || {};
  
  const formattedExercise = {
    _id: exerciseData._id || exerciseId || '',
    title: exerciseInfo.exerciseName || exerciseName || 'Assessment',
    description: exerciseInfo.description || '',
    totalQuestions: exerciseData.questions?.length || 0,
    totalPoints: questionConfig.mcqTotalMarks || exerciseData.questions?.length || 0,
    estimatedTime: exerciseInfo.totalDuration || 30,
    questions: exerciseData.questions || [],
    questionConfiguration: exerciseData.questionConfiguration
  };

  const studentId = getStudentId();

  return (
    <div className="min-h-screen bg-white">
      <MCQ
        exercise={formattedExercise}
        courseId={courseId}
        courseName={courseName}
        nodeId={nodeId || exerciseData?.nodeId || ''}
        nodeName={nodeName || ''}
        nodeType={nodeType || ''}
        onCloseExercise={handleCloseExercise}
        studentId={studentId}
        category={category}
        subcategory={subcategory}
        hierarchy={hierarchy}
      />
    </div>
  );
};

// Main page component
export default function MCQPage() {
  return (
    <Suspense 
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Loading size="size-10" color="orange" />
        </div>
      }
    >
      <MCQPageContent />
    </Suspense>
  );
}