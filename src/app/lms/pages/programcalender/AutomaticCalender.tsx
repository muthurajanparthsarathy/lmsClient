import React, { useState } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, User, Settings, Zap, CheckCircle } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_IDS } from '@/app/lms/pages/usermanagement/components/permissions/index';

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

interface AutoCalendarSetupProps {
  course: Course;
  onBack: () => void;
  onClose: () => void;
}

interface AutoSettings {
  startDate: string;
  excludeWeekends: boolean;
  dailyStartTime: string;
  dailyEndTime: string;
  lunchBreakDuration: number;
  defaultLocation: string;
  defaultInstructor: string;
  sessionDuration: number; // hours per day
  excludedDates: string[];
  includeSaturday: boolean;
  includeSunday: boolean;
}

const AutoCalendarSetup: React.FC<AutoCalendarSetupProps> = ({ course, onBack, onClose }) => {
  // Program-calendar permissions — Add covers generate/save + excluded-date
  // add; Delete covers per-row remove.
  const { can } = usePermissions();
  const canAdd = can(PERMISSION_IDS.ADMIN_PROGRAM_CALENDAR, 'Add');
  const canDelete = can(PERMISSION_IDS.ADMIN_PROGRAM_CALENDAR, 'Delete');

  const [currentStep, setCurrentStep] = useState<'settings' | 'preview' | 'generated'>('settings');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [autoSettings, setAutoSettings] = useState<AutoSettings>({
    startDate: '',
    excludeWeekends: true,
    dailyStartTime: '09:00',
    dailyEndTime: '17:00',
    lunchBreakDuration: 60,
    defaultLocation: '',
    defaultInstructor: '',
    sessionDuration: 8,
    excludedDates: [],
    includeSaturday: false,
    includeSunday: false
  });

  const [generatedSessions, setGeneratedSessions] = useState<any[]>([]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate sessions based on settings
    const sessions = generateCalendarSessions();
    setGeneratedSessions(sessions);
    setCurrentStep('preview');
    setIsGenerating(false);
  };

  const generateCalendarSessions = () => {
    const sessions = [];
    const startDate = new Date(autoSettings.startDate);
    const duration = parseInt(course.courseDuration);
    let currentDate = new Date(startDate);
    let sessionCount = 0;

    while (sessionCount < duration) {
      // Skip weekends if excluded
      if (autoSettings.excludeWeekends && (currentDate.getDay() === 0 || currentDate.getDay() === 6)) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Skip excluded dates
      const dateString = currentDate.toISOString().split('T')[0];
      if (autoSettings.excludedDates.includes(dateString)) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      sessionCount++;
      sessions.push({
        id: sessionCount.toString(),
        date: dateString,
        dayName: currentDate.toLocaleDateString('en-US', { weekday: 'long' }),
        startTime: autoSettings.dailyStartTime,
        endTime: autoSettings.dailyEndTime,
        sessionTitle: `Day ${sessionCount} - ${getSessionTopic(sessionCount, course.courseLevel)}`,
        location: autoSettings.defaultLocation,
        instructor: autoSettings.defaultInstructor,
        duration: autoSettings.sessionDuration,
        lunchBreak: autoSettings.lunchBreakDuration > 0
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return sessions;
  };

  const getSessionTopic = (day: number, level: string) => {
    const topics = {
      'Beginner': [
        'Introduction & Fundamentals',
        'Basic Concepts',
        'Core Principles',
        'Hands-on Practice',
        'Advanced Basics',
        'Project Work',
        'Review & Assessment'
      ],
      'Intermediate': [
        'Advanced Concepts',
        'Complex Applications',
        'Case Studies',
        'Practical Implementation',
        'Problem Solving',
        'Project Development',
        'Integration & Testing'
      ],
      'Advanced': [
        'Expert-level Topics',
        'Advanced Techniques',
        'Industry Best Practices',
        'Complex Problem Solving',
        'Research & Development',
        'Capstone Project',
        'Final Assessment'
      ]
    };

    const levelTopics = topics[level as keyof typeof topics] || topics['Beginner'];
    return levelTopics[Math.min(day - 1, levelTopics.length - 1)];
  };

  const handleSaveCalendar = () => {
    console.log('Saving auto-generated calendar:', { course, autoSettings, generatedSessions });
    setCurrentStep('generated');
    
    setTimeout(() => {
      alert('Auto-generated calendar has been created successfully!');
      onClose();
    }, 1500);
  };

  const addExcludedDate = (date: string) => {
    if (date && !autoSettings.excludedDates.includes(date)) {
      setAutoSettings({
        ...autoSettings,
        excludedDates: [...autoSettings.excludedDates, date]
      });
    }
  };

  const removeExcludedDate = (date: string) => {
    setAutoSettings({
      ...autoSettings,
      excludedDates: autoSettings.excludedDates.filter(d => d !== date)
    });
  };

  if (currentStep === 'generated') {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="mb-6">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Calendar Generated Successfully!</h2>
          <p className="text-gray-600">Your program calendar has been created and saved.</p>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-green-800">Total Sessions:</span>
              <span className="ml-2 text-green-700">{generatedSessions.length}</span>
            </div>
            <div>
              <span className="font-medium text-green-800">Duration:</span>
              <span className="ml-2 text-green-700">{course.courseDuration} days</span>
            </div>
            <div>
              <span className="font-medium text-green-800">Start Date:</span>
              <span className="ml-2 text-green-700">{autoSettings.startDate}</span>
            </div>
            <div>
              <span className="font-medium text-green-800">Daily Hours:</span>
              <span className="ml-2 text-green-700">{autoSettings.sessionDuration} hours</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Selection
      </button>

      {/* Course Info Card */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Auto-Generated Calendar for {course.courseName}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-green-700 font-medium">Duration:</span>
            <span className="ml-2 text-green-800">{course.courseDuration} days</span>
          </div>
          <div>
            <span className="text-green-700 font-medium">Level:</span>
            <span className="ml-2 text-green-800">{course.courseLevel}</span>
          </div>
          <div>
            <span className="text-green-700 font-medium">Client:</span>
            <span className="ml-2 text-green-800">{course.clientName}</span>
          </div>
          <div>
            <span className="text-green-700 font-medium">Service:</span>
            <span className="ml-2 text-green-800">{course.serviceType}</span>
          </div>
        </div>
      </div>

      {currentStep === 'settings' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Settings Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-24">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Generation Settings
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={autoSettings.startDate}
                    onChange={(e) => setAutoSettings({...autoSettings, startDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Daily Start Time
                  </label>
                  <input
                    type="time"
                    value={autoSettings.dailyStartTime}
                    onChange={(e) => setAutoSettings({...autoSettings, dailyStartTime: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Daily End Time
                  </label>
                  <input
                    type="time"
                    value={autoSettings.dailyEndTime}
                    onChange={(e) => setAutoSettings({...autoSettings, dailyEndTime: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Default Location
                  </label>
                  <input
                    type="text"
                    value={autoSettings.defaultLocation}
                    onChange={(e) => setAutoSettings({...autoSettings, defaultLocation: e.target.value})}
                    placeholder="Training room, building, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <User className="w-4 h-4 inline mr-1" />
                    Default Instructor
                  </label>
                  <input
                    type="text"
                    value={autoSettings.defaultInstructor}
                    onChange={(e) => setAutoSettings({...autoSettings, defaultInstructor: e.target.value})}
                    placeholder="Instructor name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lunch Break (minutes)
                  </label>
                  <select
                    value={autoSettings.lunchBreakDuration}
                    onChange={(e) => setAutoSettings({...autoSettings, lunchBreakDuration: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value={0}>No lunch break</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Schedule Options</h4>
                  
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={autoSettings.excludeWeekends}
                        onChange={(e) => setAutoSettings({...autoSettings, excludeWeekends: e.target.checked})}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Exclude weekends</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={autoSettings.includeSaturday}
                        onChange={(e) => setAutoSettings({...autoSettings, includeSaturday: e.target.checked})}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        disabled={autoSettings.excludeWeekends}
                      />
                      <span className="ml-2 text-sm text-gray-700">Include Saturdays</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={autoSettings.includeSunday}
                        onChange={(e) => setAutoSettings({...autoSettings, includeSunday: e.target.checked})}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        disabled={autoSettings.excludeWeekends}
                      />
                      <span className="ml-2 text-sm text-gray-700">Include Sundays</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Excluded Dates and Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Excluded Dates</h3>
              <p className="text-sm text-gray-600 mb-4">
                Add dates to exclude from the automatic scheduling (holidays, unavailable days, etc.)
              </p>
              
              <div className="flex gap-2 mb-4">
                <input
                  type="date"
                  id="exclude-date"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  min={autoSettings.startDate}
                />
                {canAdd && (
                  <button
                    onClick={() => {
                      const input = document.getElementById('exclude-date') as HTMLInputElement;
                      if (input.value) {
                        addExcludedDate(input.value);
                        input.value = '';
                      }
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Add
                  </button>
                )}
              </div>
              
              {autoSettings.excludedDates.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Excluded Dates:</h4>
                  <div className="flex flex-wrap gap-2">
                    {autoSettings.excludedDates.map((date) => (
                      <span
                        key={date}
                        className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-1 rounded text-xs"
                      >
                        {new Date(date).toLocaleDateString()}
                        {canDelete && (
                          <button
                            onClick={() => removeExcludedDate(date)}
                            className="text-red-600 hover:text-red-800"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Calendar Preview Summary */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Calendar Preview</h3>
              
              {autoSettings.startDate ? (
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Sessions:</span>
                      <span className="font-medium">{course.courseDuration} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Start Date:</span>
                      <span className="font-medium">{new Date(autoSettings.startDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Daily Duration:</span>
                      <span className="font-medium">{autoSettings.sessionDuration} hours</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Daily Time:</span>
                      <span className="font-medium">{autoSettings.dailyStartTime} - {autoSettings.dailyEndTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Lunch Break:</span>
                      <span className="font-medium">{autoSettings.lunchBreakDuration} minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Weekends:</span>
                      <span className="font-medium">{autoSettings.excludeWeekends ? 'Excluded' : 'Included'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  Please select a start date to see the calendar preview
                </p>
              )}
            </div>

            {/* Generate Button */}
            {canAdd && (
              <div className="mt-6">
                <button
                  onClick={handleGenerate}
                  disabled={!autoSettings.startDate || isGenerating}
                  className="w-full bg-green-600 text-white py-3 px-6 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Generating Calendar...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Generate Calendar
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {currentStep === 'preview' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">Generated Calendar Preview</h3>
            <button
              onClick={() => setCurrentStep('settings')}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              ← Back to Settings
            </button>
          </div>

          <div className="grid gap-4">
            {generatedSessions.map((session, index) => (
              <div key={session.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{session.sessionTitle}</h4>
                  <span className="text-sm text-gray-500">{session.dayName}</span>
                </div>
                
                <div className="grid md:grid-cols-4 gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(session.date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {session.startTime} - {session.endTime}
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {session.location || 'TBD'}
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {session.instructor || 'TBD'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6">
            {canAdd && (
              <button
                onClick={handleSaveCalendar}
                className="flex-1 bg-green-600 text-white py-3 px-6 rounded-md hover:bg-green-700 transition-colors font-medium"
              >
                Save Generated Calendar
              </button>
            )}
            <button
              onClick={() => setCurrentStep('settings')}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Modify Settings
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoCalendarSetup;