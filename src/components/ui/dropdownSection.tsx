import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
 
type DropdownSectionProps = {
    type: string;
    icon: React.ElementType;
    title: string;
    activityTypes: string[];
    selectedActivities: string[];
    onSelectionChange: (selected: string[]) => void;
    onSelectAll: (checked: boolean) => void;
};
 
const DropdownSection: React.FC<DropdownSectionProps> = ({
    type,
    icon: Icon,
    title,
    activityTypes,
    selectedActivities,
    onSelectionChange,
    onSelectAll
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
 
    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: { target: any; }) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
 
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
 
    const handleActivityToggle = (activity: string, checked: boolean) => {
        const current = Array.isArray(selectedActivities) ? selectedActivities : [];
        const updated = checked
            ? [...current, activity]
            : current.filter(a => a !== activity);
        onSelectionChange(updated);
    };
 
    const handleSelectAll = (checked: any) => {
        onSelectAll(!!checked);
    };
 
    const allSelected = Array.isArray(selectedActivities) &&
        selectedActivities.length === activityTypes.length;
 
    return (
        <div className="flex-1 " ref={dropdownRef}>
            <div className="group backdrop-blur-none">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center justify-between w-full px-3 py-2 text-xs cursor-pointer bg-purple-50 hover:bg-purple-100 rounded-md transition-colors border border-purple-200"
                >
                    <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-purple-600" />
                        <span className="font-medium text-purple-700">{title}</span>
                        {Array.isArray(selectedActivities) && selectedActivities.length > 0 && (
                            <span className="bg-purple-100 text-purple-800 text-[10px] px-1.5 py-0.5 rounded-full">
                                {selectedActivities.length}/{activityTypes.length}
                            </span>
                        )}
                    </div>
                    <ChevronDown
                        className={`h-3 w-3 text-purple-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                </button>
 
                {isOpen && (
                    <div className="absolute  mt-1 w-full p-2 bg-white border border-purple-100 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="flex items-center gap-2 px-2 py-1 mb-1 border-b border-purple-50 bg-white">
                            <Checkbox
                                id={`${type}-all`}
                                checked={allSelected}
                                onCheckedChange={handleSelectAll}
                                className="h-3 w-3"
                            />
                            <label htmlFor={`${type}-all`} className="text-xs text-purple-600 font-medium cursor-pointer">
                                Select All
                            </label>
                        </div>
                        {activityTypes.map((activity) => (
                            <label
                                key={`${type}-${activity}`}
                                className="flex items-center bg-white gap-2 px-2 py-1.5 text-xs rounded hover:bg-purple-50 cursor-pointer backdrop-blur-none "
                            >
                                <Checkbox
                                    id={`${type}-${activity}`}
                                    checked={Array.isArray(selectedActivities) && selectedActivities.includes(activity)}
                                    onCheckedChange={(checked: any) => handleActivityToggle(activity, !!checked)}
                                    className="h-3 w-3"
                                />
                                <span className="text-slate-600 bg-white">{activity}</span>
                            </label>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
 
// Checkbox component (make sure this is the same one you're using)
type CheckboxProps = {
    id: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    className?: string;
};
 
const Checkbox: React.FC<CheckboxProps> = ({ id, checked, onCheckedChange, className = "" }) => {
    return (
        <input
            type="checkbox"
            id={id}
            checked={checked}
            onChange={(e) => onCheckedChange(e.target.checked)}
            className={`cursor-pointer ${className}`}
        />
    );
};
 
export default DropdownSection;
 
 