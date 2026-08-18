import React, { useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Check, X, CircleHelp, BookOpen, Pencil, Loader2, Eye } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useClients } from './utils/useClients';
import { useCourseData } from './useCourseData';
import { ConfirmationDialog } from './ConfirmationDialog';
import { PreviewDialog } from './PreviewDialog';
import { Step1BasicConfig } from './Step1BasicConfig';
import { Step2CourseDetails } from './Step2CourseDetails';
import { AddCourseSettingsPopupProps, Category, Service, ServiceModal } from './types';
import { useCourseForm } from './utils/useCourseForm';
import { CourseCreationHelpDialog } from './CourseCreationHelpDialog';
import { popupVariants, steps } from './utils/constants';
import { generateCourseId, generateUniqueCourseId, generateNextCourseId } from './utils/helpers';
const AddCourseSettingsPopup: React.FC<AddCourseSettingsPopupProps> = ({ 
    isOpen, 
    courseId, 
    onSuccess, 
    onClose,
    totalCourses = 0
}) => {
    const router = useRouter();
    const isEditMode = !!courseId;
    
    // Use refs to track if effects have run
    const hasGeneratedId = useRef(false);
    const hasPopulatedForm = useRef(false);
    
    // First, load clients
    const { clientList, isClientsLoading, loadClients } = useClients({ isOpen });
    
    // Use useCourseForm FIRST
    const {
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
    } = useCourseForm({ 
        isEditMode, 
        courseId, 
        totalCourses, 
        onSuccess, 
        onClose
    });

    // Now use useCourseData with the form data from useCourseForm
    const {
        services,
        isLoadingServices,
        categoriesData,
        isLoadingCategories,
        structures,
        allCourses,
        courseData,
        isEditDataReady,
        availableCourseNames,
        filteredServices,
        selectedService,
        filteredServiceModels,
        transformStructureToActivities,
        populateEditForm,
        existingCourseIds
    } = useCourseData({ 
        isOpen, 
        isEditMode, 
        courseId, 
        formData,
        setFormData,
        clientList,
        setIsCustomCourseName,
        setCustomCourseName
    });

    // Get existing courses count
    const existingCourses = allCourses?.data || [];
    
    // Load clients when modal opens - only once
    useEffect(() => {
        if (isOpen) {
            loadClients();
        }
    }, [isOpen, loadClients]);

    // Populate edit form when data is ready - only once
    useEffect(() => {
        if (!hasPopulatedForm.current && 
            isEditMode && 
            isEditDataReady && 
            courseData?.data && 
            clientList.length > 0 && 
            services.length > 0 && 
            categoriesData?.allCategories) {
            hasPopulatedForm.current = true;
            populateEditForm();
        }
        
        // Reset the ref when modal closes
        if (!isOpen) {
            hasPopulatedForm.current = false;
        }
    }, [isEditMode, isEditDataReady, courseData, clientList, services, categoriesData, populateEditForm, isOpen]);

    // Generate course ID when dependencies change (only for create mode).
    // Uses the Client Management names; works even with zero existing courses.
  useEffect(() => {
    const clientName =
        formData.clientName ||
        clientList.find(c => c._id === formData.client)?.clientCompany ||
        '';

    if (
        !isEditMode &&
        formData.client &&
        formData.serviceTypeName &&
        formData.serviceModelName &&
        clientName
    ) {
        const newCourseId = generateNextCourseId(
            clientName,
            formData.serviceTypeName,
            formData.serviceModelName,
            existingCourseIds
        );

        if (newCourseId && newCourseId !== formData.courseid) {
            setFormData(prev => ({ ...prev, courseid: newCourseId }));
        }
    }

    // Reset course ID when selections change
    if (!isEditMode && (!formData.client || !formData.serviceTypeName || !formData.serviceModelName)) {
        if (formData.courseid) {
            setFormData(prev => ({ ...prev, courseid: '' }));
        }
    }
}, [
    formData.client,
    formData.clientName,
    formData.serviceTypeName,
    formData.serviceModelName,
    clientList,
    existingCourseIds,
    isEditMode,
    setFormData
]);
    // Reset form when modal closes
    useEffect(() => {
        if (!isOpen) {
            resetForm();
            hasGeneratedId.current = false;
            hasPopulatedForm.current = false;
        }
    }, [isOpen, resetForm]);

    const handleNext = () => {
        if (currentStep === 1) {
            if (!validateStep1()) return;
        } else if (currentStep === 2) {
            if (!validateStep2()) return;
        }
        if (currentStep < steps.length) {
            setCurrentStep(currentStep + 1);
            setValidationErrors({});
        }
    };

    const handlePrevious = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
            setValidationErrors({});
        }
    };

    const handlePreview = () => {
        if (!validateStep2()) return;
        setIsPreviewOpen(true);
    };

    const isLoadingEditData = isEditMode && !isEditDataReady;

    // Helper functions for Step1BasicConfig
    const getClientName = useCallback((clientId: string) => {
        const client = clientList.find(c => c._id === clientId);
        return client?.clientCompany || '';
    }, [clientList]);

    const getServiceName = useCallback((serviceId: string) => {
        const service = services.find((s: Service) => s.id === serviceId);
        return service?.name || '';
    }, [services]);

    const getServiceModelName = useCallback((modelId: string) => {
        const model = filteredServiceModels.find((m: ServiceModal) => String(m.id) === modelId);
        return model?.name || '';
    }, [filteredServiceModels]);

    const getCategoryName = useCallback((categoryId: string) => {
        const category = categoriesData?.allCategories?.find((c: Category) => c._id === categoryId);
        return category?.categoryName || '';
    }, [categoriesData]);

    // Update formData with names when selections change
    useEffect(() => {
        if (formData.client && clientList.length > 0) {
            const clientName = getClientName(formData.client);
            if (clientName && formData.clientName !== clientName) {
                setFormData(prev => ({ ...prev, clientName }));
            }
        }
    }, [formData.client, clientList, getClientName, setFormData]);

    useEffect(() => {
        if (formData.modal && services.length > 0) {
            const serviceName = getServiceName(formData.modal);
            if (serviceName && formData.serviceTypeName !== serviceName) {
                setFormData(prev => ({ ...prev, serviceTypeName: serviceName }));
            }
        }
    }, [formData.modal, services, getServiceName, setFormData]);

    useEffect(() => {
        if (formData.duration && filteredServiceModels.length > 0) {
            const modelName = getServiceModelName(formData.duration);
            if (modelName && formData.serviceModelName !== modelName) {
                setFormData(prev => ({ ...prev, serviceModelName: modelName }));
            }
        }
    }, [formData.duration, filteredServiceModels, getServiceModelName, setFormData]);

    useEffect(() => {
        if (formData.categoryName && categoriesData?.allCategories) {
            const categoryName = getCategoryName(formData.categoryName);
            if (categoryName && formData.categoryDisplayName !== categoryName) {
                setFormData(prev => ({ ...prev, categoryDisplayName: categoryName }));
            }
        }
    }, [formData.categoryName, categoriesData, getCategoryName, setFormData]);

    return (
        <AnimatePresence>
            <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
                <DialogContent 
                    className="w-[98%] max-w-7xl h-[95vh] rounded-xl bg-white dark:bg-gray-900 p-0 overflow-hidden flex flex-col font-sans border border-gray-200 dark:border-gray-800" 
                    showCloseButton={false}
                >
                    <DialogTitle className="sr-only">
                        {isEditMode ? 'Edit Course Structure' : 'Create New Course Setup'}
                    </DialogTitle>
                    
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        variants={popupVariants}
                        className="flex flex-col h-full font-sans"
                    >
                        {isLoadingEditData ? (
                            <LoadingState />
                        ) : (
                            <>
                                <HeaderSection 
                                    isEditMode={isEditMode}
                                    currentStep={currentStep}
                                    onClose={onClose}
                                    onHelp={() => setIsHelpOpen(true)}
                                />

                                <div className="flex-1 min-h-0 overflow-hidden bg-white dark:bg-gray-900">
                                    <div className="h-full overflow-y-auto p-6 font-sans">
                                        {currentStep === 1 && (
                                            <Step1BasicConfig
                                                formData={formData}
                                                setFormData={setFormData}
                                                validationErrors={validationErrors}
                                                setValidationErrors={setValidationErrors}
                                                clientList={clientList}
                                                isClientsLoading={isClientsLoading}
                                                services={services}
                                                isLoadingServices={isLoadingServices}
                                                filteredServices={filteredServices}
                                                selectedService={selectedService}
                                                filteredServiceModels={filteredServiceModels}
                                                categoriesData={categoriesData}
                                                isLoadingCategories={isLoadingCategories}
                                                availableCourseNames={availableCourseNames}
                                                isCustomCourseName={isCustomCourseName}
                                                setIsCustomCourseName={setIsCustomCourseName}
                                                customCourseName={customCourseName}
                                                setCustomCourseName={setCustomCourseName}
                                                currentTime={currentTime}
                                                totalCourses={existingCourses.length}
                                                isEditMode={isEditMode}
                                            />
                                        )}

                                        {currentStep === 2 && (
                                            <Step2CourseDetails
                                                formData={formData}
                                                setFormData={setFormData}
                                                validationErrors={validationErrors}
                                                setValidationErrors={setValidationErrors}
                                                fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
                                                handleFileSelect={handleFileSelect}
                                                handleDescriptionChange={handleDescriptionChange}
                                                structures={structures}
                                                isLoadingServices={isLoadingServices}
                                                transformStructureToActivities={transformStructureToActivities}
                                            />
                                        )}
                                    </div>
                                </div>

                                <FooterSection
                                    currentStep={currentStep}
                                    isEditMode={isEditMode}
                                    onPrevious={handlePrevious}
                                    onNext={handleNext}
                                    onPreview={handlePreview}
                                />
                            </>
                        )}
                    </motion.div>
                </DialogContent>

                <CourseCreationHelpDialog isOpen={isHelpOpen} onOpenChange={setIsHelpOpen} />
                
                <PreviewDialog
                    isOpen={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                    onSubmit={() => handleSubmit({
                        getClientName,
                        getServiceName,
                        getServiceModelName,
                        getCategoryName
                    })}
                    formData={formData}
                />
                
                <ConfirmationDialog
                    isOpen={isConfirmationOpen}
                    onClose={() => setIsConfirmationOpen(false)}
                    onConfirm={() => {
                        const courseIdToPass = createdCourseId || courseId;
                        const query = new URLSearchParams({ courseId: courseIdToPass ?? '' }).toString();
                        router.push(`/lms/pages/coursestructure/pedagogy2?${query}`);
                    }}
                    onLater={() => setIsConfirmationOpen(false)}
                />
            </Dialog>
        </AnimatePresence>
    );
};

