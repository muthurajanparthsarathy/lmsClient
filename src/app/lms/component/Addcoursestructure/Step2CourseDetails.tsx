// components/AddCourseSettingsPopup/components/Step2CourseDetails.tsx
import React from 'react'; // Remove useCallback import
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart2, Image, Upload, X, FileText, Bold, Italic, Underline, List, ListOrdered, Folder, FolderOpen, File, FileStack, Info, GraduationCap, User, Users, UserCheck } from 'lucide-react';
import InfoTooltip from '@/components/ui/reusabletooltip';
import { ValidationMessage } from '../../pages/coursestructure/components/ValidationMessage';
import { FormData, ValidationErrors, PedagogyActivity } from '../../pages/coursestructure/components/types';
import TipTapEditor from '../tiptopEditor';
import ResourceTypeSection from '../../pages/coursestructure/components/Resourcetypesection ';
import TestConfigurationSection, { TestConfiguration } from '../../pages/coursestructure/components/TestConfigurationSection';

interface Step2CourseDetailsProps {
    formData: FormData;
    setFormData: React.Dispatch<React.SetStateAction<FormData>>;
    validationErrors: ValidationErrors;
    setValidationErrors: React.Dispatch<React.SetStateAction<ValidationErrors>>;
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleFileSelect: (file: File) => void;
    handleDescriptionChange: (value: string) => void;
    structures: any;
    isLoadingServices: boolean;
    transformStructureToActivities: (structures: any) => PedagogyActivity[];
}

export const transformTestConfigurationForBackend = (frontendConfig: TestConfiguration): any => {
  if (!frontendConfig) {
    return { coreProgram: [], frontend: [], database: [] };
  }
  return {
    coreProgram: frontendConfig.coreProgram || [],
    frontend: frontendConfig.frontend || [],
    database: frontendConfig.database || []
  };
};

export const transformTestConfigurationForFrontend = (backendConfig: any): TestConfiguration => {
  if (!backendConfig) {
    return { coreProgram: [], frontend: [], database: [] };
  }
  // New flat format
  if (Array.isArray(backendConfig.coreProgram) || Array.isArray(backendConfig.frontend) || Array.isArray(backendConfig.database)) {
    return {
      coreProgram: backendConfig.coreProgram || [],
      frontend: backendConfig.frontend || [],
      database: backendConfig.database || []
    };
  }
  // Legacy nested format fallback
  const languages = backendConfig?.programming?.languages || {};
  return {
    coreProgram: languages.coreProgram || [],
    frontend: languages.frontend || [],
    database: languages.database || []
  };
};

export const validateProgrammingConfiguration = (_testConfiguration: TestConfiguration): string | null => {
  return null;
};

