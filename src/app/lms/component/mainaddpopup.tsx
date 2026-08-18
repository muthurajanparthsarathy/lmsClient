import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { X, Plus } from "lucide-react";

interface AddItemPopupProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (item: any) => void;
    levelName: string;
    nextLevelName?: string | null;
}

const AddItemPopup = ({ isOpen, onClose, onAdd, levelName, nextLevelName }: AddItemPopupProps) => {
    const [formData, setFormData] = useState({
        title: "",
        duration: "",
        lessons: "",
        status: "Draft"
    });

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.title.trim()) {
            alert("Please enter a title");
            return;
        }
const generateId = () => {
    return Math.random().toString(36).substring(2, 9);
};
        const newItem = {
            id: generateId(), // Generate unique ID
            title: formData.title,
            duration: formData.duration || "0 min",
            lessons: parseInt(formData.lessons) || 0,
            status: formData.status as "Published" | "Draft" | "Unpublished",
            children: [] // Initialize with empty children array
        };

        onAdd(newItem);
        
        // Reset form
        setFormData({
            title: "",
            duration: "",
            lessons: "",
            status: "Draft"
        });
        
        onClose();
    };

    const handleClose = () => {
        // Reset form when closing
        setFormData({
            title: "",
            duration: "",
            lessons: "",
            status: "Draft"
        });
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-slate-900">
                        Add New {levelName}
                    </DialogTitle>
                    <DialogDescription className="text-slate-600">
                        Fill in the details below to add a new {levelName.toLowerCase()} to your course structure.
                    </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="title" className="text-sm font-medium text-slate-700">
                            {levelName} Title *
                        </Label>
                        <Input
                            id="title"
                            placeholder={`Enter ${levelName.toLowerCase()} title`}
                            value={formData.title}
                            onChange={(e) => handleInputChange("title", e.target.value)}
                            className="w-full"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="duration" className="text-sm font-medium text-slate-700">
                                Duration
                            </Label>
                            <Input
                                id="duration"
                                placeholder="e.g., 45 min"
                                value={formData.duration}
                                onChange={(e) => handleInputChange("duration", e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="lessons" className="text-sm font-medium text-slate-700">
                                {nextLevelName ? `${nextLevelName}s` : "Items"}
                            </Label>
                            <Input
                                id="lessons"
                                type="number"
                                placeholder="0"
                                value={formData.lessons}
                                onChange={(e) => handleInputChange("lessons", e.target.value)}
                                min="0"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="status" className="text-sm font-medium text-slate-700">
                            Status
                        </Label>
                        <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Draft">Draft</SelectItem>
                                <SelectItem value="Published">Published</SelectItem>
                                <SelectItem value="Unpublished">Unpublished</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            className="px-4"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4"
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Add {levelName}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default AddItemPopup;