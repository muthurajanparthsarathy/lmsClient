"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Building2, User, Phone, MapPin, Hash, Loader2, X, 
  UserCog, Shield, Plus, Trash2, Check, FileText, 
  Video, Folder, Link, Brain, MessageSquare, 
  FileImage, FileVideo, File, BookOpen, Lock,
  ChevronRight, AlertCircle, Info, Settings,
  Globe, Users, Zap, Sparkles, GraduationCap,
  Users2, UserPlus, Eye, PlayCircle, Mic,
  Volume2, ClipboardList, Target, Rocket,
  HelpCircle, Hammer, Wrench, ChevronDown,
  FileAudio, FileSpreadsheet, Monitor, Hand,
  PenTool
} from "lucide-react";

interface AddInstitutionFormProps {
  isOpen: boolean;
  onClose: () => void;
  institutionId?: string;
  totalInstitutions?: number;
  mode?: 'add' | 'edit';
  initialData?: any;
}

const AddInstitutionForm: React.FC<AddInstitutionFormProps> = ({
  isOpen,
  onClose,
  institutionId,
  totalInstitutions = 0,
  mode = 'add',
  initialData
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'idowindow' | 'wedowindow' | 'youdowindow'>('idowindow');
  const [showInstructions, setShowInstructions] = useState(false);
  const [institutionType, setInstitutionType] = useState<'school' | 'college' | 'university' | 'other'>('school');
  const [scrollProgress, setScrollProgress] = useState(0);
  
  const [formData, setFormData] = useState({
    inst_name: '',
    inst_owner: '',
    phone: '',
    address: ''
  });

  const [roles, setRoles] = useState<Array<{
    id: string;
    name: string;
    description: string;
    isDefault?: boolean;
  }>>([
    { 
      id: 'admin', 
      name: 'Admin', 
      description: 'Full system access with all permissions',
      isDefault: true 
    },
    { 
      id: 'teacher', 
      name: 'Teacher', 
      description: 'Can manage classes, students, and content' 
    },
    { 
      id: 'viewer', 
      name: 'Viewer', 
      description: 'Read-only access to all resources' 
    }
  ]);

  const [newRole, setNewRole] = useState({ name: '', description: '' });
  const [showAddRole, setShowAddRole] = useState(false);
  const [roleErrors, setRoleErrors] = useState<{name?: string}>({});

  const [permissions, setPermissions] = useState({
    // I Do Window - Resources and AI Integration
    idowindow: {
      resources: {
        video: true,
        ppt: true,
        pdf: true,
        folder: true,
        link: true,
        notes: true
      },
      ai_integration: {
        video_summarize: true,
        ppt_summarize: true,
        pdf_summarize: true,
        general_chat: true,
        file_summarize: true,
        notes_integration: true
      }
    },
    // We Do Window - Under Construction
    wedowindow: {},
    // You Do Window - Under Construction
    youdowindow: {}
  });

  const [animationKey, setAnimationKey] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setAnimationKey(prev => prev + 1);
      if (formRef.current) {
        formRef.current.style.opacity = '0';
        formRef.current.style.transform = 'translateY(20px)';
        setTimeout(() => {
          if (formRef.current) {
            formRef.current.style.transition = 'all 0.3s ease';
            formRef.current.style.opacity = '1';
            formRef.current.style.transform = 'translateY(0)';
          }
        }, 50);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && mode === 'edit' && initialData) {
      setFormData({
        inst_name: initialData.inst_name || '',
        inst_owner: initialData.inst_owner || '',
        phone: initialData.phone || '',
        address: initialData.address || ''
      });
      setInstitutionType(initialData.type || 'school');
    }
  }, [isOpen, mode, initialData]);

  // Handle scroll progress
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = contentElement;
      const scrollableHeight = scrollHeight - clientHeight;
      const progress = scrollableHeight > 0 ? (scrollTop / scrollableHeight) * 100 : 0;
      setScrollProgress(progress);
    };

    contentElement.addEventListener('scroll', handleScroll);
    return () => contentElement.removeEventListener('scroll', handleScroll);
  }, [currentStep]);

  const steps = [
    { number: 1, title: 'Institution Details', icon: Building2, color: 'from-orange-600 to-orange-800' },
    { number: 2, title: 'Role Management', icon: UserCog, color: 'from-orange-600 to-orange-800' },
    { number: 3, title: 'Permissions', icon: Shield, color: 'from-orange-600 to-orange-800' }
  ];

  const CurrentHeaderIcon = steps[currentStep - 1]?.icon;

  const generateInstitutionId = () => {
    if (mode === 'edit' && initialData?.inst_id) return initialData.inst_id;
    const nextNumber = totalInstitutions + 1;
    return `INS${String(nextNumber).padStart(3, '0')}`;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.inst_name.trim()) newErrors.inst_name = 'Institution name is required';
    if (!formData.inst_owner.trim()) newErrors.inst_owner = 'Institution owner is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Please enter a valid 10-digit phone number';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const validateNewRole = () => {
    if (!newRole.name.trim()) {
      setRoleErrors({ name: 'Role name is required' });
      return false;
    }
    if (roles.some(role => role.name.toLowerCase() === newRole.name.toLowerCase())) {
      setRoleErrors({ name: 'Role name already exists' });
      return false;
    }
    setRoleErrors({});
    return true;
  };

  const handleAddRole = () => {
    if (!validateNewRole()) return;
    
    setRoles([...roles, { 
      id: Date.now().toString(), 
      name: newRole.name, 
      description: newRole.description 
    }]);
    setNewRole({ name: '', description: '' });
    setShowAddRole(false);
  };

  const handleDeleteRole = (id: string) => {
    const role = roles.find(r => r.id === id);
    if (role?.isDefault) {
      alert('Default roles cannot be deleted');
      return;
    }
    setRoles(roles.filter(role => role.id !== id));
  };

  const handleEditRole = (id: string, field: 'name' | 'description', value: string) => {
    const role = roles.find(r => r.id === id);
    if (role?.isDefault && field === 'name') {
      alert('Cannot edit name of default role');
      return;
    }
    
    setRoles(roles.map(role => 
      role.id === id ? { ...role, [field]: value } : role
    ));
  };

  const handleResourceToggle = (resource: string) => {
    setPermissions(prev => ({
      ...prev,
      idowindow: {
        ...prev.idowindow,
        resources: {
          ...prev.idowindow.resources,
          [resource]: !prev.idowindow.resources[resource as keyof typeof prev.idowindow.resources]
        }
      }
    }));
  };

  const handleAIToggle = (aiFeature: string) => {
    setPermissions(prev => ({
      ...prev,
      idowindow: {
        ...prev.idowindow,
        ai_integration: {
          ...prev.idowindow.ai_integration,
          [aiFeature]: !prev.idowindow.ai_integration[aiFeature as keyof typeof prev.idowindow.ai_integration]
        }
      }
    }));
  };

  const handleAllResources = (enable: boolean) => {
    setPermissions(prev => ({
      ...prev,
      idowindow: {
        ...prev.idowindow,
        resources: Object.keys(prev.idowindow.resources).reduce((acc, key) => ({
          ...acc,
          [key]: enable
        }), {})
      }
    }));
  };

  const handleAllAI = (enable: boolean) => {
    setPermissions(prev => ({
      ...prev,
      idowindow: {
        ...prev.idowindow,
        ai_integration: Object.keys(prev.idowindow.ai_integration).reduce((acc, key) => ({
          ...acc,
          [key]: enable
        }), {})
      }
    }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const submitData = { 
        ...formData, 
        type: institutionType,
        roles, 
        permissions 
      };
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log('Submitted:', submitData);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  // Resources configuration - Different icon colors, same other styling
  const resourcesConfig = [
    { 
      key: 'video', 
      label: 'Video', 
      icon: Video, 
      iconColor: 'text-red-500'
    },
    { 
      key: 'ppt', 
      label: 'PPT', 
      icon: FileText, 
      iconColor: 'text-orange-500'
    },
    { 
      key: 'pdf', 
      label: 'PDF', 
      icon: File, 
      iconColor: 'text-red-600'
    },
    { 
      key: 'folder', 
      label: 'Folder', 
      icon: Folder, 
      iconColor: 'text-yellow-500'
    },
    { 
      key: 'link', 
      label: 'Link', 
      icon: Link, 
      iconColor: 'text-blue-500'
    },
    { 
      key: 'notes', 
      label: 'Notes', 
      icon: BookOpen, 
      iconColor: 'text-green-500'
    }
  ];

  // AI Integration configuration - Different icon colors, same other styling
  const aiConfig = [
    { 
      key: 'video_summarize', 
      label: 'Video Summarize', 
      icon: Video, 
      iconColor: 'text-purple-500'
    },
    { 
      key: 'ppt_summarize', 
      label: 'PPT Summarize', 
      icon: FileText, 
      iconColor: 'text-pink-500'
    },
    { 
      key: 'pdf_summarize', 
      label: 'PDF Summarize', 
      icon: File, 
      iconColor: 'text-red-500'
    },
    { 
      key: 'general_chat', 
      label: 'AI Chat', 
      icon: MessageSquare, 
      iconColor: 'text-blue-500'
    },
    { 
      key: 'file_summarize', 
      label: 'File Summarize', 
      icon: Brain, 
      iconColor: 'text-indigo-500'
    }
  ];

  // Notes Integration configuration
  const notesIntegrationConfig = [
    { 
      key: 'notes_integration', 
      label: 'Notes Integration', 
      icon: PenTool, 
      iconColor: 'text-teal-500',
      description: 'AI-powered notes generation and organization'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 overflow-y-auto">
      <div 
        key={animationKey}
        ref={formRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[98vh] flex overflow-hidden transform transition-all duration-300"
      >
        {/* Left Sidebar - Stepper - Made more compact */}
        <div className="w-64 bg-gradient-to-b from-orange-600 to-orange-800 p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600" />
          
          <div className="mb-6 z-10">
            <h2 className="text-xl font-bold text-white mb-1">
              {mode === 'edit' ? 'Edit Institution' : 'New Institution'}
            </h2>
            <p className="text-orange-200 text-xs">Complete all steps to proceed</p>
          </div>

          <div className="space-y-6 flex-1 z-10">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;
              
              return (
                <div key={step.number} className="relative group">
                  {index < steps.length - 1 && (
                    <div className={`absolute left-5 top-10 w-0.5 h-12 transition-all duration-300 ${
                      isCompleted ? 'bg-orange-400' : 'bg-orange-400/30 group-hover:bg-orange-400/50'
                    }`} />
                  )}
                  
                  <div className="flex items-start gap-3 cursor-pointer" onClick={() => !isLoading && setCurrentStep(step.number)}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow ${
                      isCompleted ? 'bg-orange-500 transform scale-105' :
                      isActive ? 'bg-white transform scale-100' : 'bg-orange-700 group-hover:bg-orange-600'
                    }`}>
                      {isCompleted ? (
                        <Check className="w-4 h-4 text-white" />
                      ) : (
                        <Icon className={`w-4 h-4 transition-colors duration-300 ${
                          isActive ? 'text-orange-600' : 'text-orange-300 group-hover:text-white'
                        }`} />
                      )}
                    </div>
                    
                    <div className="flex-1 pt-1">
                      <div className={`text-xs font-medium mb-0.5 transition-colors duration-300 ${
                        isActive ? 'text-white' : 'text-orange-200 group-hover:text-white'
                      }`}>
                        Step {step.number}
                      </div>
                      <div className={`font-semibold transition-all duration-300 text-sm ${
                        isActive ? 'text-white' : 'text-orange-100 group-hover:text-white'
                      }`}>
                        {step.title}
                      </div>
                    </div>
                    
                    {isActive && (
                      <ChevronRight className="w-3 h-3 text-white mt-2.5 animate-pulse" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-3 bg-orange-700/30 backdrop-blur-sm rounded border border-orange-500/20 z-10">
            <div className="flex items-center gap-1 text-orange-100 text-xs mb-1">
              <Hash className="w-3 h-3" />
              Institution ID
            </div>
            <div className="text-white font-mono font-bold text-base tracking-wider">
              {generateInstitutionId()}
            </div>
            <div className="text-orange-200 text-xs mt-1">
              {mode === 'edit' ? 'Editing existing institution' : 'New institution will be created'}
            </div>
          </div>

          {/* Animated background elements */}
          <div className="absolute bottom-0 right-0 w-56 h-56 bg-gradient-to-tl from-orange-400/10 to-transparent rounded-full -translate-x-1/2 translate-y-1/2" />
          <div className="absolute top-1/4 -left-6 w-28 h-28 bg-gradient-to-br from-orange-400/10 to-transparent rounded-full" />
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Fixed Header - Made more compact */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-white to-orange-50/50 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  {CurrentHeaderIcon && (
                    <CurrentHeaderIcon className="w-4 h-4 text-orange-600" />
                  )}
                  {steps[currentStep - 1].title}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  Step {currentStep} of {steps.length}
                  <span className="text-gray-400">•</span>
                  <span className="text-orange-600 font-medium">
                    {currentStep === 1 && 'Basic information'}
                    {currentStep === 2 && 'Define user roles'}
                    {currentStep === 3 && 'Configure access controls'}
                  </span>
                </p>
              </div>
              
              {/* Instructions Popup Button - Step 2 only */}
              {currentStep === 2 && (
                <button
                  onClick={() => setShowInstructions(!showInstructions)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-all duration-200 relative"
                >
                  <HelpCircle className="w-4 h-4 text-orange-600" />
                </button>
              )}
              
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:rotate-90 disabled:opacity-50"
                disabled={isLoading}
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Instructions Popup */}
            {showInstructions && currentStep === 2 && (
              <div className="absolute right-4 top-12 z-50 w-72 bg-white border border-gray-200 rounded-lg shadow-xl p-3 animate-fadeIn">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                    <Info className="w-3 h-3 text-orange-600" />
                    Role Management Guide
                  </h4>
                  <button
                    onClick={() => setShowInstructions(false)}
                    className="p-0.5 hover:bg-gray-100 rounded"
                  >
                    <X className="w-3 h-3 text-gray-500" />
                  </button>
                </div>
                <div className="space-y-1.5 text-xs text-gray-600">
                  <p className="font-medium mb-0.5">Key Points:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Admin role is protected and cannot be deleted or renamed</li>
                    <li>Each role defines what users can access in the system</li>
                    <li>Permissions for each role can be configured in the next step</li>
                    <li>Consider creating roles based on job functions</li>
                    <li>Default roles provide standard access patterns</li>
                  </ul>
                  <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                    <p>Tip: Create roles that match your organizational structure</p>
                  </div>
                </div>
                <div className="absolute -top-1.5 right-4 w-3 h-3 bg-white border-t border-l border-gray-200 transform rotate-45"></div>
              </div>
            )}
          </div>

          {/* Scrollable Content Area with visible scrollbar */}
          <div 
            ref={contentRef}
            className="flex-1 overflow-y-auto"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#FB923C #f3f4f6',
            }}
          >
            {/* Scroll Progress Indicator */}
            <div className="h-0.5 bg-gray-200">
              <div 
                className="h-full bg-gradient-to-r from-orange-500 to-orange-600 transition-all duration-300"
                style={{ width: `${scrollProgress}%` }}
              />
            </div>

            <div className="p-4">
              {/* Step 1: Institution Details - Made more compact */}
              {currentStep === 1 && (
                <div className="max-w-4xl mx-auto space-y-4 animate-slideIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        Institution Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative group">
                        <input
                          type="text"
                          placeholder="Enter institution name"
                          value={formData.inst_name}
                          onChange={(e) => handleInputChange('inst_name', e.target.value)}
                          className={`w-full px-3 py-2 border text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all duration-200 group-hover:border-orange-300 ${
                            errors.inst_name ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                        {!errors.inst_name && formData.inst_name && (
                          <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                        )}
                      </div>
                      {errors.inst_name && (
                        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.inst_name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        Institution Type <span className="text-red-500">*</span>
                      </label>
                      <div className="relative group">
                        <select
                          value={institutionType}
                          onChange={(e) => setInstitutionType(e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-300 text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all duration-200 group-hover:border-orange-300 appearance-none bg-white"
                        >
                          <option value="school">School</option>
                          <option value="college">College</option>
                          <option value="university">University</option>
                          <option value="other">Other</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        Institution Owner <span className="text-red-500">*</span>
                      </label>
                      <div className="relative group">
                        <input
                          type="text"
                          placeholder="Owner name"
                          value={formData.inst_owner}
                          onChange={(e) => handleInputChange('inst_owner', e.target.value)}
                          className={`w-full px-3 py-2 border text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all duration-200 group-hover:border-orange-300 ${
                            errors.inst_owner ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                        {!errors.inst_owner && formData.inst_owner && (
                          <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                        )}
                      </div>
                      {errors.inst_owner && (
                        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.inst_owner}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <div className="relative group">
                        <input
                          type="tel"
                          placeholder="10-digit number"
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                          className={`w-full px-3 py-2 border text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all duration-200 group-hover:border-orange-300 ${
                            errors.phone ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                        {!errors.phone && /^\d{10}$/.test(formData.phone) && (
                          <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                        )}
                      </div>
                      {errors.phone && (
                        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.phone}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        Address
                      </label>
                      <div className="relative group">
                        <textarea
                          placeholder="Enter full address"
                          value={formData.address}
                          onChange={(e) => handleInputChange('address', e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all duration-200 group-hover:border-orange-300"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Role Management - Made more compact */}
              {currentStep === 2 && (
                <div className="max-w-5xl mx-auto space-y-4 animate-slideIn">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-base font-semibold text-gray-900">Define Roles</h4>
                      <p className="text-xs text-gray-600">Create and manage user roles for your institution</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {roles.length} role{roles.length !== 1 ? 's' : ''} configured
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddRole(!showAddRole)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-600 to-orange-700 text-white text-sm rounded-lg hover:from-orange-700 hover:to-orange-800 transition-all duration-200 transform hover:-translate-y-0.5 shadow hover:shadow-md"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Role
                    </button>
                  </div>

                  {showAddRole && (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2 animate-fadeIn">
                      <div>
                        <input
                          type="text"
                          placeholder="Role name (e.g., Content Manager)"
                          value={newRole.name}
                          onChange={(e) => {
                            setNewRole({ ...newRole, name: e.target.value });
                            if (roleErrors.name) setRoleErrors({});
                          }}
                          className={`w-full px-3 py-2 border text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all duration-200 ${
                            roleErrors.name ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                        {roleErrors.name && (
                          <p className="mt-1 text-xs text-red-600">{roleErrors.name}</p>
                        )}
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Role description (e.g., Can manage all educational content)"
                          value={newRole.description}
                          onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all duration-200"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddRole}
                          className="px-3 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors flex-1"
                        >
                          Save Role
                        </button>
                        <button
                          onClick={() => {
                            setShowAddRole(false);
                            setRoleErrors({});
                          }}
                          className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {roles.map((role) => (
                      <div 
                        key={role.id} 
                        className={`p-3 bg-white border rounded-lg transition-all duration-300 hover:shadow-sm ${
                          role.isDefault 
                            ? 'border-orange-200 bg-orange-50/50' 
                            : 'border-gray-200 hover:border-orange-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                              {role.isDefault ? (
                                <Lock className="w-3.5 h-3.5 text-orange-600" />
                              ) : (
                                <UserCog className="w-3.5 h-3.5 text-gray-400" />
                              )}
                              <div className="flex-1">
                                {role.isDefault ? (
                                  <div className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                                    {role.name}
                                    <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                                      Default
                                    </span>
                                  </div>
                                ) : (
                                  <input
                                    type="text"
                                    value={role.name}
                                    onChange={(e) => handleEditRole(role.id, 'name', e.target.value)}
                                    className="font-semibold text-gray-900 text-sm bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-500 focus:outline-none w-full"
                                  />
                                )}
                              </div>
                            </div>
                            
                            {role.isDefault ? (
                              <p className="text-xs text-gray-600 pl-6">{role.description}</p>
                            ) : (
                              <input
                                type="text"
                                value={role.description}
                                onChange={(e) => handleEditRole(role.id, 'description', e.target.value)}
                                className="text-xs text-gray-600 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-500 focus:outline-none w-full pl-6"
                              />
                            )}
                          </div>
                          
                          {!role.isDefault && (
                            <button
                              onClick={() => handleDeleteRole(role.id)}
                              className="p-1.5 hover:bg-red-50 rounded-lg transition-colors ml-3 group"
                              title="Delete role"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400 group-hover:text-red-600" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Permissions - Fixed Tabs & Scrollable Content - Made more compact */}
              {currentStep === 3 && (
                <div className="max-w-6xl mx-auto animate-slideIn">
                  {/* Fixed Tabs - More compact */}
                  <div className="sticky top-0 bg-white pt-1 pb-3 border-b border-gray-200 z-10">
                    <nav className="-mb-px flex space-x-6">
                      <button
                        onClick={() => setActiveTab('idowindow')}
                        className={`py-2 px-1 border-b-2 font-medium text-xs flex items-center gap-1.5 transition-all duration-200 ${
                          activeTab === 'idowindow'
                            ? 'border-orange-500 text-orange-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <GraduationCap className="w-3.5 h-3.5" />
                        I Do Window
                      </button>
                      
                      <button
                        onClick={() => setActiveTab('wedowindow')}
                        className={`py-2 px-1 border-b-2 font-medium text-xs flex items-center gap-1.5 transition-all duration-200 ${
                          activeTab === 'wedowindow'
                            ? 'border-green-500 text-green-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <Users2 className="w-3.5 h-3.5" />
                        We Do Window
                      </button>
                      
                      <button
                        onClick={() => setActiveTab('youdowindow')}
                        className={`py-2 px-1 border-b-2 font-medium text-xs flex items-center gap-1.5 transition-all duration-200 ${
                          activeTab === 'youdowindow'
                            ? 'border-amber-500 text-amber-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        You Do Window
                      </button>
                    </nav>
                  </div>

                  {/* Scrollable Tab Content */}
                  <div className="pt-4 transition-all duration-300">
                    {/* I Do Window Tab - Compact Layout */}
                    {activeTab === 'idowindow' && (
                      <div className="space-y-6 animate-fadeIn">
                        {/* Resources Section - Compact Single Row */}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">Resources Access</h3>
                              <p className="text-xs text-gray-600">Select which resource types users can access</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleAllResources(true)}
                                className="text-xs px-2.5 py-1 bg-orange-50 text-orange-700 rounded hover:bg-orange-100 transition-colors"
                              >
                                Enable All
                              </button>
                              <button
                                onClick={() => handleAllResources(false)}
                                className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                              >
                                Disable All
                              </button>
                            </div>
                          </div>
                          
                          {/* Single Horizontal Row - Resources - More compact */}
                          <div className="flex flex-wrap gap-2">
                            {resourcesConfig.map((resource) => {
                              const Icon = resource.icon;
                              const isEnabled = permissions.idowindow.resources[resource.key as keyof typeof permissions.idowindow.resources];
                              
                              return (
                                <div 
                                  key={resource.key}
                                  className={`flex items-center gap-1.5 p-2 border rounded-lg transition-all duration-200 cursor-pointer hover:shadow-sm text-sm ${
                                    isEnabled 
                                      ? 'bg-gray-50 border-2 border-orange-200' 
                                      : 'bg-white'
                                  }`}
                                  onClick={() => handleResourceToggle(resource.key)}
                                >
                                  <div className="p-1.5 rounded-md bg-gray-100">
                                    <Icon className={`w-3.5 h-3.5 ${resource.iconColor}`} />
                                  </div>
                                  <span className="font-medium text-gray-700 whitespace-nowrap">
                                    {resource.label}
                                  </span>
                                  <input
                                    type="checkbox"
                                    checked={isEnabled}
                                    onChange={() => handleResourceToggle(resource.key)}
                                    className="ml-1.5 w-3.5 h-3.5 text-orange-600 rounded focus:ring-orange-500 cursor-pointer"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* AI Integration Section - Compact Single Row */}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">AI Integration</h3>
                              <p className="text-xs text-gray-600">Enable AI-powered features for enhanced learning</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleAllAI(true)}
                                className="text-xs px-2.5 py-1 bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition-colors"
                              >
                                Enable All
                              </button>
                              <button
                                onClick={() => handleAllAI(false)}
                                className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                              >
                                Disable All
                              </button>
                            </div>
                          </div>
                          
                          {/* Single Horizontal Row - AI - More compact */}
                          <div className="flex flex-wrap gap-2">
                            {aiConfig.map((aiFeature) => {
                              const Icon = aiFeature.icon;
                              const isEnabled = permissions.idowindow.ai_integration[aiFeature.key as keyof typeof permissions.idowindow.ai_integration];
                              
                              return (
                                <div 
                                  key={aiFeature.key}
                                  className={`flex items-center gap-1.5 p-2 border rounded-lg transition-all duration-200 cursor-pointer hover:shadow-sm text-sm ${
                                    isEnabled 
                                      ? 'bg-gray-50 border-2 border-purple-200' 
                                      : 'bg-white'
                                  }`}
                                  onClick={() => handleAIToggle(aiFeature.key)}
                                >
                                  <div className="p-1.5 rounded-md bg-gray-100">
                                    <Icon className={`w-3.5 h-3.5 ${aiFeature.iconColor}`} />
                                  </div>
                                  <span className="font-medium text-gray-700 whitespace-nowrap">
                                    {aiFeature.label}
                                  </span>
                                  <input
                                    type="checkbox"
                                    checked={isEnabled}
                                    onChange={() => handleAIToggle(aiFeature.key)}
                                    className="ml-1.5 w-3.5 h-3.5 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Notes Integration Section - Separate Section Below AI */}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">Notes Integration</h3>
                              <p className="text-xs text-gray-600">AI-powered notes generation and organization features</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setPermissions(prev => ({
                                    ...prev,
                                    idowindow: {
                                      ...prev.idowindow,
                                      ai_integration: {
                                        ...prev.idowindow.ai_integration,
                                        notes_integration: true
                                      }
                                    }
                                  }))
                                }}
                                className="text-xs px-2.5 py-1 bg-teal-50 text-teal-700 rounded hover:bg-teal-100 transition-colors"
                              >
                                Enable
                              </button>
                              <button
                                onClick={() => {
                                  setPermissions(prev => ({
                                    ...prev,
                                    idowindow: {
                                      ...prev.idowindow,
                                      ai_integration: {
                                        ...prev.idowindow.ai_integration,
                                        notes_integration: false
                                      }
                                    }
                                  }))
                                }}
                                className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                              >
                                Disable
                              </button>
                            </div>
                          </div>
                          
                          {/* Notes Integration Options - Single Row */}
                          <div className="flex flex-wrap gap-2">
                            {notesIntegrationConfig.map((feature) => {
                              const Icon = feature.icon;
                              const isEnabled = permissions.idowindow.ai_integration[feature.key as keyof typeof permissions.idowindow.ai_integration];
                              
                              return (
                                <div 
                                  key={feature.key}
                                  className={`flex items-center gap-1.5 p-3 border rounded-lg transition-all duration-200 cursor-pointer hover:shadow-sm text-sm w-full max-w-sm ${
                                    isEnabled 
                                      ? 'bg-teal-50 border-2 border-teal-200' 
                                      : 'bg-white border-gray-200'
                                  }`}
                                  onClick={() => handleAIToggle(feature.key)}
                                >
                                  <div className="p-2 rounded-md bg-gray-100">
                                    <Icon className={`w-4 h-4 ${feature.iconColor}`} />
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-700">{feature.label}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{feature.description}</div>
                                  </div>
                                  <div className="relative">
                                    <input
                                      type="checkbox"
                                      checked={isEnabled}
                                      onChange={() => handleAIToggle(feature.key)}
                                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* We Do Window Tab - Under Construction - More compact */}
                    {activeTab === 'wedowindow' && (
                      <div className="animate-fadeIn pt-2">
                        <div className="p-8 bg-gradient-to-br from-green-50 to-green-100/30 border border-green-200 rounded-lg text-center">
                          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                            <Hammer className="w-8 h-8 text-green-600" />
                          </div>
                          <h3 className="text-lg font-bold text-green-900 mb-2">Under Construction</h3>
                          <p className="text-green-700 text-sm mb-4 max-w-md mx-auto">
                            The "We Do Window" collaborative features are currently being developed. 
                            This section will include group activities, shared workspaces, and team-based learning tools.
                          </p>
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 border border-green-200 rounded-lg text-sm">
                            <Users2 className="w-4 h-4 text-green-600" />
                            <span className="font-semibold text-green-800">Collaborative Features Coming Soon</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* You Do Window Tab - Under Construction - More compact */}
                    {activeTab === 'youdowindow' && (
                      <div className="animate-fadeIn pt-2">
                        <div className="p-8 bg-gradient-to-br from-amber-50 to-amber-100/30 border border-amber-200 rounded-lg text-center">
                          <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                            <Wrench className="w-8 h-8 text-amber-600" />
                          </div>
                          <h3 className="text-lg font-bold text-amber-900 mb-2">Under Construction</h3>
                          <p className="text-amber-700 text-sm mb-4 max-w-md mx-auto">
                            The "You Do Window" self-paced learning features are currently being developed. 
                            This section will include individual assignments, assessments, and personalized learning paths.
                          </p>
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 border border-amber-200 rounded-lg text-sm">
                            <GraduationCap className="w-4 h-4 text-amber-600" />
                            <span className="font-semibold text-amber-800">Self-Paced Learning Coming Soon</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer Actions - More compact */}
          <div className="p-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-orange-50 flex-shrink-0">
            <div className="flex justify-between max-w-6xl mx-auto">
              <button
                onClick={handlePrevious}
                disabled={currentStep === 1 || isLoading}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:-translate-x-1 flex items-center gap-1.5"
              >
                Previous
              </button>
              
              <div className="flex items-center gap-3">
                {currentStep < 3 && (
                  <button
                    onClick={() => {
                      handleSubmit();
                      onClose();
                    }}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Skip & Save
                  </button>
                )}
                
                {currentStep < 3 ? (
                  <button
                    onClick={handleNext}
                    disabled={isLoading}
                    className="px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-700 text-white text-sm rounded-lg hover:from-orange-700 hover:to-orange-800 transition-all duration-200 transform hover:-translate-y-0.5 shadow hover:shadow-md flex items-center gap-1.5"
                  >
                    Next Step
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-700 text-white text-sm rounded-lg hover:from-orange-700 hover:to-orange-800 disabled:opacity-50 transition-all duration-200 transform hover:scale-105 shadow hover:shadow-lg flex items-center gap-1.5"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {mode === 'edit' ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        {mode === 'edit' ? 'Update Institution' : 'Create Institution'}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddInstitutionForm;