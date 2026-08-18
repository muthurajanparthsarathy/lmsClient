// app/lms/pages/courses/feedback/page.tsx
//
// Dedicated student feedback route — opened in a new tab from the course
// list's Feedback button (no modal on the list anymore). Loads the course's
// published & active feedback form and shows it; closing returns to the
// course list (or closes the tab it was opened into).
'use client';

import React, { Suspense, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Poppins } from 'next/font/google';
import { FeedbackStudentModal } from '../../../component/student/FeedbackStudentModal';
import { useGetAllFeedback } from '../../coursestructure/feedback/hooks/useFeedback';
import { Loading } from '@/components/loading-ui/loading';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export default function StudentFeedbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loading size="size-8" />
        </div>
      }
    >
      <StudentFeedbackContent />
    </Suspense>
  );
}

function StudentFeedbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const courseId = searchParams.get('courseId') || '';

  const { data: feedbacks, isLoading } = useGetAllFeedback(courseId || undefined);

  // The form students answer — the course's published & active feedback.
  const feedback = useMemo(
    () =>
      Array.isArray(feedbacks)
        ? feedbacks.find((fb: any) => fb.isPublished && fb.isActive) || null
        : null,
    [feedbacks]
  );

  // Browser tab shows which feedback form this is.
  useEffect(() => {
    if ((feedback as any)?.feedbackTitle) {
      document.title = (feedback as any).feedbackTitle;
    }
  }, [feedback]);

  const handleClose = () => {
    // Opened in its own tab from the course list — close it; fall back to
    // navigating to the course list when the tab can't be closed.
    if (typeof window !== 'undefined' && window.opener) {
      window.close();
    } else {
      router.push('/lms/pages/courses');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loading size="size-8" />
      </div>
    );
  }

  if (!courseId || !feedback) {
    return (
      <div className={`${poppins.className} min-h-screen flex items-center justify-center bg-gray-50 p-4`}>
        <div className="bg-white rounded-xl px-8 py-10 text-center max-w-sm w-full shadow-lg border border-gray-200">
          <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
          <h3 className="text-[15px] font-semibold text-gray-900 mb-1.5">
            No feedback available
          </h3>
          <p className="text-[12px] text-gray-500">
            {courseId
              ? 'There is no active feedback form for this course right now.'
              : 'No course was selected — open feedback from the course list.'}
          </p>
          <button
            onClick={handleClose}
            className="mt-5 inline-flex items-center gap-1.5 h-8 px-3.5 text-[12px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <FeedbackStudentModal
      feedback={feedback}
      isOpen={true}
      onClose={handleClose}
      courseId={courseId}
      variant="page"
    />
  );
}