// Sub-components
const LoadingState: React.FC = () => (
    <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading course data...</p>
        </div>
    </div>
);

const HeaderSection: React.FC<{
    isEditMode: boolean;
    currentStep: number;
    onClose: () => void;
    onHelp: () => void;
}> = ({ isEditMode, currentStep, onClose, onHelp }) => (
    <div className="flex-shrink-0 border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="p-2 space-y-1.5 font-sans">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    {isEditMode ? (
                        <Pencil className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                        <BookOpen className="h-4 w-4 text-green-600 dark:text-green-400" />
                    )}
                    <span className="text-base font-bold text-slate-900 dark:text-white font-sans">
                        {isEditMode ? 'Edit Course Structure' : 'Create New Course Setup'}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs gap-1 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 font-semibold font-sans rounded-md"
                        onClick={onHelp}
                    >
                        <CircleHelp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        Help
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="h-7 w-7 p-0 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-full font-sans text-slate-600 dark:text-gray-400"
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            <Stepper currentStep={currentStep} />
        </div>
    </div>
);

const Stepper: React.FC<{ currentStep: number }> = ({ currentStep }) => (
    <div className="overflow-x-auto">
        <div className="flex items-center min-w-max gap-1.5 py-0.5 font-sans">
            {steps.map((step, index) => (
                <React.Fragment key={step.number}>
                    <div className="flex items-center gap-1.5 px-1.5">
                        <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all font-sans ${
                                currentStep === step.number
                                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 text-white shadow-md'
                                    : currentStep > step.number
                                    ? 'bg-gradient-to-br from-emerald-500 to-green-600 dark:from-emerald-600 dark:to-green-700 text-white'
                                    : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 border border-slate-300 dark:border-gray-700'
                            }`}
                        >
                            {currentStep > step.number ? (
                                <Check className="h-3.5 w-3.5" />
                            ) : (
                                <span className="text-xs">{step.number}</span>
                            )}
                        </div>
                        <div className="hidden sm:block">
                            <div className={`text-xs font-medium whitespace-nowrap font-sans ${
                                currentStep >= step.number ? 'text-slate-700 dark:text-gray-300' : 'text-slate-400 dark:text-gray-500'
                            }`}>
                                {step.title}
                            </div>
                        </div>
                    </div>
                    {index < steps.length - 1 && <StepConnector isCompleted={currentStep > step.number} />}
                </React.Fragment>
            ))}
        </div>
    </div>
);

const StepConnector: React.FC<{ isCompleted: boolean }> = ({ isCompleted }) => (
    <div className="relative w-8 lg:w-12 h-1 bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
            className={`absolute top-0 left-0 h-full rounded-full transition-all duration-300 ${
                isCompleted
                    ? 'w-full bg-gradient-to-r from-emerald-500 to-green-500 dark:from-emerald-600 dark:to-green-600'
                    : 'w-0 bg-slate-300 dark:bg-gray-600'
            }`}
        />
    </div>
);

const FooterSection: React.FC<{
    currentStep: number;
    isEditMode: boolean;
    onPrevious: () => void;
    onNext: () => void;
    onPreview: () => void;
}> = ({ currentStep, isEditMode, onPrevious, onNext, onPreview }) => (
    <div className="flex-shrink-0 border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2">
        <div className="flex justify-between items-center w-full font-sans">
            <Button
                variant="outline"
                onClick={onPrevious}
                disabled={currentStep === 1}
                className="h-8 px-3 text-xs font-semibold gap-1.5 border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px] transition-all duration-200 hover:scale-105 font-sans rounded-md"
            >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
            </Button>

            <div className="flex gap-1.5">
                {currentStep === 2 ? (
                    <Button
                        onClick={onPreview}
                        className="h-8 px-4 text-xs font-semibold gap-1.5 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 hover:from-blue-600 hover:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 text-white shadow-sm min-w-[110px] transition-all duration-200 hover:scale-105 font-sans rounded-md"
                    >
                        <Eye className="h-3.5 w-3.5" />
                        {isEditMode ? 'Preview & Update' : 'Preview & Create'}
                    </Button>
                ) : (
                    <Button
                        onClick={onNext}
                        className="h-8 px-4 text-xs font-semibold gap-1.5 bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 hover:from-indigo-600 hover:to-indigo-700 dark:hover:from-indigo-700 dark:hover:to-indigo-800 text-white shadow-sm min-w-[80px] transition-all duration-200 hover:scale-105 font-sans rounded-md"
                    >
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                )}
            </div>
        </div>
    </div>
);

export default AddCourseSettingsPopup;