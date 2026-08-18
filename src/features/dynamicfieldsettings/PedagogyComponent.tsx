"use client";
import { getToken } from "@/lib/session";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
    BookOpen,
    Plus,
    Search,
    Edit,
    Trash2,
    AlertTriangle,
    User,
    Users,
    Loader2,
    Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserTable } from "@/components/ui/alterationTable";
import { pedagogyStructureApi } from "@/apiServices/dynamicFields/pedagogyStructureService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Modal,
    Toolbar,
    EmptyState,
    Field,
    Input,
    Skeleton,
    SkeletonTable,
    StatusPill,
} from "@/app/lms/shared/ui";
import {
    TabCard,
    TabCardHeader,
    CountPill,
    MiniPager,
    ConfirmDeleteModal,
    RowIconButton,
    TH_CLASS,
    TD_CLASS,
} from "./ui";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSION_IDS } from "@/components/permissions";

interface PedagogyElement {
    id: string;
    name: string;
    _id?: string;
}

interface PedagogyActivity {
    id: string;
    name: string;
    title: string;
    icon: React.ReactNode;
    elements: PedagogyElement[];
}

interface Column<T> {
    key: string;
    label: string;
    width: string;
    align: "left" | "center" | "right";
    renderCell?: (item: T, index?: number) => React.ReactNode;
}

