// AddCourseSettingsPopup/hooks/useCourseForm.ts
import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { courseStructureApi } from '@/apiServices/createCourseStucture';
import { FormData, ResourceConfigType, ValidationErrors } from '../types';
import { initialCourseFormData } from '../utils/constants'; // Changed import name
import axios from 'axios';
import { showToast } from '../ProfessionalToast';
import { transformTestConfigurationForBackend, validateProgrammingConfiguration } from '../Step2CourseDetails';

// Import the helper functions type or define them
interface DataHelpers {
    getClientName: (clientId: string) => string;
    getServiceName: (serviceId: string) => string;
    getServiceModelName: (modelId: string) => string;
    getCategoryName: (categoryId: string) => string;
}

interface UseCourseFormProps {
    isEditMode: boolean;
    courseId?: string;
    totalCourses: number;
    onSuccess?: () => void;
    onClose: () => void;
    dataHelpers?: DataHelpers;
}

// Define the course data type for API submission
interface CourseDataToSubmit {
    clientId: string;
    clientName: string;
    serviceType: string;
    serviceModal: string;
    category: string;
    courseCode: string;
    courseName: string;
    courseDescription: string;
    courseDuration: string;
    courseLevel: string;
    resourcesType: any;
    courseHierarchy: string[];
    I_Do: string[];
    We_Do: string[];
    You_Do: string[];
    courseImage: File | null;
    aiChatGlobal: boolean;
    institution: string;
    createdBy: string;
    testConfiguration: any;
    // Client-driven cascade (same as User modal)
    studentType: string;
    batch: string;
    skillingBatches: string[];
    degree: string;
    departmentSections: { department: string; sections: string[]; semesters?: string[] }[];
    clientConfigurations: { batch: string; degree: string; departmentSections: { department: string; sections: string[]; semesters?: string[] }[] }[];
    _id?: string; // Optional _id for updates
}