export const Step2CourseDetails: React.FC<Step2CourseDetailsProps> = ({
    formData,
    setFormData,
    validationErrors,
    setValidationErrors,
    fileInputRef,
    handleFileSelect,
    handleDescriptionChange,
    structures,
    isLoadingServices,
    transformStructureToActivities
}) => {
    const pedagogyActivities = transformStructureToActivities(structures ?? []);

    // Handle test configuration change with validation
    const handleTestConfigurationChange = (config: TestConfiguration) => {
        setFormData({ ...formData, testConfiguration: config });
        
        // Clear programming validation error when configuration changes
        if (validationErrors.programmingConfiguration) {
            setValidationErrors(prev => ({ ...prev, programmingConfiguration: undefined }));
        }
    };

    return (
        <div className="w-full space-y-5 pb-6 font-sans">
            {/* Level, Image Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-4 space-y-1.5">
                    <LabelWithTooltip label="Course Level" icon={BarChart2} required tooltip="Select difficulty level" />
                    <Select value={formData.level} onValueChange={(value) => { setFormData({ ...formData, level: value }); setValidationErrors(prev => ({ ...prev, level: undefined })); }}>
                        <SelectTrigger className={`w-full h-9 px-3 text-sm font-medium rounded-lg ${validationErrors.level ? 'border-red-500' : 'border-slate-300'}`}>
                            <SelectValue placeholder="Select Level" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Beginner">Beginner</SelectItem>
                            <SelectItem value="Intermediate">Intermediate</SelectItem>
                            <SelectItem value="Advanced">Advanced</SelectItem>
                            <SelectItem value="Expert">Expert</SelectItem>
                        </SelectContent>
                    </Select>
                    {validationErrors.level && <ValidationMessage message={validationErrors.level} />}
                </div>

                <div className="lg:col-span-5 space-y-1.5">
                    <Label className="text-sm font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1">
                        <Image className="h-4 w-4 text-pink-500 dark:text-pink-400" /> Course Image
                    </Label>
                    <div onClick={() => fileInputRef.current?.click()} className="h-9 w-full border-2 border-dashed border-slate-300 dark:border-gray-700 rounded-lg flex items-center justify-center cursor-pointer bg-white dark:bg-gray-800 hover:border-slate-400 transition-all">
                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }} />
                        <Upload className="w-4 h-4 text-slate-600 dark:text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-slate-600 dark:text-gray-400">Choose Image</span>
                    </div>
                    <p className="text-xs font-medium text-slate-500 dark:text-gray-500">JPEG, JPG, PNG, WebP • Max 3MB</p>
                </div>

                <div className="lg:col-span-3 flex items-center justify-center">
                    {formData.image ? (
                        <div className="relative">
                            <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-300 dark:border-gray-700 shadow-sm">
                                <img src={typeof formData.image === 'string' ? formData.image : URL.createObjectURL(formData.image)} alt="Preview" className="h-full w-full object-cover" />
                            </div>
                            <button type="button" onClick={() => setFormData({ ...formData, image: null })} className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md">
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ) : (
                        <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 dark:border-gray-700 flex items-center justify-center bg-white dark:bg-gray-800">
                            <Image className="h-6 w-6 text-slate-400 dark:text-gray-500" />
                        </div>
                    )}
                </div>
            </div>

            {/* Description Editor */}
            <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1">
                    <FileText className="h-4 w-4 text-slate-500 dark:text-gray-400" /> Description
                    <span className="text-slate-400 dark:text-gray-500 text-xs font-normal">(Optional)</span>
                </Label>
                <TipTapEditor value={formData.courseDescription} onChange={handleDescriptionChange} placeholder="Type your course description..." minHeight="150px" maxHeight="200px" showToolbar={true} editable={true} />
                <div className="flex justify-between items-center">
                    <p className="text-xs font-medium text-slate-500 dark:text-gray-400">Full rich text editor with fonts, colors, alignment, lists, and advanced formatting</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
                        <div className="flex items-center gap-1"><Bold className="h-3 w-3" /><Italic className="h-3 w-3" /><Underline className="h-3 w-3" /></div>
                        <span>•</span><span>Fonts & Colors</span><span>•</span>
                        <div className="flex items-center gap-1"><List className="h-3 w-3" /><ListOrdered className="h-3 w-3" /></div>
                        <span>•</span><span>Alignment</span>
                    </div>
                </div>
            </div>

            {/* Course Hierarchy */}
            <HierarchySection formData={formData} setFormData={setFormData} validationErrors={validationErrors} setValidationErrors={setValidationErrors} />

            {/* Pedagogy */}
            <PedagogySection formData={formData} setFormData={setFormData} pedagogyActivities={pedagogyActivities} isLoadingServices={isLoadingServices} />

            {/* Resource Types */}
            <ResourceTypeSection formData={formData} setFormData={setFormData} validationErrors={validationErrors} setValidationErrors={setValidationErrors} />

            {/* Test Configuration */}
            <div className="space-y-1">
                <TestConfigurationSection 
                    testConfiguration={formData.testConfiguration} 
                    onChange={handleTestConfigurationChange}
                />
                {validationErrors.programmingConfiguration && (
                    <ValidationMessage message={validationErrors.programmingConfiguration} />
                )}
            </div>
        </div>
    );
};

