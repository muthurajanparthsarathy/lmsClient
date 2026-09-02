"use client";
import { getToken } from "@/lib/session";

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import OthersExam from '@/app/lms/component/student/OthersExam';
import { Loading } from '@/components/loading-ui/loading';

const OthersPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [exerciseData, setExerciseData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string>("");
  const [courseName, setCourseName] = useState<string>("Course");
  const [hierarchy, setHierarchy] = useState<string[]>([]);

  const subcategory = searchParams.get('subcategory') || "Assessment";
  const category = searchParams.get('category') || "You_Do";
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
        const token = getToken() || localStorage.getItem('token') || '';
        if (!token) throw new Error('Authentication token not found');
        if (!exerciseId) throw new Error('Exercise ID is required');

        const response = await fetch(`https://lmsserver-yeve.onrender.com/exercise/${exerciseId}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (data.message?.[0]?.key === 'success' && data.data?.exercise) {
          const fetchedExercise = data.data.exercise;
          setExerciseData(fetchedExercise);
          setCourseId(urlCourseId || fetchedExercise.courseId || fetchedExercise.context?.courseId || "");
          setCourseName(urlCourseName || fetchedExercise.courseName || "Course");
          if (hierarchyParam) {
            setHierarchy(hierarchyParam.split(',').map((s: string) => s.trim()).filter(Boolean));
          } else if (fetchedExercise.context?.hierarchy) {
            setHierarchy(fetchedExercise.context.hierarchy);
          }
        } else {
          throw new Error('Invalid exercise data received from API');
        }
      } catch (err: any) {
        console.error("Error loading Others exercise:", err);
        setError(err.message || 'Failed to load exercise');
        toast.error(err.message || 'Failed to load exercise');
      } finally {
        setIsLoading(false);
      }
    };

    if (exerciseId) fetchExerciseData();
    else { setError('No exercise ID provided'); setIsLoading(false); }
  }, [exerciseId, urlCourseId, urlCourseName, hierarchyParam]);

  const handleClose = () => {
    if (courseId) {
      // Return to the EXACT spot: re-open the same node + tab + activity (exercise list).
      const method = category === 'We_Do' ? 'we-do' : category === 'I_Do' ? 'i-do' : category === 'You_Do' ? 'you-do' : '';
      const qp = new URLSearchParams();
      if (nodeId) qp.set('restoreNodeId', nodeId);
      if (method) qp.set('method', method);
      if (subcategory) qp.set('activity', subcategory);
      router.push(`/lms/pages/courses/coursesdetailedview/${courseId}?${qp.toString()}`);
    } else router.back();
  };

  const getStudentId = () => {
    if (typeof window !== 'undefined') {
      try {
        const userData = localStorage.getItem('userData');
        if (userData) {
          const parsed = JSON.parse(userData);
          return parsed._id || parsed.id || parsed.userId || 'unknown_student';
        }
      } catch {}
    }
    return 'unknown_student';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loading size="size-12" color="orange" label="Loading exercise..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={() => router.back()} className="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors w-full">
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
          <button onClick={() => router.back()} className="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <OthersExam
        exercise={exerciseData}
        courseId={courseId}
        courseName={courseName}
        nodeId={nodeId || exerciseData?.nodeId || ''}
        nodeName={nodeName || ''}
        nodeType={nodeType || ''}
        studentId={getStudentId()}
        category={category}
        subcategory={subcategory}
        hierarchy={hierarchy}
        onClose={handleClose}
      />
    </div>
  );
};

export default function OthersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Loading size="size-10" color="orange" />
        </div>
      }
    >
      <OthersPageContent />
    </Suspense>
  );
}
