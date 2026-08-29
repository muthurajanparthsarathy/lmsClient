"use client";
import { getToken } from "@/lib/session";

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import CodeEditor from '@/app/lms/component/student/YouDo/assessment/components/code-editor';

const ProgrammingPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [exerciseData, setExerciseData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [courseId, setCourseId] = useState<string>('');
  const [courseName, setCourseName] = useState<string>('Course');
  const [hierarchy, setHierarchy] = useState<string[]>([]);

  const subcategory = searchParams.get('subcategory') || '';
  const category = searchParams.get('category') || 'You_Do';
  const exerciseName = searchParams.get('exerciseName') || '';
  const urlCourseId = searchParams.get('courseId') || '';
  const urlCourseName = searchParams.get('courseName') || '';
  const exerciseId = searchParams.get('exerciseId') || '';
  const nodeId = searchParams.get('nodeId') || '';
  const nodeName = searchParams.get('nodeName') || '';
  const nodeType = searchParams.get('nodeType') || '';
  const hierarchyParam = searchParams.get('hierarchy') || '';
  const securityAck = searchParams.get('securityAck') === '1';

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);

      // 1. Try localStorage first (stored by handleExerciseSelect)
      try {
        const stored = localStorage.getItem('currentProgrammingExercise');
        if (stored) {
          const parsed = JSON.parse(stored);
          setExerciseData(parsed);
          setCourseId(urlCourseId || parsed.courseId || parsed.context?.courseId || '');
          setCourseName(urlCourseName || parsed.courseName || 'Course');
          if (hierarchyParam) {
            setHierarchy(hierarchyParam.split(',').map((s: string) => s.trim()).filter(Boolean));
          } else if (parsed.context?.hierarchy) {
            setHierarchy(parsed.context.hierarchy);
          }
          setIsLoading(false);
          return;
        }
      } catch { /* fall through to API */ }

      // 2. Fallback — fetch from API using exerciseId in URL
      if (!exerciseId) {
        setIsLoading(false);
        return;
      }

      try {
        const token = getToken() || localStorage.getItem('token') || '';
        const res = await fetch(`http://localhost:5533/exercise/${exerciseId}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          const ex = data.data?.exercise || data.data || data;
          if (ex?._id) {
            setExerciseData(ex);
            setCourseId(urlCourseId || ex.courseId || '');
            setCourseName(urlCourseName || ex.courseName || 'Course');
            if (hierarchyParam) {
              setHierarchy(hierarchyParam.split(',').map((s: string) => s.trim()).filter(Boolean));
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch programming exercise:', err);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [exerciseId, urlCourseId, urlCourseName, hierarchyParam]);

  const handleBack = () => {
    localStorage.removeItem('currentProgrammingExercise');
    if (courseId) {
      router.push(`/lms/pages/courses/coursesdetailedview/${courseId}?refresh=true`);
    } else {
      router.back();
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-[#1e1e1e] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!exerciseData) {
    return (
      <div className="w-full h-screen bg-[#1e1e1e] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Failed to load exercise data.</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const exerciseInfo = exerciseData.exerciseInformation || {};

  return (
    <div className="w-full h-screen overflow-hidden">
      <CodeEditor
        exercise={exerciseData}
        courseId={courseId}
        courseName={courseName}
        nodeId={nodeId || exerciseData.context?.nodeId || ''}
        nodeName={nodeName || exerciseInfo.exerciseName || exerciseName}
        nodeType={nodeType || exerciseData.context?.nodeType || ''}
        subcategory={subcategory}
        category={category}
        hierarchy={hierarchy}
        skipSecurityModal={securityAck}
        onBack={handleBack}
        onCloseExercise={handleBack}
      />
    </div>
  );
};

export default function YouDoProgrammingPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen bg-[#1e1e1e] flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
        </div>
      }
    >
      <ProgrammingPageContent />
    </Suspense>
  );
}
