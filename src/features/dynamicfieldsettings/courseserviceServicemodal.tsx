"use client";
import { getToken } from "@/lib/session";

import { Button } from '@/components/ui/button';
import {
  Plus, Building, Search, Edit, Trash2, Loader2, Layers,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  useServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
  useCreateServiceModal,
  useUpdateServiceModal,
  useDeleteServiceModal
} from '@/apiServices/dynamicFields/servicemodel';
import {
  Modal,
  Toolbar,
  EmptyState,
  Field,
  Input,
  Textarea,
  Skeleton,
} from '@/app/lms/shared/ui';
import {
  TabCard,
  TabCardHeader,
  CountPill,
  MiniPager,
  ConfirmDeleteModal,
  RowIconButton,
  TH_CLASS,
  TD_CLASS,
} from './ui';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_IDS } from '@/components/permissions';

interface ServiceModal {
  id: string;
  name: string;
  description: string;
}

interface Service {
  id: string;
  name: string;
  status: 'Active' | 'Inactive';
  description: string;
  serviceModals: ServiceModal[];
}

interface ServiceFormData {
  name: string;
  description: string;
}

interface ModelFormData {
  name: string;
  description: string;
}

const ITEMS_PER_PAGE = 5;

export default function ServiceManagementComponent() {
  // Tab visibility is already gated by DynamicFieldSettingsPage — this component
  // only renders when the user has the 'Service Modal' functionality, so the
  // parent-level check here just governs which action buttons are shown.
  const { can } = usePermissions();
  const canAdd = can(PERMISSION_IDS.ADMIN_DYNAMIC_FIELD_SETTINGS, 'Service Modal');
  const canEdit = canAdd;
  const canDelete = canAdd;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showServiceModalsPopup, setShowServiceModalsPopup] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showModelForm, setShowModelForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingModel, setEditingModel] = useState<ServiceModal | null>(null);
  const [serviceFormData, setServiceFormData] = useState<ServiceFormData>({ name: '', description: '' });
  const [modelFormData, setModelFormData] = useState<ModelFormData>({ name: '', description: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [modelCurrentPage, setModelCurrentPage] = useState(1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [showModelDeleteConfirm, setShowModelDeleteConfirm] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<ServiceModal | null>(null);

  const [token, setToken] = useState<string | null>(null);
  const institutionId = typeof window !== 'undefined' ? localStorage.getItem('smartcliff_institution') || '' : '';

  useEffect(() => {
    const storedToken = getToken();
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  // React Query hooks
  const {
    data: services = [],
    isLoading: isLoadingServices,
    isFetching: isFetchingServices,
  } = useServices(institutionId, token || '');

  const createServiceMutation = useCreateService();
  const updateServiceMutation = useUpdateService();
  const deleteServiceMutation = useDeleteService();
  const createServiceModalMutation = useCreateServiceModal();
  const updateServiceModalMutation = useUpdateServiceModal();
  const deleteServiceModalMutation = useDeleteServiceModal();

  // Filter services based on search
  const filteredServices = services.filter((service: Service) =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredServices.length / ITEMS_PER_PAGE);
  const paginatedServices = filteredServices.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const totalModelPages = selectedService ? Math.ceil(selectedService.serviceModals.length / ITEMS_PER_PAGE) : 0;
  const paginatedModels = selectedService ? selectedService.serviceModals.slice(
    (modelCurrentPage - 1) * ITEMS_PER_PAGE,
    modelCurrentPage * ITEMS_PER_PAGE
  ) : [];

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleViewServiceModals = (service: Service) => {
    setSelectedService(service);
    setShowServiceModalsPopup(true);
    setModelCurrentPage(1);
  };

  const handleAddNewService = () => {
    setEditingService(null);
    setServiceFormData({ name: '', description: '' });
    setShowServiceForm(true);
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setServiceFormData({ name: service.name, description: service.description });
    setShowServiceForm(true);
  };

  const handleDeleteService = (service: Service) => {
    setServiceToDelete(service);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteService = async () => {
    if (!serviceToDelete) return;
    try {
      if (!token) throw new Error("Authentication token not found.");
      await deleteServiceMutation.mutateAsync({ id: serviceToDelete.id, token });
      toast.success('Service deleted successfully');
      setShowDeleteConfirm(false);
      if (paginatedServices.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    } catch (error: any) {
      console.error('Error deleting service:', error);
      toast.error(error.message || 'Error deleting service');
    } finally {
      setServiceToDelete(null);
    }
  };

  const handleDeleteModel = (model: ServiceModal) => {
    setModelToDelete(model);
    setShowModelDeleteConfirm(true);
  };

  const confirmDeleteModel = async () => {
    if (!modelToDelete || !selectedService) return;
    try {
      if (!token) throw new Error("Authentication token not found.");
      await deleteServiceModalMutation.mutateAsync({
        serviceId: selectedService.id,
        modalId: modelToDelete.id,
        institutionId: institutionId,
        token
      });
      toast.success('Model deleted successfully');
      setShowModelDeleteConfirm(false);
    } catch (error: any) {
      console.error('Error deleting model:', error);
      toast.error(error.message || 'Error deleting model');
    } finally {
      setModelToDelete(null);
    }
  };

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const serviceData = {
        name: serviceFormData.name,
        title: serviceFormData.name,
        description: serviceFormData.description
      };

      if (editingService) {
        if (!token) throw new Error("Authentication token not found.");
        await updateServiceMutation.mutateAsync({
          id: editingService.id,
          data: serviceData,
          token
        });
        toast.success('Service updated successfully');
      } else {
        if (!token) throw new Error("Authentication token not found.");
        await createServiceMutation.mutateAsync({ serviceData, token });
        toast.success('Service created successfully');
        setCurrentPage(1);
      }
      setShowServiceForm(false);
    } catch (error: any) {
      console.error('Error submitting service:', error);
      toast.error(error.message || 'Error submitting service');
    }
  };

  const handleAddNewModel = () => {
    setEditingModel(null);
    setModelFormData({ name: '', description: '' });
    setShowModelForm(true);
  };

  const handleEditModel = (model: ServiceModal) => {
    setEditingModel(model);
    setModelFormData({
      name: model.name,
      description: model.description
    });
    setShowModelForm(true);
  };

  const handleModelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;

    try {
      const modalData = {
        title: modelFormData.name,
        description: modelFormData.description,
        serviceId: selectedService.id,
        institutionId: institutionId
      };

      if (editingModel) {
        if (!token) throw new Error("Authentication token not found.");
        await updateServiceModalMutation.mutateAsync({
          serviceId: selectedService.id,
          modalId: editingModel.id,
          data: {
            title: modelFormData.name,
            description: modelFormData.description
          },
          institutionId,
          token
        });
        toast.success('Model updated successfully');
      } else {
        if (!token) throw new Error("Authentication token not found.");
        await createServiceModalMutation.mutateAsync({ modalData, token });
        toast.success('Model added successfully');
      }
      setShowModelForm(false);
    } catch (error: any) {
      console.error('Error submitting model:', error);
      toast.error(error.message || 'Error submitting model');
    }
  };

  const isLoading =
    createServiceMutation.isPending ||
    updateServiceMutation.isPending ||
    deleteServiceMutation.isPending ||
    createServiceModalMutation.isPending ||
    updateServiceModalMutation.isPending ||
    deleteServiceModalMutation.isPending;

  const isFiltered = Boolean(searchTerm);
  const showEmpty = !isLoadingServices && filteredServices.length === 0;
  const savePending = isLoading;

  return (
    <div className="pb-6">
      <TabCard>
        <TabCardHeader
          icon={Building}
          title="Service models"
          subtitle="Manage service types and the models offered under each"
          actions={
            canAdd ? (
              <Button onClick={handleAddNewService} disabled={isLoadingServices}>
                <Plus className="h-4 w-4" />
                Add service
              </Button>
            ) : null
          }
        />

        <Toolbar
          search={{
            value: searchTerm,
            onChange: setSearchTerm,
            placeholder: 'Search services…',
          }}
          filters={<CountPill value={filteredServices.length} label="services" />}
        />

        {showEmpty ? (
          isFiltered ? (
            <EmptyState
              icon={Search}
              title={`No matches for “${searchTerm}”`}
              message="Try a different service name."
              secondaryAction={
                <Button variant="outline" onClick={() => setSearchTerm('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Building}
              title="No services yet"
              message="Create your first service to start defining service models."
              primaryAction={
                canAdd ? (
                  <Button onClick={handleAddNewService}>
                    <Plus className="h-4 w-4" />
                    Add service
                  </Button>
                ) : undefined
              }
            />
          )
        ) : (
          <>
            <div className="min-h-[280px] overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 720 }}>
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className={`${TH_CLASS} w-16 text-center`}>S.No</th>
                    <th className={TH_CLASS}>Service</th>
                    <th className={TH_CLASS}>Description</th>
                    <th className={`${TH_CLASS} text-center`}>Models</th>
                    <th className={`${TH_CLASS} w-24 text-right`}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingServices ? (
                    Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
                      <tr key={`skeleton-${index}`} className="border-b border-hairline last:border-0">
                        <td className={`${TD_CLASS} text-center`}>
                          <Skeleton className="mx-auto h-3.5 w-6" />
                        </td>
                        <td className={TD_CLASS}>
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-8 w-8 rounded-tile" />
                            <div className="flex-1 space-y-1.5">
                              <Skeleton className="h-3.5 w-2/3" />
                              <Skeleton className="h-3 w-1/3" />
                            </div>
                          </div>
                        </td>
                        <td className={TD_CLASS}>
                          <Skeleton className="h-3.5 w-3/4" />
                        </td>
                        <td className={`${TD_CLASS} text-center`}>
                          <Skeleton className="mx-auto h-6 w-20 rounded-chip" />
                        </td>
                        <td className={`${TD_CLASS} text-right`}>
                          <div className="flex justify-end gap-1.5">
                            <Skeleton className="h-7 w-7 rounded-chip" />
                            <Skeleton className="h-7 w-7 rounded-chip" />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : isFetchingServices ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-brand-strong" />
                          <span className="text-sm text-subtle">Refreshing data…</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedServices.map((service: Service, index: number) => (
                      <tr
                        key={service.id}
                        className="border-b border-hairline transition-colors last:border-0 hover:bg-row-hover"
                      >
                        <td className={`${TD_CLASS} text-center`}>
                          <span className="text-sm tabular-nums text-subtle">
                            {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                          </span>
                        </td>
                        <td className={TD_CLASS}>
                          <div className="flex items-center gap-3 py-1.5">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-tile bg-brand-wash">
                              <Building className="h-4 w-4 text-brand-strong" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-heading">{service.name}</p>
                              <p className="truncate text-xs text-faint tabular-nums">
                                ID #{service.id.slice(-6)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className={TD_CLASS}>
                          <span
                            className="block max-w-[360px] truncate text-sm text-body"
                            title={service.description}
                          >
                            {service.description}
                          </span>
                        </td>
                        <td className={`${TD_CLASS} text-center`}>
                          <button
                            type="button"
                            onClick={() => handleViewServiceModals(service)}
                            className="inline-flex h-7 items-center gap-1.5 rounded-chip border border-brand-500/20 bg-brand-wash px-2.5 text-xs font-medium text-brand-strong transition-colors duration-150 hover:bg-brand-wash-hover"
                            title={service.serviceModals.length > 0 ? 'View models' : 'Add a model'}
                          >
                            <Layers className="h-3.5 w-3.5" />
                            {service.serviceModals.length > 0
                              ? `${service.serviceModals.length} model${service.serviceModals.length !== 1 ? 's' : ''}`
                              : 'Add models'}
                          </button>
                        </td>
                        <td className={`${TD_CLASS} text-right`}>
                          <div className="flex justify-end gap-1">
                            {canEdit && (
                              <RowIconButton label="Edit service" onClick={() => handleEditService(service)}>
                                <Edit className="h-3.5 w-3.5" />
                              </RowIconButton>
                            )}
                            {canDelete && (
                              <RowIconButton
                                label="Delete service"
                                danger
                                onClick={() => handleDeleteService(service)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </RowIconButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-5 py-3">
              <p className="text-xs text-subtle">
                Showing <span className="font-medium text-heading tabular-nums">{paginatedServices.length}</span> of{' '}
                <span className="font-medium text-heading tabular-nums">{filteredServices.length}</span> services
              </p>
              <MiniPager
                page={currentPage}
                totalPages={totalPages}
                onPrev={() => setCurrentPage(p => Math.max(1, p - 1))}
                onNext={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                prevDisabled={currentPage === 1 || isLoadingServices}
                nextDisabled={currentPage === totalPages || isLoadingServices || totalPages === 0}
              />
            </div>
          </>
        )}
      </TabCard>

      {/* Service models popup */}
      <Modal
        open={showServiceModalsPopup && Boolean(selectedService)}
        onClose={() => setShowServiceModalsPopup(false)}
        title="Service models"
        description={selectedService?.name}
        size="xl"
        footer={
          selectedService ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-subtle">
                Showing <span className="font-medium text-heading tabular-nums">{paginatedModels.length}</span> of{' '}
                <span className="font-medium text-heading tabular-nums">{selectedService.serviceModals.length}</span>{' '}
                models
              </p>
              <MiniPager
                page={modelCurrentPage}
                totalPages={totalModelPages}
                onPrev={() => setModelCurrentPage(p => Math.max(1, p - 1))}
                onNext={() => setModelCurrentPage(p => Math.min(totalModelPages, p + 1))}
                prevDisabled={modelCurrentPage === 1 || isLoading}
                nextDisabled={modelCurrentPage === totalModelPages || isLoading || totalModelPages === 0}
              />
            </div>
          ) : null
        }
      >
        {selectedService ? (
          <div className="-mx-5 -my-4">
            {/* Mini toolbar */}
            <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3">
              <CountPill value={selectedService.serviceModals.length} label="models" />
              {canAdd && (
                <Button size="sm" onClick={handleAddNewModel} disabled={isLoading}>
                  <Plus className="h-4 w-4" />
                  Add model
                </Button>
              )}
            </div>

            {selectedService.serviceModals.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No models yet"
                message={`Add the first model for ${selectedService.name}.`}
                primaryAction={
                  canAdd ? (
                    <Button size="sm" onClick={handleAddNewModel} disabled={isLoading}>
                      <Plus className="h-4 w-4" />
                      Add model
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th className={`${TH_CLASS} w-16 text-center`}>S.No</th>
                      <th className={TH_CLASS}>Model</th>
                      <th className={TH_CLASS}>Description</th>
                      <th className={`${TH_CLASS} w-24 text-right`}>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedModels.map((model: ServiceModal, index: number) => {
                      const modelIndex = (modelCurrentPage - 1) * ITEMS_PER_PAGE + index;
                      return (
                        <tr
                          key={model.id}
                          className="border-b border-hairline transition-colors last:border-0 hover:bg-row-hover"
                        >
                          <td className={`${TD_CLASS} text-center`}>
                            <span className="text-sm tabular-nums text-subtle">{modelIndex + 1}</span>
                          </td>
                          <td className={TD_CLASS}>
                            <p className="text-sm font-medium text-heading">{model.name}</p>
                            <p className="text-xs text-faint tabular-nums">ID #{model.id.slice(-6)}</p>
                          </td>
                          <td className={TD_CLASS}>
                            <span className="block max-w-[320px] truncate text-sm text-body" title={model.description}>
                              {model.description}
                            </span>
                          </td>
                          <td className={`${TD_CLASS} text-right`}>
                            <div className="flex justify-end gap-1">
                              {canEdit && (
                                <RowIconButton
                                  label="Edit model"
                                  disabled={isLoading}
                                  onClick={() => handleEditModel(model)}
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </RowIconButton>
                              )}
                              {canDelete && (
                                <RowIconButton
                                  label="Delete model"
                                  danger
                                  disabled={isLoading}
                                  onClick={() => handleDeleteModel(model)}
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

      {/* Service form */}
      <Modal
        open={showServiceForm}
        onClose={() => setShowServiceForm(false)}
        title={editingService ? 'Edit service' : 'Add service'}
        description={
          editingService
            ? 'Update the details of the existing service.'
            : 'Create a new service for your institution.'
        }
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowServiceForm(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" form="service-form" disabled={isLoading}>
              {savePending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {editingService ? 'Updating…' : 'Creating…'}
                </>
              ) : editingService ? (
                'Update service'
              ) : (
                'Create service'
              )}
            </Button>
          </>
        }
      >
        <form id="service-form" onSubmit={handleServiceSubmit} className="space-y-4">
          <Field label="Service name" required hint="The official name of the service.">
            <Input
              type="text"
              leading={Building}
              value={serviceFormData.name}
              onChange={(e) => setServiceFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Software Development"
              required
              disabled={isLoading}
            />
          </Field>

          <Field label="Description" required hint="A brief summary of what this service includes.">
            <Textarea
              value={serviceFormData.description}
              onChange={(e) => setServiceFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the service…"
              rows={4}
              required
              disabled={isLoading}
            />
          </Field>
        </form>
      </Modal>

      {/* Model form */}
      <Modal
        open={showModelForm}
        onClose={() => setShowModelForm(false)}
        title={editingModel ? 'Edit model' : 'Add model'}
        description={
          editingModel
            ? 'Update the details of this model.'
            : `Add a new model to the “${selectedService?.name}” service.`
        }
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModelForm(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" form="model-form" disabled={isLoading}>
              {savePending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {editingModel ? 'Updating…' : 'Creating…'}
                </>
              ) : editingModel ? (
                'Update model'
              ) : (
                'Create model'
              )}
            </Button>
          </>
        }
      >
        <form id="model-form" onSubmit={handleModelSubmit} className="space-y-4">
          <Field label="Model name" required hint="A specific variation or type of the service.">
            <Input
              type="text"
              leading={Layers}
              value={modelFormData.name}
              onChange={(e) => setModelFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Frontend Development"
              required
              disabled={isLoading}
            />
          </Field>

          <Field label="Description" required hint="Describe what this specific model entails.">
            <Textarea
              value={modelFormData.description}
              onChange={(e) => setModelFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the model…"
              rows={4}
              required
              disabled={isLoading}
            />
          </Field>
        </form>
      </Modal>

      {/* Delete service confirmation */}
      <ConfirmDeleteModal
        open={showDeleteConfirm && Boolean(serviceToDelete)}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDeleteService}
        title="Delete service"
        entityName={serviceToDelete?.name}
        isPending={deleteServiceMutation.isPending}
      />

      {/* Delete model confirmation */}
      <ConfirmDeleteModal
        open={showModelDeleteConfirm && Boolean(modelToDelete)}
        onClose={() => setShowModelDeleteConfirm(false)}
        onConfirm={confirmDeleteModel}
        title="Delete model"
        entityName={modelToDelete?.name}
        isPending={deleteServiceModalMutation.isPending}
      />
    </div>
  );
}
