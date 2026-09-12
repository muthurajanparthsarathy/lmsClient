"use client"
import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Eye, ChevronLeft, ChevronRight, Home, Users, Filter, X, Check } from 'lucide-react';
import DashboardLayout from '@/app/lms/component/layout';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

// Define types
interface Course {
  id: string;
  name: string;
  category: 'Stack' | 'Frontend' | 'Fullstack';
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: 'Male' | 'Female' | 'Other';
  degree: string;
  department: string;
  section: string;
  batch: string;
  year: number;
  institution: string;
  allocatedCourse: string | null;
}

// Multi-select dropdown component
interface MultiSelectProps {
  label: string;
  options: string[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder?: string;
}

const MultiSelectDropdown: React.FC<MultiSelectProps> = ({
  label,
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select options..."
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCheckboxChange = (option: string) => {
    const newSelection = selectedValues.includes(option)
      ? selectedValues.filter(val => val !== option)
      : [...selectedValues, option];
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedValues.length === options.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange([...options]);
    }
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  const removeSelected = (option: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange(selectedValues.filter(val => val !== option));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <div className="flex items-center gap-2 flex-wrap">
            {selectedValues.length === 0 ? (
              <span className="text-gray-500">{placeholder}</span>
            ) : (
              <div className="flex items-center gap-1 flex-wrap">
                {selectedValues.slice(0, 2).map((value) => (
                  <span
                    key={value}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded"
                  >
                    {value}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => removeSelected(value, e)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          removeSelected(value, e as any);
                        }
                      }}
                      className="hover:text-blue-600 cursor-pointer focus:outline-none"
                    >
                      <X size={12} />
                    </span>
                  </span>
                ))}
                {selectedValues.length > 2 && (
                  <span className="text-xs text-gray-600">
                    +{selectedValues.length - 2} more
                  </span>
                )}
              </div>
            )}
          </div>
          <ChevronRight
            size={16}
            className={`transform transition-transform ${isOpen ? 'rotate-90' : ''}`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
            <div className="p-2 border-b border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {selectedValues.length === options.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs text-gray-600 hover:text-gray-800"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-1">
                {options.map((option) => (
                  <label
                    key={option}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedValues.includes(option)}
                      onChange={() => handleCheckboxChange(option)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{option}</span>
                    {selectedValues.includes(option) && (
                      <Check size={14} className="text-blue-600 ml-auto" />
                    )}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Available courses
const availableCourses: Course[] = [
  { id: 'MEAN', name: 'MEAN Stack', category: 'Stack', duration: '6m', level: 'Intermediate' },
  { id: 'MERN', name: 'MERN Stack', category: 'Stack', duration: '6m', level: 'Intermediate' },
  { id: 'JAVA_FULL', name: 'Java Full Stack', category: 'Fullstack', duration: '8m', level: 'Advanced' },
  { id: 'PYTHON_FULL', name: 'Python Full Stack', category: 'Fullstack', duration: '7m', level: 'Intermediate' },
  { id: 'FRONTEND', name: 'Frontend Dev', category: 'Frontend', duration: '4m', level: 'Beginner' },
  { id: 'FULL_STACK', name: 'Full Stack Web', category: 'Fullstack', duration: '9m', level: 'Advanced' },
  { id: 'MEAN_ADV', name: 'MEAN Advanced', category: 'Stack', duration: '3m', level: 'Advanced' },
  { id: 'REACT', name: 'React Specialist', category: 'Frontend', duration: '3m', level: 'Intermediate' },
];

const computerDegrees = ['B.Tech CSE', 'B.E CSE', 'M.Tech CSE', 'B.Sc CS', 'M.Sc CS', 'BCA', 'MCA', 'B.Tech IT', 'M.Tech IT'];
const computerDepartments = ['Computer Science', 'IT', 'Computer Engg', 'Software Engg', 'Data Science', 'AI', 'Cyber Security'];
const institutions = ['Knowledge Institute of Technology (KIOT)', 'Karpagam College of Engineering', 'RVS College of Engineering'];

const generateUsers = (): User[] => {
  const firstNames = ['John', 'Jane', 'Robert', 'Alice', 'David', 'Emily', 'Michael', 'Sarah', 'James', 'Emma', 'William', 'Olivia', 'Daniel', 'Sophia', 'Matthew', 'Ava', 'Christopher', 'Isabella', 'Andrew', 'Mia'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
  
  return Array.from({ length: 20 }, (_, index) => {
    const firstName = firstNames[index];
    const lastName = lastNames[index];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@student.edu`;
    const phone = `+91 ${9000000000 + index}`;
    const gender = index % 2 === 0 ? 'Male' : 'Female';
    const degree = computerDegrees[Math.floor(Math.random() * computerDegrees.length)];
    const department = computerDepartments[Math.floor(Math.random() * computerDepartments.length)];
    const section = String.fromCharCode(65 + Math.floor(Math.random() * 3));
    const batchStart = 2020 + Math.floor(Math.random() * 4);
    const batch = `${batchStart}-${batchStart + 4}`;
    const year = batchStart + 1 + Math.floor(Math.random() * 3);
    const institution = institutions[Math.floor(Math.random() * institutions.length)];
    const randomCourse = availableCourses[Math.floor(Math.random() * availableCourses.length)];
    
    return {
      id: index + 1,
      firstName,
      lastName,
      email,
      phone,
      gender,
      degree,
      department,
      section,
      batch,
      year,
      institution,
      allocatedCourse: randomCourse.id
    };
  });
};

const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>(generateUsers());
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 8;

  // Multi-select filter states
  const [selectedInstitutions, setSelectedInstitutions] = useState<string[]>([]);
  const [selectedDegrees, setSelectedDegrees] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);

  // Extract unique values for filters
  const degrees = Array.from(new Set(users.map(user => user.degree)));
  const departments = Array.from(new Set(users.map(user => user.department)));
  const years = Array.from(new Set(users.map(user => user.year.toString()))).sort((a, b) => parseInt(b) - parseInt(a));
  const batches = Array.from(new Set(users.map(user => user.batch)));
  const institutionList = Array.from(new Set(users.map(user => user.institution)));
  const courses = Array.from(new Set(availableCourses.map(course => course.name)));

  // Calculate statistics
  const totalStudents = users.length;
  const activeStudents = users.filter(user => user.allocatedCourse !== null).length;
  const uniqueInstitutions = institutionList.length;
  const coursesAllocated = users.filter(user => user.allocatedCourse !== null).length;

  // Filter users
  const filteredUsers = users.filter(user => {
    // Check if user matches ALL selected filters (AND logic across different filter types)
    const institutionMatch = selectedInstitutions.length === 0 || selectedInstitutions.includes(user.institution);
    const degreeMatch = selectedDegrees.length === 0 || selectedDegrees.includes(user.degree);
    const departmentMatch = selectedDepartments.length === 0 || selectedDepartments.includes(user.department);
    const yearMatch = selectedYears.length === 0 || selectedYears.includes(user.year.toString());
    const batchMatch = selectedBatches.length === 0 || selectedBatches.includes(user.batch);
    
    const courseMatch = selectedCourses.length === 0 || 
      (user.allocatedCourse && selectedCourses.includes(
        availableCourses.find(c => c.id === user.allocatedCourse)?.name || ''
      ));
    
    return institutionMatch && degreeMatch && departmentMatch && 
           yearMatch && batchMatch && courseMatch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);

  const clearAllFilters = () => {
    setSelectedInstitutions([]);
    setSelectedDegrees([]);
    setSelectedDepartments([]);
    setSelectedYears([]);
    setSelectedBatches([]);
    setSelectedCourses([]);
    setCurrentPage(1);
  };

  const deleteUser = (id: number) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      setUsers(prev => prev.filter(user => user.id !== id));
      if (currentUsers.length === 1 && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      }
    }
  };

  const viewUserDetails = (id: number) => {
    const user = users.find(u => u.id === id);
    if (user) {
      const courseName = user.allocatedCourse ? 
        availableCourses.find(c => c.id === user.allocatedCourse)?.name : 'No course allocated';
      
      alert(`Student Details:\n\nName: ${user.firstName} ${user.lastName}\nEmail: ${user.email}\nPhone: ${user.phone}\nInstitution: ${user.institution}\nDegree: ${user.degree}\nDepartment: ${user.department}\nAllocated Course: ${courseName}`);
    }
  };

  const getUserCourse = (userId: number): Course | null => {
    const user = users.find(u => u.id === userId);
    if (!user || !user.allocatedCourse) return null;
    return availableCourses.find(c => c.id === user.allocatedCourse) || null;
  };

  const getCourseStats = () => {
    const stats: { [key: string]: number } = {};
    availableCourses.forEach(course => {
      stats[course.name] = users.filter(user => user.allocatedCourse === course.id).length;
    });
    return stats;
  };

  const courseStats = getCourseStats();

  // Pagination handlers
  const nextPage = () => currentPage < totalPages && setCurrentPage(prev => prev + 1);
  const prevPage = () => currentPage > 1 && setCurrentPage(prev => prev - 1);
  const goToPage = (page: number) => setCurrentPage(page);

  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
      const leftBound = Math.max(2, currentPage - 1);
      const rightBound = Math.min(totalPages - 1, currentPage + 1);
      
      pageNumbers.push(1);
      if (leftBound > 2) pageNumbers.push('...');
      for (let i = leftBound; i <= rightBound; i++) pageNumbers.push(i);
      if (rightBound < totalPages - 1) pageNumbers.push('...');
      pageNumbers.push(totalPages);
    }
    
    return pageNumbers;
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-white-50 p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header with Breadcrumbs */}
          <div className="mb-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/lms/pages/admindashboard" className="text-xs sm:text-sm text-gray-600 hover:text-indigo-600">
                    Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-gray-400" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs sm:text-sm font-medium text-indigo-600">Student Management</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-4">
              <div>
                <h1 className="text-xl font-bold text-gray-800">Student Management</h1>
                <p className="text-sm text-gray-600 mt-1">Manage student records and course allocations</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Filter size={16} />
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                </button>
                <div className="text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg">
                  Total: <span className="font-bold">{users.length}</span> students
                </div>
              </div>
            </div>
          </div>

          {/* Statistics Cards - CORRECTED DATA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* All Students Card */}
            <div className="bg-none border border-gray-300 rounded-lg p-4">
              <div className="flex items-center space-x-1">
                <div className="rounded-md p-2 bg-blue-50">
                  <Users size={16} className="text-blue-600" />
                </div>
                <div>
                  <div className="text-gray-900 text-lg font-semibold">
                    {totalStudents}
                  </div>
                  <div className="text-gray-500 text-xs">All registered users</div>
                </div>
              </div>
            </div>

            {/* Active Students Card */}
            <div className="bg-none border border-gray-300 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="rounded-md p-2 bg-green-50">
                  <Users size={16} className="text-green-600" />
                </div>
                <div>
                  <div className="text-gray-900 text-lg font-semibold">
                    {activeStudents}
                  </div>
                  <div className="text-gray-500 text-xs">Active</div>
                </div>
              </div>
            </div>

            {/* Institutions Card */}
            <div className="bg-none border border-gray-300 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="rounded-md p-2 bg-purple-50">
                  <Home size={16} className="text-purple-600" />
                </div>
                <div>
                  <div className="text-gray-900 text-lg font-semibold">
                    {uniqueInstitutions}
                  </div>
                  <div className="text-gray-500 text-xs">Institutions</div>
                </div>
              </div>
            </div>

            {/* Courses Allocated Card */}
            <div className="bg-none border border-gray-300 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="rounded-md p-2 bg-amber-50">
                  <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"></path>
                  </svg>
                </div>
                <div>
                  <div className="text-gray-900 text-lg font-semibold">
                    {coursesAllocated}
                  </div>
                  <div className="text-gray-500 text-xs">Courses allocated</div>
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible Filters with Multi-select */}
          {showFilters && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  <X size={12} />
                  Clear all
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <MultiSelectDropdown
                  label="Institutions"
                  options={institutionList}
                  selectedValues={selectedInstitutions}
                  onSelectionChange={setSelectedInstitutions}
                  placeholder="Select institutions..."
                />

                <MultiSelectDropdown
                  label="Degrees"
                  options={degrees}
                  selectedValues={selectedDegrees}
                  onSelectionChange={setSelectedDegrees}
                  placeholder="Select degrees..."
                />

                <MultiSelectDropdown
                  label="Departments"
                  options={departments}
                  selectedValues={selectedDepartments}
                  onSelectionChange={setSelectedDepartments}
                  placeholder="Select departments..."
                />

                <MultiSelectDropdown
                  label="Years"
                  options={years}
                  selectedValues={selectedYears}
                  onSelectionChange={setSelectedYears}
                  placeholder="Select years..."
                />

                <MultiSelectDropdown
                  label="Batches"
                  options={batches}
                  selectedValues={selectedBatches}
                  onSelectionChange={setSelectedBatches}
                  placeholder="Select batches..."
                />

                <MultiSelectDropdown
                  label="Courses"
                  options={courses}
                  selectedValues={selectedCourses}
                  onSelectionChange={setSelectedCourses}
                  placeholder="Select courses..."
                />
              </div>
            </div>
          )}

          {/* Active Filters Display */}
          {(selectedInstitutions.length > 0 || selectedDegrees.length > 0 || selectedDepartments.length > 0 || 
            selectedYears.length > 0 || selectedBatches.length > 0 || selectedCourses.length > 0) && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-blue-800">Active filters:</span>
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedInstitutions.map(institution => (
                  <span key={`inst-${institution}`} className="inline-flex items-center gap-1 text-xs bg-white px-2 py-1 rounded border border-blue-300 text-blue-700">
                    Institution: {institution}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedInstitutions(prev => prev.filter(i => i !== institution))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedInstitutions(prev => prev.filter(i => i !== institution));
                        }
                      }}
                      className="hover:text-blue-900 cursor-pointer"
                    >
                      <X size={10} />
                    </span>
                  </span>
                ))}
                {selectedDegrees.map(degree => (
                  <span key={`deg-${degree}`} className="inline-flex items-center gap-1 text-xs bg-white px-2 py-1 rounded border border-blue-300 text-blue-700">
                    Degree: {degree}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedDegrees(prev => prev.filter(d => d !== degree))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedDegrees(prev => prev.filter(d => d !== degree));
                        }
                      }}
                      className="hover:text-blue-900 cursor-pointer"
                    >
                      <X size={10} />
                    </span>
                  </span>
                ))}
                {selectedDepartments.map(dept => (
                  <span key={`dept-${dept}`} className="inline-flex items-center gap-1 text-xs bg-white px-2 py-1 rounded border border-blue-300 text-blue-700">
                    Department: {dept}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedDepartments(prev => prev.filter(d => d !== dept))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedDepartments(prev => prev.filter(d => d !== dept));
                        }
                      }}
                      className="hover:text-blue-900 cursor-pointer"
                    >
                      <X size={10} />
                    </span>
                  </span>
                ))}
                {selectedYears.map(year => (
                  <span key={`year-${year}`} className="inline-flex items-center gap-1 text-xs bg-white px-2 py-1 rounded border border-blue-300 text-blue-700">
                    Year: {year}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedYears(prev => prev.filter(y => y !== year))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedYears(prev => prev.filter(y => y !== year));
                        }
                      }}
                      className="hover:text-blue-900 cursor-pointer"
                    >
                      <X size={10} />
                    </span>
                  </span>
                ))}
                {selectedBatches.map(batch => (
                  <span key={`batch-${batch}`} className="inline-flex items-center gap-1 text-xs bg-white px-2 py-1 rounded border border-blue-300 text-blue-700">
                    Batch: {batch}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedBatches(prev => prev.filter(b => b !== batch))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedBatches(prev => prev.filter(b => b !== batch));
                        }
                      }}
                      className="hover:text-blue-900 cursor-pointer"
                    >
                      <X size={10} />
                    </span>
                  </span>
                ))}
                {selectedCourses.map(course => (
                  <span key={`course-${course}`} className="inline-flex items-center gap-1 text-xs bg-white px-2 py-1 rounded border border-blue-300 text-blue-700">
                    Course: {course}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedCourses(prev => prev.filter(c => c !== course))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedCourses(prev => prev.filter(c => c !== course));
                        }
                      }}
                      className="hover:text-blue-900 cursor-pointer"
                    >
                      <X size={10} />
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Main Table Card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-3 text-left text-xs font-semibold text-gray-600 uppercase w-12">ID</th>
                    <th className="py-3 px-3 text-left text-xs font-semibold text-gray-600 uppercase w-40">Student</th>
                    <th className="py-3 px-3 text-left text-xs font-semibold text-gray-600 uppercase w-48">Contact</th>
                    <th className="py-3 px-3 text-left text-xs font-semibold text-gray-600 uppercase w-52">Academic</th>
                    <th className="py-3 px-3 text-left text-xs font-semibold text-gray-600 uppercase w-40">Course</th>
                    <th className="py-3 px-3 text-left text-xs font-semibold text-gray-600 uppercase w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currentUsers.map((user) => {
                    const userCourse = getUserCourse(user.id);
                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="py-3 px-3">
                          <span className="text-xs font-medium text-gray-600">#{user.id}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div>
                            <div className="font-medium text-sm text-gray-900">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                user.gender === 'Male' ? 'bg-blue-100 text-blue-800' :
                                'bg-pink-100 text-pink-800'
                              }`}>
                                {user.gender.charAt(0)}
                              </span>
                              <span className="text-xs text-gray-500 truncate max-w-[120px]">
                                {user.institution}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="space-y-1">
                            <div className="text-sm text-gray-900 truncate max-w-[180px]">{user.email}</div>
                            <div className="text-xs text-gray-500">{user.phone}</div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-gray-900">{user.degree}</div>
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <span>{user.department}</span>
                              <span>•</span>
                              <span>Sec {user.section}</span>
                              <span>•</span>
                              <span>{user.year}</span>
                            </div>
                            <div className="text-xs text-gray-500">{user.batch}</div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {userCourse ? (
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-gray-900">{userCourse.name}</div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  userCourse.level === 'Beginner' ? 'bg-green-100 text-green-800' :
                                  userCourse.level === 'Intermediate' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {userCourse.level}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">No course</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => viewUserDetails(user.id)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => deleteUser(user.id)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="text-xs text-gray-600">
                  Showing {indexOfFirstUser + 1}-{Math.min(indexOfLastUser, filteredUsers.length)} of {filteredUsers.length} students
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={prevPage}
                    disabled={currentPage === 1}
                    className={`p-1.5 rounded ${currentPage === 1 ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-200'}`}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {getPageNumbers().map((page, index) => (
                      page === '...' ? (
                        <span key={`ellipsis-${index}`} className="px-2 text-gray-400">...</span>
                      ) : (
                        <button
                          key={page}
                          onClick={() => goToPage(page as number)}
                          className={`w-7 h-7 flex items-center justify-center text-xs rounded ${
                            currentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    ))}
                  </div>
                  
                  <button
                    onClick={nextPage}
                    disabled={currentPage === totalPages}
                    className={`p-1.5 rounded ${currentPage === totalPages ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-200'}`}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                
                <div className="text-xs text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
              </div>
            </div>
          </div>

          {/* Course Stats */}
          <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Course Allocation Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {availableCourses.map(course => (
                <div key={course.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-sm text-gray-900">{course.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          course.level === 'Beginner' ? 'bg-green-100 text-green-800' :
                          course.level === 'Intermediate' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {course.level}
                        </span>
                      </div>
                    </div>
                    <div className="text-lg font-bold text-blue-600">
                      {courseStats[course.name] || 0}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    {courseStats[course.name] || 0} student{courseStats[course.name] !== 1 ? 's' : ''} enrolled
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default UserManagementPage;