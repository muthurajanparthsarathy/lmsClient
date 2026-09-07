'use client';
import React, { useState, useEffect } from 'react';
import { ChevronRight, Calendar, Settings, X } from 'lucide-react';
import { fetchCourses, getAuthToken, handleApiError } from '../../../../apiServices/programcalender';
import ManualCalendarSetup from './ManualCalender';
import AutoCalendarSetup from './AutomaticCalender';
import DashboardLayoutlms from '@/app/programcoordinator/components/layout';

interface Course {
  _id: string;
  courseName: string;
  courseCode: string;
  courseLevel: string;
  courseDuration: string;
  clientName: string;
  serviceType: string;
  courseDescription: string;
}

interface ApiResponse {
  message: Array<{ key: string; value: string }>;
  data: Course[];
}

type CalendarType = 'manual' | 'auto' | null;

const ProgramCalendar: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [calendarType, setCalendarType] = useState<CalendarType>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Fetch courses from API
  useEffect(() => {
    const loadCourses = async () => {
      try {
        setLoading(true);
        const token = getAuthToken();
        
        if (!token) {
          throw new Error('Authentication token not found');
        }

        const response = await fetchCourses(token);
        setCourses(response.data || []);
        setError('');
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, []);

  const handleCourseSelect = (courseId: string) => {
    setSelectedCourse(courseId);
    if (courseId) {
      setShowModal(true);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedCourse('');
    setCalendarType(null);
  };

  const handleCalendarTypeSelect = (type: CalendarType) => {
    setCalendarType(type);
  };

  const handleBackToSelection = () => {
    setCalendarType(null);
  };

  const selectedCourseData = courses.find(course => course._id === selectedCourse);

  return (
    <DashboardLayoutlms>
      <div className="min-h-full p-4">
        <div className="w-full">
          {/* Breadcrumb */}
          <nav className="mb-4">
            <div className="flex items-center text-sm text-gray-600">
              <span className="hover:text-gray-800 cursor-pointer">Dashboard</span>
              <ChevronRight className="w-4 h-4 mx-2" />
              <span className="text-gray-900 font-medium">Program Calendar</span>
            </div>
          </nav>

          {/* Header - Course Selection */}
         <div className="bg-white rounded border p-3 mb-3">
  <div>
    <label htmlFor="course-select" className="block text-sm font-medium text-gray-700 mb-2">
      Select Course
    </label>
    
    {loading ? (
      <div className="animate-pulse h-9 bg-gray-200 rounded w-full"></div>
    ) : error ? (
      <div className="text-red-600 text-xs bg-red-50 p-2 rounded border border-red-200">
        Error: {error}
      </div>
    ) : (
      <>
        <select
          id="course-select"
          value={selectedCourse}
          onChange={(e) => handleCourseSelect(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          <option value="">Choose a course...</option>
          {courses.map((course) => (
            <option key={course._id} value={course._id}>
              {course.courseName} ({course.courseCode}) - {course.courseLevel} - {course.courseDuration} days
            </option>
          ))}
        </select>
        
        {courses.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            {courses.length} course{courses.length !== 1 ? 's' : ''} available
          </p>
        )}
      </>
    )}
  </div>
</div>

          {/* Full Screen Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-white z-50 overflow-auto">
              <div className="min-h-screen">
                {/* Header */}
                <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">
                        {calendarType === 'manual' ? 'Manual Calendar Set' : 
                         calendarType === 'auto' ? 'Auto Calendar Generation' : 
                         'Calendar Generation'}
                      </h1>
                      {selectedCourseData && (
                        <p className="text-gray-600 mt-1">
                          {selectedCourseData.courseName} ({selectedCourseData.courseCode})
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleModalClose}
                      className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  {!calendarType ? (
                    /* Calendar Type Selection */
                    <div className="max-w-4xl mx-auto">
                      <div className="text-center mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">
                          Choose Calendar Generation Method
                        </h2>
                        <p className="text-gray-600">
                          Select how you'd like to create the program calendar for this course
                        </p>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                        <button
                          onClick={() => handleCalendarTypeSelect('manual')}
                          className="group p-8 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 text-left"
                        >
                          <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-blue-100 group-hover:bg-blue-200 rounded-lg transition-colors">
                              <Settings className="w-8 h-8 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">Manual Setup</h3>
                              <p className="text-sm text-gray-500">Full control over scheduling</p>
                            </div>
                          </div>
                          <p className="text-gray-600">
                            Customize dates, times, and schedule manually with complete flexibility over the calendar structure.
                          </p>
                        </button>
                        
                        <button
                          onClick={() => handleCalendarTypeSelect('auto')}
                          className="group p-8 border-2 border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50 transition-all duration-200 text-left"
                        >
                          <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-green-100 group-hover:bg-green-200 rounded-lg transition-colors">
                              <Calendar className="w-8 h-8 text-green-600" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">Auto Generate</h3>
                              <p className="text-sm text-gray-500">Smart calendar creation</p>
                            </div>
                          </div>
                          <p className="text-gray-600">
                            Automatically generate calendar based on course duration and intelligent scheduling algorithms.
                          </p>
                        </button>
                      </div>
                    </div>
                  ) : calendarType === 'manual' ? (
                    <ManualCalendarSetup 
                      course={selectedCourseData!} 
                      onBack={handleBackToSelection}
                      onClose={handleModalClose}
                    />
                  ) : (
                    <AutoCalendarSetup 
                      course={selectedCourseData!} 
                      onBack={handleBackToSelection}
                      onClose={handleModalClose}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayoutlms>
  );
};

export default ProgramCalendar;