// Helper sub-components (keep as they are)
const LabelWithTooltip: React.FC<{ label: string; icon: any; required?: boolean; tooltip: string }> = ({ label, icon: Icon, required, tooltip }) => (
    <div className="flex items-center gap-1.5">
        <Label className="text-sm font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1 font-sans">
            <Icon className="h-4 w-4 text-orange-500 dark:text-orange-400" />
            {label} {required && <span className="text-red-500 dark:text-red-400">*</span>}
        </Label>
        <InfoTooltip content={tooltip} />
    </div>
);

const HierarchySection: React.FC<Pick<Step2CourseDetailsProps, 'formData' | 'setFormData' | 'validationErrors' | 'setValidationErrors'>> = ({ formData, setFormData, validationErrors, setValidationErrors }) => (
    <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Folder className="h-4 w-4 text-orange-500 dark:text-orange-400" /> Course Hierarchy <span className="text-red-500">*</span>
            </h3>
            <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-1.5">
                <Info className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                <p className="text-xs font-medium text-orange-700 dark:text-orange-300"><span className="font-semibold">Note:</span> Organize hierarchically - Modules → Submodules → Topics → Subtopics</p>
            </div>
        </div>
        <div className="flex flex-wrap gap-3">
            {[
                { id: 'module', label: 'Module', icon: Folder, disabled: false },
                { id: 'submodule', label: 'Submodule', icon: FolderOpen, disabled: !formData.checkboxOptions.module },
                { id: 'topic', label: 'Topic', icon: File, disabled: !formData.checkboxOptions.module },
                { id: 'subtopic', label: 'Subtopic', icon: FileStack, disabled: !formData.checkboxOptions.topic }
            ].map(({ id, label, icon: Icon, disabled }) => (
                <div key={id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${disabled ? 'bg-white dark:bg-gray-800 border-slate-200' : 'bg-white dark:bg-gray-800 border-slate-200 hover:border-slate-300'} transition-all hover:shadow-sm`}>
                    <input
                        type="checkbox"
                        id={`${id}-checkbox`}
                        checked={formData.checkboxOptions[id as keyof typeof formData.checkboxOptions]}
                        onChange={(e) => {
                            const newValue = e.target.checked;
                            setFormData({
                                ...formData,
                                checkboxOptions: {
                                    ...formData.checkboxOptions,
                                    ...(id === 'module' && { module: newValue, ...(!newValue && { submodule: false, topic: false, subtopic: false }) }),
                                    ...(id === 'submodule' && { submodule: newValue }),
                                    ...(id === 'topic' && { topic: newValue, ...(!newValue && { subtopic: false }) }),
                                    ...(id === 'subtopic' && { subtopic: newValue })
                                }
                            });
                            setValidationErrors(prev => ({ ...prev, checkboxOptions: undefined }));
                        }}
                        disabled={disabled}
                        className={`h-4 w-4 rounded-lg ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    />
                    <label htmlFor={`${id}-checkbox`} className={`text-sm font-medium ${disabled ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 cursor-pointer'} flex items-center gap-2`}>
                        {label} <Icon className={`h-4 w-4 ${disabled ? 'text-slate-400' : 'text-yellow-500'}`} />
                    </label>
                </div>
            ))}
        </div>
        {validationErrors.checkboxOptions && <ValidationMessage message={validationErrors.checkboxOptions} />}
    </div>
);

const PedagogySection: React.FC<{ formData: FormData; setFormData: React.Dispatch<React.SetStateAction<FormData>>; pedagogyActivities: PedagogyActivity[]; isLoadingServices: boolean }> = ({ formData, setFormData, pedagogyActivities, isLoadingServices }) => (
    <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-orange-600 dark:text-orange-400" /> Pedagogy
            </h3>
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg px-3 py-1.5">
                <Info className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                <p className="text-xs font-medium text-green-700 dark:text-green-300"><span className="font-semibold">Note:</span> Use "I Do, We Do, You Do" framework</p>
            </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <PedagogyCard
                title="I Do"
                icon={User}
                description="Teacher demonstrates concepts and skills"
                color="blue"
                selected={formData.iDo}
                elements={pedagogyActivities[0]?.elements || []}
                isLoading={isLoadingServices}
                onToggle={(name) => setFormData({ ...formData, iDo: formData.iDo.includes(name) ? formData.iDo.filter(i => i !== name) : [...formData.iDo, name] })}
                onRemove={(name) => setFormData({ ...formData, iDo: formData.iDo.filter(i => i !== name) })}
            />
            <PedagogyCard
                title="We Do"
                icon={Users}
                description="Guided practice with instructor support"
                color="green"
                selected={formData.weDo}
                elements={pedagogyActivities[1]?.elements || []}
                isLoading={isLoadingServices}
                onToggle={(name) => setFormData({ ...formData, weDo: formData.weDo.includes(name) ? formData.weDo.filter(i => i !== name) : [...formData.weDo, name] })}
                onRemove={(name) => setFormData({ ...formData, weDo: formData.weDo.filter(i => i !== name) })}
            />
            <PedagogyCard
                title="You Do"
                icon={UserCheck}
                description="Independent practice and application"
                color="purple"
                selected={formData.youDo}
                elements={pedagogyActivities[2]?.elements || []}
                isLoading={isLoadingServices}
                onToggle={(name) => setFormData({ ...formData, youDo: formData.youDo.includes(name) ? formData.youDo.filter(i => i !== name) : [...formData.youDo, name] })}
                onRemove={(name) => setFormData({ ...formData, youDo: formData.youDo.filter(i => i !== name) })}
            />
        </div>
    </div>
);

const PedagogyCard: React.FC<{
    title: string;
    icon: any;
    description: string;
    color: 'blue' | 'green' | 'purple';
    selected: string[];
    elements: any[];
    isLoading: boolean;
    onToggle: (name: string) => void;
    onRemove: (name: string) => void;
}> = ({ title, icon: Icon, description, color, selected, elements, isLoading, onToggle, onRemove }) => {
    const colorClasses = {
        blue: { icon: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/30', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-800 dark:text-orange-300' },
        green: { icon: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-green-200 dark:border-green-800', text: 'text-green-800 dark:text-green-300' },
        purple: { icon: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-800 dark:text-purple-300' }
    };
    const cls = colorClasses[color];

    return (
        <div className="space-y-2 bg-white dark:bg-gray-800 p-3 rounded-lg border border-slate-200 dark:border-gray-700 transition-all hover:shadow-sm">
            <div className="flex items-center gap-1.5">
                <Icon className={`h-4 w-4 ${cls.icon}`} />
                <Label className="text-sm font-semibold text-slate-700 dark:text-gray-300">{title}</Label>
                <InfoTooltip content={description} />
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-gray-400">{description}</p>
            <Select>
                <SelectTrigger className="w-full h-8 px-2 text-xs font-medium bg-white dark:bg-gray-800 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg">
                    <SelectValue placeholder={selected.length > 0 ? `${selected.length} selected` : "Select"} />
                </SelectTrigger>
                <SelectContent className="text-sm max-h-60 rounded-lg">
                    {isLoading ? (
                        <div className="px-2 py-1 text-xs font-medium text-slate-500">Loading...</div>
                    ) : (
                        elements.map((element) => (
                            <div key={element.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-gray-700 rounded-md">
                                <input type="checkbox" id={element.id} checked={selected.includes(element.name)} onChange={() => onToggle(element.name)} className="h-3.5 w-3.5 rounded-lg" />
                                <label htmlFor={element.id} className="text-xs font-medium cursor-pointer flex-1">{element.name}</label>
                            </div>
                        ))
                    )}
                </SelectContent>
            </Select>
            {selected.length > 0 && (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {selected.map((item, index) => (
                        <div key={item} className={`px-2 py-1.5 ${cls.bg} border ${cls.border} ${cls.text} text-xs rounded-lg flex items-center justify-between hover:bg-opacity-80`}>
                            <span className="font-medium">{index + 1}. {item}</span>
                            <button onClick={() => onRemove(item)} className="hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg p-0.5">
                                <X className="h-3 w-3 text-red-600 dark:text-red-400" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};