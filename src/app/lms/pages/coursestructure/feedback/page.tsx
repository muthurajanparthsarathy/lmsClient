// app/lms/pages/coursestructure/feedback/page.tsx

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Poppins } from 'next/font/google';
import Link from 'next/link';
import {
  Home,
  BookMarked,
  MessageSquare,
  AlertCircle,
  ArrowLeft,
  X,
} from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import DashboardLayout from '../../../component/layout';
import { StaffLayout } from '../../../component/stafflayout/staff-layout';
import { Feedback } from './types/feedback';
import { FeedbackList } from './feedbackComponts/feedbackList';
import { FeedbackForm } from './feedbackComponts/feedbackForm';
import { useCourseRosterQuery } from '@/queries/courseRoster';
import { useGetAllFeedback } from './hooks/useFeedback';
import { getUserRole } from '../coursestructurecomponents/types/util';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins',
});

type CourseData = {
  _id: string;
  courseName: string;
  courseCode?: string;
};

export default function FeedbackPage() {
  return (
    <Suspense
      fallback={
        <div className={`${poppins.className} flex justify-center items-center h-screen bg-white`}>
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
        </div> 
      }
    >
      <FeedbackPageContent />
    </Suspense>
  );
}

function FeedbackPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const courseId = searchParams.get('courseId');

  const [userRole, setUserRole] = useState<string>('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState<Feedback | null>(null);
  // Shared roster entry — the header only needs courseName / courseCode /
  // mappingId, all of which ride it.
  const { data: courseData = null } = useCourseRosterQuery(courseId || '');

  // Feedback forms already created for this course — used to show the new
  // form's sequence number (e.g. "Feedback #4" when 3 already exist).
  const { data: courseFeedbacks } = useGetAllFeedback(courseId || undefined);
  const feedbackNumber = (() => {
    const list = Array.isArray(courseFeedbacks) ? courseFeedbacks : [];
    if (editingFeedback) {
      const idx = list.findIndex((f: any) => f._id === editingFeedback._id);
      return idx >= 0 ? idx + 1 : list.length || 1;
    }
    return list.length + 1;
  })();

  useEffect(() => {
    setUserRole(getUserRole());
  }, []);

  // Lock body scroll while modal open + close on Escape
  useEffect(() => {
    if (!showFormModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFormModal();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [showFormModal]);

  const openCreate = () => {
    setEditingFeedback(null);
    setShowFormModal(true);
  };

  const openEdit = (feedback: Feedback) => {
    setEditingFeedback(feedback);
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingFeedback(null);
  };

  const pageContent = (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`${poppins.className} h-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden`}
    >
      {/* Title row — ← returns to Course Setup (deep-linked into this
          course's mapping when known), exactly like the Enrollment page.
          The old breadcrumb's Dashboard link exited the flow entirely. */}
      <div className="px-4 pt-2.5 pb-2 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={() => {
            const mid = String((courseData as any)?.mappingId || '');
            router.push(mid ? `/lms/pages/coursestructure?openMappingId=${mid}` : '/lms/pages/coursestructure');
          }}
          title="Back to this course's hierarchy"
          className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900 dark:text-white tracking-tight leading-tight">
            Feedback Forms
          </h1>
          {courseData && (
            <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
              <span className="font-medium text-gray-400 dark:text-gray-500">Course:</span>{' '}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {courseData.courseName}
              </span>
              {courseData.courseCode && (
                <span className="ml-1.5 text-gray-400 dark:text-gray-500">
                  · {courseData.courseCode}
                </span>
              )}
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto px-4 py-4">
        {!courseId ? (
          <div className="max-w-md mx-auto mt-16 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Course ID Required
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Please select a course to manage its feedback forms.
            </p>
            <Link
              href="/lms/pages/coursestructure"
              className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Go to Course Management
            </Link>
          </div>
        ) : (
          <FeedbackList courseId={courseId} onEdit={openEdit} onCreate={openCreate} />
        )}
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showFormModal && courseId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={`${poppins.className} fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm`}
            onClick={closeFormModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header — single compact row: title · course */}
              <div className="flex items-center justify-between gap-3 px-5 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
                <div className="min-w-0 flex items-baseline gap-2">
                  <h2 className="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight shrink-0">
                    {editingFeedback ? 'Edit Feedback Form' : 'Create Feedback Form'}
                  </h2>
                  {courseData && (
                    <span className="text-[11px] truncate">
                      <span className="text-gray-300 dark:text-gray-600 mx-1">|</span>
                      <span className="font-medium text-gray-400 dark:text-gray-500">Course Name:</span>{' '}
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {courseData.courseName}
                      </span>
                      {courseData.courseCode && (
                        <span className="text-gray-400 dark:text-gray-500"> · {courseData.courseCode}</span>
                      )}
                    </span>
                  )}
                  <span className="inline-flex items-center h-4 px-1.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-[10px] font-semibold shrink-0">
                    Feedback #{feedbackNumber}
                  </span>
                </div>
                <button
                  onClick={closeFormModal}
                  aria-label="Close"
                  className="p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body — the form owns the layout: fixed step sidebar on the
                  left, scrolling step content on the right. */}
              <div className="flex-1 min-h-0 overflow-hidden px-5 py-4 bg-white dark:bg-gray-900 flex flex-col">
                <FeedbackForm
                  courseId={courseId}
                  feedback={editingFeedback}
                  onSuccess={closeFormModal}
                  onCancel={closeFormModal}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  if (
    userRole === 'admin' ||
    userRole === 'ldhead' ||
    userRole === 'subhead' ||
    userRole === 'programcoordinator'
  ) {
    return <DashboardLayout>{pageContent}</DashboardLayout>;
  }

  return <StaffLayout>{pageContent}</StaffLayout>;
}