export default function PedagogyManagementComponent() {
    // Parent tab already gates on 'Pedagogy'; the same check drives the row
    // action affordances here.
    const { can } = usePermissions();
    const canAdd = can(PERMISSION_IDS.ADMIN_DYNAMIC_FIELD_SETTINGS, 'Pedagogy');
    const canEdit = canAdd;
    const canDelete = canAdd;

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedActivity, setSelectedActivity] = useState<PedagogyActivity | null>(null);
    const [showElementsPopup, setShowElementsPopup] = useState(false);
    const [showElementForm, setShowElementForm] = useState(false);
    const [editingElement, setEditingElement] = useState<PedagogyElement | null>(null);
    const [elementFormData, setElementFormData] = useState({ name: "" });
    const [currentPage, setCurrentPage] = useState(1);
    const [elementCurrentPage, setElementCurrentPage] = useState(1);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [elementToDelete, setElementToDelete] = useState<PedagogyElement | null>(null);


    const [localActivities, setLocalActivities] = useState<PedagogyActivity[]>([]);

    const queryClient = useQueryClient();
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        const storedToken = getToken();
        if (storedToken) {
            setToken(storedToken);
        }
    }, []);

    // React Query hooks
    const { data: structures, isLoading, error } = useQuery(pedagogyStructureApi.getAll());


    // Update localActivities when structures data changes
    useEffect(() => {
        if (structures && !isLoading && !error) {
            setLocalActivities(transformStructureToActivities(structures));
        }
    }, [structures, isLoading, error]);

    // Mutation hooks
    const createElementMutation = useMutation({
        mutationFn: async (data: any) => {
            if (!token) throw new Error("Authentication token not found.");
            const structureId = structures && structures[0]?._id;

            const sectionMap = {
                "i_do": "I_Do",
                "we_do": "We_Do",
                "you_do": "You_Do"
            } as const;

            const section = sectionMap[selectedActivity?.id as keyof typeof sectionMap];

            // For creating, we need to add to the existing array
            const updateData = {
                [section]: [data.name]
            };

            if (structureId) {
                // Update existing structure
                return pedagogyStructureApi.create().mutationFn(updateData);
            } else {
                // Create new structure
                return pedagogyStructureApi.create().mutationFn(updateData);
            }
        },

        onMutate: async (newElement) => {
            // Optimistically update the UI
            if (selectedActivity) {
                setLocalActivities(prev => {
                    return prev.map(activity => {
                        if (activity.id === selectedActivity.id) {
                            const newElementWithId = {
                                id: `${selectedActivity.id}_${activity.elements.length}`,
                                name: newElement.name,
                                originalIndex: activity.elements.length
                            };
                            return {
                                ...activity,
                                elements: [...activity.elements, newElementWithId]
                            };
                        }
                        return activity;
                    });
                });

                // Also update the selectedActivity in state
                setSelectedActivity(prev => {
                    if (!prev) return prev;
                    const newElementWithId = {
                        id: `${prev.id}_${prev.elements.length}`,
                        name: newElement.name,
                        originalIndex: prev.elements.length
                    };
                    return {
                        ...prev,
                        elements: [...prev.elements, newElementWithId]
                    };
                });
            }
        },

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pedagogyStructures'] });
            toast.success("Element created successfully");
        },
        onError: (error: any) => {
            toast.error(`Error creating element: ${error.message}`);
        }
    });
    const updateElementMutation = useMutation({
        mutationFn: async (data: any) => {
            if (!token) throw new Error("Authentication token not found.");
            const structureId = structures && structures[0]?._id;
            if (!structureId) throw new Error("No structure found");

            const sectionMap = {
                "i_do": "I_Do",
                "we_do": "We_Do",
                "you_do": "You_Do"
            } as const;

            const section = sectionMap[selectedActivity?.id as keyof typeof sectionMap];

            const currentStructure = structures[0];
            const currentArray = currentStructure[section] || [];

            // Find the index of the element to update
            const elementIndex = currentArray.findIndex((_item: any, index: number) =>
                `i_do_${index}` === data.elementId ||
                `we_do_${index}` === data.elementId ||
                `you_do_${index}` === data.elementId
            );

            if (elementIndex === -1) throw new Error("Element not found");

            // Use the new index-based update endpoint
            const updateData = {
                section: section,
                index: elementIndex,
                newValue: data.name
            };

            // Use the correct update endpoint
            return pedagogyStructureApi.updateArrayElement(structureId).mutationFn(updateData);
        },
        onMutate: async (updatedElement) => {
            // Extract index from element ID
            const index = parseInt(updatedElement.elementId.split('_').pop() || '0');

            // Optimistically update the UI
            if (selectedActivity) {
                setLocalActivities(prev => {
                    return prev.map(activity => {
                        if (activity.id === selectedActivity.id) {
                            const updatedElements = activity.elements.map((el, i) =>
                                i === index ? { ...el, name: updatedElement.name } : el
                            );
                            return {
                                ...activity,
                                elements: updatedElements
                            };
                        }
                        return activity;
                    });
                });

                // Also update the selectedActivity in state
                setSelectedActivity(prev => {
                    if (!prev) return prev;
                    const updatedElements = prev.elements.map((el, i) =>
                        i === index ? { ...el, name: updatedElement.name } : el
                    );
                    return {
                        ...prev,
                        elements: updatedElements
                    };
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pedagogyStructures'] });
            toast.success("Element updated successfully");
        },
        onError: (error: any) => {
            toast.error(`Error updating element: ${error.message}`);
        }
    });

    const deleteElementMutation = useMutation({
        mutationFn: async (data: any) => {
            if (!token) throw new Error("Authentication token not found.");
            const structureId = structures && structures[0]?._id;
            if (!structureId) throw new Error("No structure found");

            const sectionMap = {
                "i_do": "I_Do",
                "we_do": "We_Do",
                "you_do": "You_Do"
            } as const;

            const section = sectionMap[selectedActivity?.id as keyof typeof sectionMap];

            // Get current array
            const currentStructure = structures[0];
            const currentArray = currentStructure[section] || [];

            // Find the index of the element to delete
            const elementIndex = currentArray.findIndex((_item: any, index: number) =>
                `i_do_${index}` === data.elementId ||
                `we_do_${index}` === data.elementId ||
                `you_do_${index}` === data.elementId
            );

            if (elementIndex === -1) throw new Error("Element not found");

            // Use the new index-based delete endpoint
            const deleteData = {
                section: section,
                index: elementIndex
            };

            // Use the correct delete endpoint
            return pedagogyStructureApi.deleteArrayElement(structureId).mutationFn(deleteData);
        },
        onMutate: async (deletedElement) => {
            // Extract index from element ID
            const index = parseInt(deletedElement.elementId.split('_').pop() || '0');

            // Optimistically update the UI
            if (selectedActivity) {
                setLocalActivities(prev => {
                    return prev.map(activity => {
                        if (activity.id === selectedActivity.id) {
                            const updatedElements = activity.elements.filter((_, i) => i !== index);
                            return {
                                ...activity,
                                elements: updatedElements
                            };
                        }
                        return activity;
                    });
                });

                // Also update the selectedActivity in state
                setSelectedActivity(prev => {
                    if (!prev) return prev;
                    const updatedElements = prev.elements.filter((_, i) => i !== index);
                    return {
                        ...prev,
                        elements: updatedElements
                    };
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pedagogyStructures'] });
            toast.success("Element deleted successfully");
        },
        onError: (error: any) => {
            toast.error(`Error deleting element: ${error.message}`);
        }
    });

    const ITEMS_PER_PAGE = 5;

    // Transform database structure to component format
    const transformStructureToActivities = (dbStructures: any[]): PedagogyActivity[] => {
        if (!dbStructures || dbStructures.length === 0) return [];

        // Get the first structure (assuming one structure per institution)
        const structure = dbStructures[0];

        return [
            {
                id: "i_do",
                name: "I_Do",
                title: "I Do (Teacher Demonstration)",
                icon: <User className="h-4 w-4 text-brand-strong" />,
                elements: structure.I_Do?.map((item: string, index: number) => ({
                    id: `i_do_${index}`,
                    name: item,
                })) || [],
            },
            {
                id: "we_do",
                name: "We_Do",
                title: "We Do (Guided Practice)",
                icon: <Users className="h-4 w-4 text-success-700" />,
                elements: structure.We_Do?.map((item: string, index: number) => ({
                    id: `we_do_${index}`,
                    name: item,
                })) || [],
            },
            {
                id: "you_do",
                name: "You_Do",
                title: "You Do (Independent Practice)",
                icon: <User className="h-4 w-4 text-info-700" />,
                elements: structure.You_Do?.map((item: string, index: number) => ({
                    id: `you_do_${index}`,
                    name: item,
                })) || [],
            },
        ];
    };
    // Filter activities based on search
    const filteredActivities = localActivities.filter(
        (activity) =>
            activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            activity.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination logic
    const totalPages = Math.ceil(filteredActivities.length / ITEMS_PER_PAGE);
    const paginatedActivities = filteredActivities.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const totalElementPages = selectedActivity
        ? Math.ceil(selectedActivity.elements.length / ITEMS_PER_PAGE)
        : 0;
    const paginatedElements = selectedActivity
        ? selectedActivity.elements.slice(
            (elementCurrentPage - 1) * ITEMS_PER_PAGE,
            elementCurrentPage * ITEMS_PER_PAGE
        )
        : [];

    const handleViewElements = (activity: PedagogyActivity) => {
        setSelectedActivity(activity);
        setShowElementsPopup(true);
        setElementCurrentPage(1);
    };

    const handleAddNewElement = () => {
        setEditingElement(null);
        setElementFormData({ name: "" });
        setShowElementForm(true);
    };

    const handleEditElement = (element: PedagogyElement) => {
        setEditingElement(element);
        setElementFormData({
            name: element.name,
        });
        setShowElementForm(true);
    };

    const handleDeleteElement = (element: PedagogyElement) => {
        setElementToDelete(element);
        setShowDeleteConfirm(true);
    };

    const confirmDeleteElement = async () => {
        if (!elementToDelete || !selectedActivity) return;

        try {
            await deleteElementMutation.mutateAsync({
                elementId: elementToDelete.id
            });
            setShowDeleteConfirm(false);
            setElementToDelete(null);
        } catch (error) {
            // Error handling is done in the mutation
        }
    };

    const handleElementSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedActivity) return;

        try {
            if (editingElement) {
                // Update existing element
                await updateElementMutation.mutateAsync({
                    elementId: editingElement.id,
                    name: elementFormData.name
                });
            } else {
                // Create new element
                await createElementMutation.mutateAsync({
                    name: elementFormData.name
                });
            }

            setShowElementForm(false);
        } catch (error) {
            // Error handling is done in the mutation
        }
    };

    // Table columns
    const columns: Column<PedagogyActivity>[] = [
        {
            key: "activity",
            label: "Pedagogy Activity",
            width: "60%",
            align: "left",
            renderCell: (activity: PedagogyActivity) => (
                <div className="flex items-center gap-3 py-1">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-tile bg-brand-wash">
                        {activity.icon}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-heading">{activity.title}</p>
                        <p className="truncate text-xs text-faint">{activity.name}</p>
                    </div>
                </div>
            ),
        },
        {
            key: "elements",
            label: "Pedagogy Elements",
            width: "30%",
            align: "center",
            renderCell: (activity: PedagogyActivity) => (
                <button
                    type="button"
                    onClick={() => handleViewElements(activity)}
                    className="inline-flex h-7 items-center gap-1.5 rounded-chip border border-brand-500/20 bg-brand-wash px-2.5 text-xs font-medium text-brand-strong transition-colors duration-150 hover:bg-brand-wash-hover"
                    title={activity.elements.length > 0 ? "View elements" : "Add an element"}
                >
                    <Layers className="h-3.5 w-3.5" />
                    {activity.elements.length > 0
                        ? `${activity.elements.length} element${activity.elements.length !== 1 ? "s" : ""}`
                        : "Add elements"}
                </button>
            ),
        },
    ];

    const isLoadingMutation =
        createElementMutation.isPending ||
        updateElementMutation.isPending ||
        deleteElementMutation.isPending;

    // Show loading state
    if (isLoading) {
        return (
            <div className="pb-6">
                <TabCard>
                    <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-9 w-9 rounded-tile" />
                            <div>
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="mt-1.5 h-3 w-56" />
                            </div>
                        </div>
                        <Skeleton className="h-7 w-24 rounded-full" />
                    </div>
                    <div className="border-b border-hairline px-4 py-3">
                        <Skeleton className="h-9 w-64 rounded-control" />
                    </div>
                    <SkeletonTable rows={3} cols={2} />
                </TabCard>
            </div>
        );
    }

    // Show error state
    if (error) {
        return (
            <div className="pb-6">
                <TabCard>
                    <EmptyState
                        icon={AlertTriangle}
                        title="Couldn't load pedagogy data"
                        message="Something went wrong while fetching pedagogy structures. Please try again."
                        className="py-16"
                    />
                </TabCard>
            </div>
        );
    }

    return (
        <div className="pb-6">
            <TabCard>
                <TabCardHeader
                    icon={BookOpen}
                    title="Pedagogy"
                    subtitle="Manage teaching methodologies and their elements"
                    actions={
                        (structures && structures.length > 0)
                            ? <StatusPill tone="success" dot>Live data</StatusPill>
                            : <StatusPill tone="neutral" dot>No data</StatusPill>
                    }
                />

                <Toolbar
                    search={{
                        value: searchTerm,
                        onChange: setSearchTerm,
                        placeholder: "Search activities…",
                    }}
                    filters={<CountPill value={filteredActivities.length} label="activities" />}
                />

                {filteredActivities.length === 0 ? (
                    searchTerm ? (
                        <EmptyState
                            icon={Search}
                            title={`No matches for “${searchTerm}”`}
                            message="Try a different activity name."
                            secondaryAction={
                                <Button variant="outline" onClick={() => setSearchTerm("")}>
                                    Clear search
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={BookOpen}
                            title="No pedagogy structure yet"
                            message="Pedagogy activities will appear here once a structure exists for your institution."
                        />
                    )
                ) : (
                    <div className="overflow-x-auto">
                        <UserTable
                            users={paginatedActivities}
                            isLoading={isLoading}
                            columns={columns}
                            actionButtons={false as any}
                            pagination={{
                                currentPage: currentPage,
                                totalPages: totalPages,
                                totalItems: filteredActivities.length,
                                itemsPerPage: ITEMS_PER_PAGE,
                                onPageChange: (page) => setCurrentPage(page),
                                itemLabel: "activities",
                            }}
                        />
                    </div>
                )}
            </TabCard>

            {/* Elements popup */}
            <Modal
                open={showElementsPopup && Boolean(selectedActivity)}
                onClose={() => setShowElementsPopup(false)}
                title={selectedActivity?.title}
                description="Pedagogy elements for this activity"
                size="lg"
                footer={
                    selectedActivity ? (
                        <div className="flex w-full flex-wrap items-center justify-between gap-3">
                            <p className="text-xs text-subtle">
                                Showing <span className="font-medium text-heading tabular-nums">{paginatedElements.length}</span> of{" "}
                                <span className="font-medium text-heading tabular-nums">{selectedActivity.elements.length}</span>{" "}
                                elements
                            </p>
                            <MiniPager
                                page={elementCurrentPage}
                                totalPages={totalElementPages}
                                onPrev={() => setElementCurrentPage((p) => Math.max(1, p - 1))}
                                onNext={() => setElementCurrentPage((p) => Math.min(totalElementPages, p + 1))}
                                prevDisabled={elementCurrentPage === 1 || isLoadingMutation}
                                nextDisabled={elementCurrentPage === totalElementPages || totalElementPages === 0 || isLoadingMutation}
                            />
                        </div>
                    ) : null
                }
            >
                {selectedActivity ? (
                    <div className="-mx-5 -my-4">
                        {/* Mini toolbar */}
                        <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3">
                            <CountPill value={selectedActivity.elements.length} label="elements" />
                            {canAdd && (
                                <Button size="sm" onClick={handleAddNewElement} disabled={isLoadingMutation}>
                                    <Plus className="h-4 w-4" />
                                    Add element
                                </Button>
                            )}
                        </div>

                        {selectedActivity.elements.length === 0 ? (
                            <EmptyState
                                icon={Layers}
                                title="No elements yet"
                                message={`Add the first element for ${selectedActivity.title}.`}
                                primaryAction={
                                    canAdd ? (
                                        <Button size="sm" onClick={handleAddNewElement} disabled={isLoadingMutation}>
                                            <Plus className="h-4 w-4" />
                                            Add element
                                        </Button>
                                    ) : undefined
                                }
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse" style={{ minWidth: 480 }}>
                                    <thead>
                                        <tr>
                                            <th className={`${TH_CLASS} w-16 text-center`}>S.No</th>
                                            <th className={TH_CLASS}>Element</th>
                                            <th className={`${TH_CLASS} w-24 text-right`}>
                                                <span className="sr-only">Actions</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedElements.map((element, index) => {
                                            const elementIndex = (elementCurrentPage - 1) * ITEMS_PER_PAGE + index;
                                            return (
                                                <tr
                                                    key={element.id}
                                                    className="border-b border-hairline transition-colors last:border-0 hover:bg-row-hover"
                                                >
                                                    <td className={`${TD_CLASS} text-center`}>
                                                        <span className="text-sm tabular-nums text-subtle">{elementIndex + 1}</span>
                                                    </td>
                                                    <td className={TD_CLASS}>
                                                        <span className="text-sm font-medium text-heading">{element.name}</span>
                                                    </td>
                                                    <td className={`${TD_CLASS} text-right`}>
                                                        <div className="flex justify-end gap-1">
                                                            {canEdit && (
                                                                <RowIconButton
                                                                    label="Edit element"
                                                                    disabled={isLoadingMutation}
                                                                    onClick={() => handleEditElement(element)}
                                                                >
                                                                    <Edit className="h-3.5 w-3.5" />
                                                                </RowIconButton>
                                                            )}
                                                            {canDelete && (
                                                                <RowIconButton
                                                                    label="Delete element"
                                                                    danger
                                                                    disabled={isLoadingMutation}
                                                                    onClick={() => handleDeleteElement(element)}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </RowIconButton>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : null}
            </Modal>

            {/* Element form */}
            <Modal
                open={showElementForm}
                onClose={() => setShowElementForm(false)}
                title={editingElement ? "Edit element" : "Add element"}
                description={
                    editingElement
                        ? "Update the details of this element."
                        : `Add a new element to the “${selectedActivity?.title}” activity.`
                }
                size="sm"
                footer={
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowElementForm(false)}
                            disabled={isLoadingMutation}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" form="pedagogy-element-form" disabled={isLoadingMutation}>
                            {isLoadingMutation ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {editingElement ? "Updating…" : "Creating…"}
                                </>
                            ) : editingElement ? (
                                "Update element"
                            ) : (
                                "Create element"
                            )}
                        </Button>
                    </>
                }
            >
                <form id="pedagogy-element-form" onSubmit={handleElementSubmit} className="space-y-4">
                    <Field label="Element name" required hint="Name of the teaching element or strategy.">
                        <Input
                            type="text"
                            leading={Layers}
                            value={elementFormData.name}
                            onChange={(e) =>
                                setElementFormData((prev) => ({ ...prev, name: e.target.value }))
                            }
                            placeholder="e.g. Think-Pair-Share"
                            required
                            disabled={isLoadingMutation}
                        />
                    </Field>
                </form>
            </Modal>

            {/* Delete confirmation */}
            <ConfirmDeleteModal
                open={showDeleteConfirm && Boolean(elementToDelete)}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={confirmDeleteElement}
                title="Delete element"
                entityName={elementToDelete?.name}
                isPending={deleteElementMutation.isPending}
            />
        </div>
    );
}
