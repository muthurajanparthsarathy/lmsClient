'use client';
import React from 'react';
import { 
  BookOpen, Clock, Tag, Image, Users, 
  FileText, Settings, Calendar, User, GraduationCap, 
  Target, Layers, Monitor, Globe, Zap,
  Building
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface CourseDetailsPopupProps {
  course: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getResourceIcon = (resourceType: string) => {
  const type = resourceType.toLowerCase();
  if (type.includes('video')) return Monitor;
  if (type.includes('audio')) return Monitor;
  if (type.includes('text') || type.includes('document')) return FileText;
  if (type.includes('image') || type.includes('graphic')) return Image;
  if (type.includes('presentation') || type.includes('slide')) return Monitor;
  if (type.includes('ppt')) return FileText;
  if (type.includes('pdf')) return FileText;
  return Layers;
};

const getLevelConfig = (level: string) => {
  const levelLower = level.toLowerCase();
  if (levelLower.includes('beginner') || levelLower.includes('basic')) {
    return { color: 'bg-green-50 text-green-600 border-green-200' };
  }
  if (levelLower.includes('intermediate') || levelLower.includes('medium')) {
    return { color: 'bg-yellow-50 text-yellow-600 border-yellow-200' };
  }
  if (levelLower.includes('advanced') || levelLower.includes('expert')) {
    return { color: 'bg-red-50 text-red-600 border-red-200' };
  }
  return { color: 'bg-blue-50 text-blue-600 border-blue-200' };
};

const getServiceTypeConfig = (serviceType: string) => {
  const type = serviceType.toLowerCase();
  if (type.includes('online') || type.includes('virtual')) {
    return { icon: Globe, color: 'bg-blue-50 text-blue-600 border-blue-200' };
  }
  if (type.includes('classroom') || type.includes('face')) {
    return { icon: Users, color: 'bg-purple-50 text-purple-600 border-purple-200' };
  }
  if (type.includes('hybrid') || type.includes('blended')) {
    return { icon: Zap, color: 'bg-orange-50 text-orange-600 border-orange-200' };
  }
  return { icon: Settings, color: 'bg-gray-50 text-gray-600 border-gray-200' };
};

const getHierarchyLevelConfig = (index: number) => {
  const configs = [
    { color: 'bg-blue-50 text-blue-600 border-blue-200', label: 'Module', icon: '📚' },
    { color: 'bg-green-50 text-green-600 border-green-200', label: 'Submodule', icon: '📖' },
    { color: 'bg-purple-50 text-purple-600 border-purple-200', label: 'Topic', icon: '📝' },
    { color: 'bg-orange-50 text-orange-600 border-orange-200', label: 'Subtopic', icon: '📄' }
  ];
  return configs[index % 4];
};

const getDateString = (date: string | { $date: string }): string => {
  if (typeof date === 'string') {
    return new Date(date).toLocaleDateString('en-GB');
  } else if (date && typeof date === 'object' && '$date' in date) {
    return new Date(date.$date).toLocaleDateString('en-GB');
  }
  return '';
};

const getClientName = (course: any): string => {
  if (typeof course.clientName === 'string') {
    return course.clientName;
  }
  else if (course.clientName && typeof course.clientName === 'object' && '$oid' in course.clientName) {
    return `Client-${course.clientName.$oid.substring(0, 8)}`;
  }
  return 'Unknown Client';
};

export const CourseDetailsPopup: React.FC<CourseDetailsPopupProps> = ({ course, open, onOpenChange }) => {
  if (!course) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] max-h-[95vh] p-0 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-300">
        <DialogTitle className="sr-only">Course Details for {course.courseName}</DialogTitle>
        <div className="flex h-full animate-in slide-in-from-bottom-2 duration-500">
          {/* Left Column - Main Content */}
          <div className="flex-1 p-3 overflow-y-auto">
            <div className="space-y-3">
              {/* Course Header */}
              <div className="space-y-2 transform transition-all duration-300 hover:scale-[1.01]">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center animate-pulse">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-gray-900 leading-tight">{course.courseName}</h1>
                    <div className="flex items-center space-x-3 mt-1">
                      <div className="flex items-center space-x-1 text-xs text-gray-500">
                        <Tag className="h-3 w-3" />
                        <span>{course.courseCode}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-xs text-gray-500">
                        <span>Client:</span>
                        <span className="font-medium">{getClientName(course)}</span>
                      </div>
                      <div className={`px-2 py-0.5 rounded text-xs font-medium transition-colors duration-200 hover:scale-105 ${getLevelConfig(course.courseLevel).color}`}>
                        {course.courseLevel}
                      </div>
                      <div className="flex items-center space-x-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>Duration: <span className="font-medium">{course.courseDuration}</span></span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">Web development</span>
                  <span className="text-xs text-gray-500">Front end development</span>
                </div>
              </div>

              {/* Description */}
              <div className="bg-gray-50 rounded-md p-3 transition-all duration-300 hover:bg-gray-100 hover:shadow-sm">
                <h3 className="text-xs font-medium text-gray-700 mb-2 flex items-center">
                  <FileText className="h-3 w-3 mr-2 text-gray-500" />
                  Description
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {course.courseDescription || 'nothing'}
                </p>
              </div>

              {/* Resources & Structure */}
              <div className="bg-gray-50 rounded-md p-3 transition-all duration-300 hover:bg-gray-100 hover:shadow-sm">
                <h3 className="text-xs font-medium text-gray-700 mb-2 flex items-center">
                  <Layers className="h-3 w-3 mr-2 text-gray-500" />
                  Resources & Structure
                </h3>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-1">Resource Types:</h4>
                    <div className="flex flex-wrap gap-1">
                      {course.resourcesType.map((resource: string, index: number) => {
                        const ResourceIcon = getResourceIcon(resource);
                        return (
                          <div key={index} className="flex items-center space-x-1 px-2 py-1 bg-white border rounded-md text-xs transition-all duration-200 hover:shadow-sm hover:scale-105">
                            <ResourceIcon className="h-3 w-3 text-gray-500" />
                            <span className="text-gray-600">{resource}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-1">Course Hierarchy:</h4>
                    <div className="space-y-1">
                      {course.courseHierarchy.map((item: string, index: number) => {
                        const { color, label, icon } = getHierarchyLevelConfig(index);
                        return (
                          <div key={index} className="flex items-center space-x-2 group">
                            <div className={`flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium transition-all duration-200 group-hover:scale-105 ${color}`}>
                              <span>{icon}</span>
                              <span>{label}</span>
                            </div>
                            <span className="text-xs text-gray-700">{item}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Meta Information */}
              <div className="bg-gray-50 rounded-md p-3 transition-all duration-300 hover:bg-gray-100 hover:shadow-sm">
                <h3 className="text-xs font-medium text-gray-700 mb-2 flex items-center">
                  <Settings className="h-3 w-3 mr-2 text-gray-500" />
                  Meta Information
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="transition-all duration-200 hover:scale-105">
                    <h4 className="text-xs font-medium text-gray-500 mb-1">Created By:</h4>
                    <div className="flex items-center space-x-1">
                      <User className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-700">{course.createdBy}</span>
                    </div>
                  </div>
                  <div className="transition-all duration-200 hover:scale-105">
                    <h4 className="text-xs font-medium text-gray-500 mb-1">Created:</h4>
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-700">{getDateString(course.createdAt)}</span>
                    </div>
                  </div>
                  <div className="transition-all duration-200 hover:scale-105">
                    <h4 className="text-xs font-medium text-gray-500 mb-1">Updated By:</h4>
                    <div className="flex items-center space-x-1">
                      <User className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-700">{course.updatedBy}</span>
                    </div>
                  </div>
                  <div className="transition-all duration-200 hover:scale-105">
                    <h4 className="text-xs font-medium text-gray-500 mb-1">Updated:</h4>
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-700">{getDateString(course.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Pedagogy Sections */}
          <div className="w-72 bg-gray-50 p-3 space-y-3 overflow-y-auto">
            {/* I Do */}
            <div className="bg-white rounded-md p-3 transition-all duration-300 hover:shadow-md hover:bg-blue-50/30 transform hover:scale-[1.02]">
              <h3 className="text-xs font-medium text-blue-700 mb-2 flex items-center">
                <div className="w-5 h-5 bg-blue-100 rounded mr-2 flex items-center justify-center animate-pulse">
                  <GraduationCap className="h-3 w-3 text-blue-600" />
                </div>
                I Do (Instructor)
              </h3>
              <div className="space-y-1">
                {course.I_Do && course.I_Do.length > 0 ? (
                  course.I_Do.map((item: string, index: number) => (
                    <div key={index} className="flex items-start space-x-2 group">
                      <div className="w-1 h-1 bg-blue-500 rounded-full mt-1.5 flex-shrink-0 group-hover:scale-150 transition-transform duration-200"></div>
                      <span className="text-xs text-gray-700 leading-relaxed">{item}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-gray-400 italic">No instructor activities defined</span>
                )}
              </div>
            </div>

            {/* We Do */}
            <div className="bg-white rounded-md p-3 transition-all duration-300 hover:shadow-md hover:bg-purple-50/30 transform hover:scale-[1.02]">
              <h3 className="text-xs font-medium text-purple-700 mb-2 flex items-center">
                <div className="w-5 h-5 bg-purple-100 rounded mr-2 flex items-center justify-center animate-pulse">
                  <Users className="h-3 w-3 text-purple-600" />
                </div>
                We Do (Collaborative)
              </h3>
              <div className="space-y-1">
                {course.We_Do && course.We_Do.length > 0 ? (
                  course.We_Do.map((item: string, index: number) => (
                    <div key={index} className="flex items-start space-x-2 group">
                      <div className="w-1 h-1 bg-purple-500 rounded-full mt-1.5 flex-shrink-0 group-hover:scale-150 transition-transform duration-200"></div>
                      <span className="text-xs text-gray-700 leading-relaxed">{item}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-gray-400 italic">No collaborative activities defined</span>
                )}
              </div>
            </div>

            {/* You Do */}
            <div className="bg-white rounded-md p-3 transition-all duration-300 hover:shadow-md hover:bg-green-50/30 transform hover:scale-[1.02]">
              <h3 className="text-xs font-medium text-green-700 mb-2 flex items-center">
                <div className="w-5 h-5 bg-green-100 rounded mr-2 flex items-center justify-center animate-pulse">
                  <Target className="h-3 w-3 text-green-600" />
                </div>
                You Do (Student)
              </h3>
              <div className="space-y-1">
                {course.You_Do && course.You_Do.length > 0 ? (
                  course.You_Do.map((item: string, index: number) => (
                    <div key={index} className="flex items-start space-x-2 group">
                      <div className="w-1 h-1 bg-green-500 rounded-full mt-1.5 flex-shrink-0 group-hover:scale-150 transition-transform duration-200"></div>
                      <span className="text-xs text-gray-700 leading-relaxed">{item}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-gray-400 italic">No student activities defined</span>
                )}
              </div>
            </div>

            {/* Course Logo */}
            <div className="bg-white rounded-md p-3 transition-all duration-300 hover:shadow-md transform hover:scale-[1.02]">
              <h3 className="text-xs font-medium text-gray-700 mb-2 flex items-center">
                <div className="w-5 h-5 bg-gray-100 rounded mr-2 flex items-center justify-center">
                  <Image className="h-3 w-3 text-gray-600" />
                </div>
                Course Logo
              </h3>
              <div className="flex justify-center">
                {course.courseImage ? (
                  <img
                    src={course.courseImage}
                    alt={course.courseName}
                    className="w-12 h-12 rounded-md border object-cover transition-all duration-300 hover:scale-110 hover:shadow-md"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-100 rounded-md border-2 border-dashed border-gray-300 flex items-center justify-center transition-all duration-300 hover:bg-gray-200">
                    <Image className="h-6 w-6 text-gray-400" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};