export const useCourseForm = ({ 
    isEditMode, 
    courseId, 
    totalCourses, 
    onSuccess, 
    onClose,
    dataHelpers
}: UseCourseFormProps) => {
    const safeDataHelpers: DataHelpers = dataHelpers ?? {
        getClientName: () => '',
        getServiceName: () => '',
        getServiceModelName: () => '',
        getCategoryName: () => ''
    };
    const { getClientName, getServiceName, getServiceModelName, getCategoryName } = safeDataHelpers;
    
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState<FormData>(initialCourseFormData); // Changed here
    const [currentStep, setCurrentStep] = useState(1);
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isCustomCourseName, setIsCustomCourseName] = useState(false);
    const [customCourseName, setCustomCourseName] = useState('');
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
    const [createdCourseId, setCreatedCourseId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const createMutation = useMutation({
        mutationFn: (courseData: CourseDataToSubmit) => courseStructureApi.create().mutationFn(courseData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courseStructures'] });
            onSuccess?.();
            onClose();
        },
        onError: (error: Error) => showToast.error(error.message || 'Failed to create course')
    });

    const updateMutation = useMutation({
        mutationFn: ({ courseId, courseData }: { courseId: string; courseData: CourseDataToSubmit }) => 
            courseStructureApi.update(courseId).mutationFn(courseData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courseStructures'] });
            onSuccess?.();
            onClose();
        },
        onError: (error: Error) => showToast.error(error.message || 'Failed to update course')
    });

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const handleFileSelect = (file: File) => {
        if (file.size > 3 * 1024 * 1024) { 
            showToast.error('Image size should be less than 3MB'); 
            return; 
        }
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) { 
            showToast.error('Only JPEG, JPG, PNG, and WebP formats are allowed'); 
            return; 
        }
        setFormData({ ...formData, image: file });
    };

    const handleDescriptionChange = (value: string) => {
        setFormData(prev => ({ ...prev, courseDescription: value }));
    };

    const validateStep1 = (): boolean => {
        const errors: ValidationErrors = {};
        if (!formData.client) errors.client = 'Please select a client';
        if (!formData.modal) errors.modal = 'Please select a service type';
        if (!formData.duration) errors.duration = 'Please select a service model';
        if (!formData.categoryName) errors.categoryName = 'Please select a course category';
        if (!formData.selectedCourseName?.trim()) errors.selectedCourseName = 'Please enter a course name';
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateStep2 = (): boolean => {
        const errors: ValidationErrors = {};
        if (!formData.level) errors.level = 'Please select a course level';
        const hasHierarchy = Object.values(formData.checkboxOptions).some(v => v);
        if (!hasHierarchy) errors.checkboxOptions = 'Please select at least one course hierarchy option';
        
        const hasResources = ['iDo', 'weDo', 'youDo'].some(section => 
            ['video', 'ppt', 'pdf', 'image', 'zip', 'url', 'aiChat', 'aiSummary', 'notes', 'ai', 'autoQuestionGenerate'].some(type =>
                formData.resourcesType[section as keyof typeof formData.resourcesType]?.[type as keyof ResourceConfigType]?.enabled
            )
        );
        if (!hasResources) errors.resourceType = 'Please select at least one resource type';
          const programmingError = validateProgrammingConfiguration(formData.testConfiguration);
    if (programmingError) errors.programmingConfiguration = programmingError;
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (updatedHelpers?: DataHelpers) => {
        const helpers = updatedHelpers || dataHelpers || safeDataHelpers;
        const { getClientName: getClientNameFn, getServiceName: getServiceNameFn, getServiceModelName: getServiceModelNameFn, getCategoryName: getCategoryNameFn } = helpers;
        
        try {
            const requiredFields = [
                { field: formData.client, message: "Client is required" },
                { field: formData.categoryName, message: "Category is required" },
                { field: formData.level, message: "Level is required" },
                { field: formData.duration, message: "Duration is required" },
                { field: formData.title, message: "Course title is required" },
                { field: formData.courseid, message: "Course ID is required" },
            ];
            const missingFields = requiredFields.filter(item => !item.field);
            if (missingFields.length > 0) throw new Error(missingFields.map(f => f.message).join("\n"));

            const courseHierarchy = [];
            if (formData.checkboxOptions.module) courseHierarchy.push("Module");
            if (formData.checkboxOptions.submodule) courseHierarchy.push("Sub Module");
            if (formData.checkboxOptions.topic) courseHierarchy.push("Topic");
            if (formData.checkboxOptions.subtopic) courseHierarchy.push("Sub Topic");
            if (courseHierarchy.length === 0) throw new Error("At least one course hierarchy option must be selected");

            // Base course data (common for both create and update)
            const baseCourseData: CourseDataToSubmit = {
                clientId: formData.client,             // Client Management _id
                clientName: formData.clientName || '', // readable company name
                serviceType: formData.serviceTypeName || getServiceNameFn(formData.modal),
                serviceModal: formData.serviceModelName || getServiceModelNameFn(formData.duration),
                category: formData.categoryDisplayName || getCategoryNameFn(formData.categoryName),
                courseCode: formData.courseid,
                courseName: formData.title,
                courseDescription: formData.courseDescription,
                courseDuration: "",
                courseLevel: formData.level,
                resourcesType: formData.resourcesType,
                courseHierarchy: courseHierarchy,
                I_Do: formData.iDo,
                We_Do: formData.weDo,
                You_Do: formData.youDo,
                courseImage: formData.image,
                aiChatGlobal: formData.aiChatGlobal,
                institution: localStorage.getItem('smartcliff_institution') || '',
                createdBy: localStorage.getItem('smartcliff_user_email') || '',
            testConfiguration: transformTestConfigurationForBackend(formData.testConfiguration),
                // Client-driven cascade values. department/semester/sections are
                // no longer sent — they live inside departmentSections / clientConfigurations.
                studentType: formData.studentType || '',
                batch: formData.batch || '',
                skillingBatches: formData.skillingBatches || [],
                degree: formData.degree || '',
                departmentSections: formData.departmentSections || [],
                clientConfigurations: formData.clientConfigurations || [],
            };

            // For update, include the _id if available
            let courseDataToSubmit: CourseDataToSubmit = { ...baseCourseData };
            
            // If this is an update and we have the course ID from props, include it in the payload
            if (isEditMode && courseId) {
                courseDataToSubmit = {
                    ...baseCourseData,
                    _id: courseId,  // Include the course _id for update
                };
            }

            console.log('Submitting course data:', courseDataToSubmit);

            let response;
            let courseIdToPass;
            
            if (isEditMode && courseId) {
                // For update, pass courseId in the URL and in the payload if needed
                response = await updateMutation.mutateAsync({ 
                    courseId,  // This goes to the URL: /api/courses/{courseId}
                    courseData: courseDataToSubmit 
                });
                courseIdToPass = courseId;
            } else {
                // For create, don't include _id
                response = await createMutation.mutateAsync(courseDataToSubmit);
                courseIdToPass = response.data?._id || response.data?.id || response.courseId;
            }

            if (courseIdToPass) setCreatedCourseId(courseIdToPass);
            showToast.success(isEditMode ? 'Course updated successfully!' : 'Course created successfully!');
            setIsPreviewOpen(false);
            setIsConfirmationOpen(true);
        } catch (error: unknown) {
            console.error('Error submitting form:', error);
            let errorMessages = ['Failed to process course'];
            if (axios.isAxiosError(error)) {
                errorMessages = [error.response?.data?.error || error.message];
            } else if (error instanceof Error) {
                errorMessages = [error.message];
            }
            errorMessages.forEach(msg => showToast.error(msg));
        }
    };

    const resetForm = useCallback(() => {
        setCurrentStep(1);
        setValidationErrors({});
        setIsCustomCourseName(false);
        setCustomCourseName('');
        setCreatedCourseId(null);
        if (!isEditMode) setFormData(initialCourseFormData); // Changed here
    }, [isEditMode]);

    return {
        formData,
        setFormData,
        currentStep,
        setCurrentStep,
        validationErrors,
        setValidationErrors,
        currentTime,
        isCustomCourseName,
        setIsCustomCourseName,
        customCourseName,
        setCustomCourseName,
        isHelpOpen,
        setIsHelpOpen,
        isPreviewOpen,
        setIsPreviewOpen,
        isConfirmationOpen,
        setIsConfirmationOpen,
        createdCourseId,
        setCreatedCourseId,
        fileInputRef,
        handleFileSelect,
        handleDescriptionChange,
        validateStep1,
        validateStep2,
        handleSubmit,
        resetForm
    };
};