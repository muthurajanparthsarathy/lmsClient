// app/admin/pages/institution/page.tsx
"use client";

import React from 'react'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { PlusIcon, Search, Building2, Phone, MapPin, User, Eye, Edit, Copy, Trash2, CheckCircle, XCircle, Loader2, X, Mail, ChevronDown, ChevronUp, Filter, Calendar, Hash, MoreVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { UserTable } from '@/components/ui/alterationTable';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { institutionApi, Institution } from '@/app/lms/pages/instutionmanagement/api/institutionService';
import AddInstitutionForm from '@/app/lms/pages/instutionmanagement/components/AddInstitutionForm';
import DashboardLayout from '@/app/lms/component/layout';

// Custom Dropdown Component
interface CustomDropdownProps {
  institution: Institution;
  onViewDetails: (institution: Institution) => void;
  onEdit: (institutionId: string) => void;
  onDuplicate: (institutionId: string) => void;
  onDelete: (institution: Institution) => void;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({ 
  institution, 
  onViewDetails, 
  onEdit, 
  onDuplicate, 
  onDelete 
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleAction = (action: string) => {
    setIsOpen(false);
    switch (action) {
      case 'view':
        onViewDetails(institution);
        break;
      case 'edit':
        onEdit(institution._id);
        break;
      case 'duplicate':
        onDuplicate(institution._id);
        break;
      case 'delete':
        onDelete(institution);
        break;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all duration-200 group"
      >
        <MoreVertical className="h-3 w-3 text-gray-600 group-hover:text-gray-700" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1"
          >
            <button
              onClick={() => handleAction('view')}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left transition-colors"
            >
              <Eye className="h-4 w-4 text-blue-600" />
              View Full Details
            </button>
            
            <button
              onClick={() => handleAction('edit')}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left transition-colors"
            >
              <Edit className="h-4 w-4 text-blue-600" />
              Edit Institution
            </button>
            
            <button
              onClick={() => handleAction('duplicate')}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left transition-colors"
            >
              <Copy className="h-4 w-4 text-purple-600" />
              Duplicate
            </button>
            
            <div className="border-t border-gray-200 my-1"></div>
            
            <button
              onClick={() => handleAction('delete')}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete Institution
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Status Badge Component
const StatusBadge = ({ isActive }: { isActive: boolean }) => {
  if (isActive) {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 px-2 py-0.5 text-xs font-medium">
        <CheckCircle className="h-3 w-3 mr-1" />
        Active
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-gray-600 border-gray-300 hover:bg-gray-50 px-2 py-0.5 text-xs font-medium">
      <XCircle className="h-3 w-3 mr-1" />
      Inactive
    </Badge>
  );
};

// Full Details Overlay Component
interface FullDetailsOverlayProps {
  institution: Institution | null;
  onClose: () => void;
  onEdit: (institutionId: string) => void;
}

const FullDetailsOverlay: React.FC<FullDetailsOverlayProps> = ({ 
  institution, 
  onClose, 
  onEdit 
}) => {
  if (!institution) return null;

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const overlayVariants = {
    hidden: {
      opacity: 0,
      y: 20,
      scale: 0.98,
      transition: { duration: 0.2 }
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { 
        duration: 0.3,
        ease: "easeOut",
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    },
    exit: {
      opacity: 0,
      y: 20,
      scale: 0.98,
      transition: { duration: 0.2 }
    }
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <AnimatePresence>
      {institution && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-white">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-200">
                  <Building2 className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{institution.inst_name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full">
                      <Hash className="w-3 h-3 text-gray-600" />
                      <span className="text-xs font-mono font-semibold text-gray-700">
                        {institution.inst_id}
                      </span>
                    </div>
                    <StatusBadge isActive={institution.isActive} />
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-9 w-9 rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  <motion.div 
                    className="bg-gray-50 rounded-xl p-5 border border-gray-200"
                    variants={itemVariants}
                  >
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      Basic Information
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                          Institution Name
                        </label>
                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                          <div className="p-2 bg-indigo-50 rounded-lg">
                            <Building2 className="w-4 h-4 text-indigo-600" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {institution.inst_name}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                          Institution Owner
                        </label>
                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                          <div className="p-2 bg-indigo-50 rounded-lg">
                            <User className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-900 block">
                              {institution.inst_owner}
                            </span>
                            <span className="text-xs text-gray-500 mt-0.5">
                              Primary contact
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                          Created By
                        </label>
                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                          <div className="p-2 bg-indigo-50 rounded-lg">
                            <User className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-900 block">
                              {institution.createdBy}
                            </span>
                            <span className="text-xs text-gray-500 mt-0.5">
                              System administrator
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div 
                    className="bg-gray-50 rounded-xl p-5 border border-gray-200"
                    variants={itemVariants}
                  >
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-indigo-600" />
                      Contact Details
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                          Phone Number
                        </label>
                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                          <div className="p-2 bg-indigo-50 rounded-lg">
                            <Phone className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-900 block">
                              {institution.phone}
                            </span>
                            <span className="text-xs text-gray-500 mt-0.5">
                              10-digit contact number
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                          Email Contact
                        </label>
                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                          <div className="p-2 bg-indigo-50 rounded-lg">
                            <Mail className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-900 block">
                              Not specified
                            </span>
                            <span className="text-xs text-gray-500 mt-0.5">
                              Use phone for contact
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  <motion.div 
                    className="bg-gray-50 rounded-xl p-5 border border-gray-200"
                    variants={itemVariants}
                  >
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-indigo-600" />
                      Location Information
                    </h3>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                        Full Address
                      </label>
                      <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 min-h-[100px]">
                        <div className="p-2 bg-indigo-50 rounded-lg flex-shrink-0">
                          <MapPin className="w-4 h-4 text-indigo-600" />
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-line">
                          {institution.address || "No address provided. Please add address details."}
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div 
                    className="bg-gray-50 rounded-xl p-5 border border-gray-200"
                    variants={itemVariants}
                  >
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      Timeline & Activity
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                          Created On
                        </label>
                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                          <div className="p-2 bg-indigo-50 rounded-lg">
                            <Calendar className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-900 block">
                              {formatDate(institution.createdAt)}
                            </span>
                            <span className="text-xs text-gray-500 mt-0.5">
                              Date of registration
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                          Last Updated
                        </label>
                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                          <div className="p-2 bg-indigo-50 rounded-lg">
                            <Calendar className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-900 block">
                              {formatDate(institution.updatedAt)}
                            </span>
                            <span className="text-xs text-gray-500 mt-0.5">
                              Most recent modification
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium">Institution ID:</span>
                  <code className="bg-gray-200 px-2 py-1 rounded text-xs font-mono">
                    {institution.inst_id}
                  </code>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="text-sm h-10 font-medium"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      onClose();
                      onEdit(institution._id);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-sm h-10 font-medium"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Institution
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default function InstitutionManagementPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<'date' | 'name' | 'owner' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [institutionToDelete, setInstitutionToDelete] = useState<Institution | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [institutionToEdit, setInstitutionToEdit] = useState<string | null>(null);
  const [showFullDetailsOverlay, setShowFullDetailsOverlay] = useState(false);
  const [institutionForDetails, setInstitutionForDetails] = useState<Institution | null>(null);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate statistics
  const calculateStatistics = (institutions: Institution[]) => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const totalInstitutions = institutions.length;
    const recentInstitutions = institutions.filter(inst => 
      new Date(inst.createdAt) >= sevenDaysAgo
    ).length;
    const activeInstitutions = institutions.filter(inst => inst.isActive === true).length;
    const inactiveInstitutions = institutions.filter(inst => inst.isActive === false).length;

    return {
      total: totalInstitutions,
      recent: recentInstitutions,
      active: activeInstitutions,
      inactive: inactiveInstitutions
    };
  };

  // Handle sort
  const handleSort = (field: 'date' | 'name' | 'owner') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get sort icon
  const getSortIcon = (field: 'date' | 'name' | 'owner') => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-60" />;
    }
    return sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // React Query for institutions
  const { data: institutions = [], isLoading, error } = useQuery(institutionApi.getAll());

  // Get institution data for editing
  const { data: institutionData } = useQuery(
    institutionToEdit ? institutionApi.getById(institutionToEdit) : { queryKey: [], queryFn: () => null }
  );

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (institutionId: string) => institutionApi.delete(institutionId).mutationFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutions'] });
      setShowDeleteModal(false);
      setInstitutionToDelete(null);
    },
    onError: (error: Error) => {
      console.error('Delete failed:', error);
    }
  });

  // Calculate statistics
  const statistics = calculateStatistics(institutions);
  
  // Filter institutions
  let filteredInstitutions = institutions.filter((institution: Institution) => {
    const matchesSearch = 
      institution.inst_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      institution.inst_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      institution.inst_owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
      institution.phone.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && institution.isActive) ||
      (statusFilter === 'inactive' && !institution.isActive);

    return matchesSearch && matchesStatus;
  });

  // Apply sorting
  if (sortField) {
    filteredInstitutions = [...filteredInstitutions].sort((a, b) => {
      let aValue, bValue;

      switch (sortField) {
        case 'date':
          aValue = new Date(a.updatedAt).getTime();
          bValue = new Date(b.updatedAt).getTime();
          break;
        case 'name':
          aValue = a.inst_name.toLowerCase();
          bValue = b.inst_name.toLowerCase();
          break;
        case 'owner':
          aValue = a.inst_owner.toLowerCase();
          bValue = b.inst_owner.toLowerCase();
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  } else {
    // Default sort by date (newest first)
    filteredInstitutions = filteredInstitutions.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  // Handle dropdown actions
  const handleViewFullDetails = (institution: Institution) => {
    setInstitutionForDetails(institution);
    setShowFullDetailsOverlay(true);
  };

  const handleEditInstitution = (institutionId: string) => {
    setInstitutionToEdit(institutionId);
    setIsModalOpen(true);
  };

  const handleDuplicateInstitution = (institutionId: string) => {
    console.log('Duplicate institution:', institutionId);
    // You can implement duplication logic here
  };

  const handleDeleteInstitution = (institution: Institution) => {
    setInstitutionToDelete(institution);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!institutionToDelete) return;
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(institutionToDelete._id);
    } finally {
      setIsDeleting(false);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setStatusFilter('all');
  };

  // Table columns configuration
  const columns = [
    {
      key: 'inst_id',
      label: 'ID',
      width: '10%',
      align: 'left' as const,
      renderCell: (institution: Institution) => (
        <div className="flex items-center gap-2">
          <div className="p-1 bg-indigo-100 rounded">
            <Hash className="h-3 w-3 text-indigo-600" />
          </div>
          <span className="text-xs font-mono font-semibold text-gray-900">
            {institution.inst_id}
          </span>
        </div>
      )
    },
    {
      key: 'inst_name',
      label: (
        <div className="flex items-center cursor-pointer hover:text-gray-900 transition-colors" onClick={() => handleSort('name')}>
          <span className="text-xs font-semibold text-gray-700">Institution Name</span>
          {getSortIcon('name')}
        </div>
      ),
      width: '20%',
      align: 'left' as const,
      renderCell: (institution: Institution) => (
        <button
          onClick={() => setSelectedInstitution(institution)}
          className="flex flex-col text-left w-full hover:bg-gray-50 rounded px-1 py-1 transition-colors"
        >
          <span className="text-sm font-semibold text-gray-900 truncate">
            {institution.inst_name}
          </span>
          <span className="text-xs text-gray-500 mt-0.5">
            Created by: {institution.createdBy}
          </span>
        </button>
      )
    },
    {
      key: 'inst_owner',
      label: (
        <div className="flex items-center cursor-pointer hover:text-gray-900 transition-colors" onClick={() => handleSort('owner')}>
          <span className="text-xs font-semibold text-gray-700">Owner</span>
          {getSortIcon('owner')}
        </div>
      ),
      width: '15%',
      align: 'left' as const,
      renderCell: (institution: Institution) => (
        <div className="flex items-center gap-2">
          <User className="h-3 w-3 text-gray-400" />
          <span className="text-sm text-gray-900">{institution.inst_owner}</span>
        </div>
      )
    },
    {
      key: 'contact',
      label: 'Contact',
      width: '15%',
      align: 'left' as const,
      renderCell: (institution: Institution) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <Phone className="h-3 w-3 text-gray-400" />
            <span className="text-xs font-medium text-gray-900">{institution.phone}</span>
          </div>
          <div className="flex items-center gap-1">
            <Mail className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-500 truncate">Contact via phone</span>
          </div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      width: '10%',
      align: 'center' as const,
      renderCell: (institution: Institution) => <StatusBadge isActive={institution.isActive} />
    },
    {
      key: 'date',
      label: (
        <div className="flex items-center cursor-pointer hover:text-gray-900 transition-colors" onClick={() => handleSort('date')}>
          <span className="text-xs font-semibold text-gray-700">Created</span>
          {getSortIcon('date')}
        </div>
      ),
      width: '15%',
      align: 'left' as const,
      renderCell: (institution: Institution) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-3 w-3 text-gray-400" />
          <span className="text-xs text-gray-600">{formatDate(institution.createdAt)}</span>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '15%',
      align: 'center' as const,
      renderCell: (institution: Institution) => (
        <div className="flex gap-1 justify-center">
          <CustomDropdown
            institution={institution}
            onViewDetails={handleViewFullDetails}
            onEdit={handleEditInstitution}
            onDuplicate={handleDuplicateInstitution}
            onDelete={handleDeleteInstitution}
          />
        </div>
      )
    }
  ];

  const itemsPerPage = 10;
  const paginatedData = filteredInstitutions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const popupVariants = {
    hidden: {
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.15 }
    },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.2, ease: "easeOut" }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.1 }
    }
  } as const;

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="min-h-screen"
      >
        {/* Full width container */}
        <div className="w-full px-0">
          {/* Compact Header Section */}
          <div className="bg-white border-b border-gray-200 w-full px-6 py-4">
            <div className="flex flex-col gap-4 w-full">
              {/* Top Row - Title and Actions */}
              <div className="flex items-center justify-between w-full">
                <div className="flex flex-col gap-1">
                  <Breadcrumb className="flex-shrink-0">
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink 
                          href="/admin/pages/admindashboard" 
                          className="text-xs text-blue-500 hover:text-indigo-600 transition-colors font-medium"
                        >
                          Dashboard
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator className="text-gray-400" />
                      <BreadcrumbItem>
                        <BreadcrumbPage className="text-xs font-semibold text-gray-900">
                          Institution Management
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                  
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                      Institutions
                    </h1>
                    <div className="h-4 w-px bg-gray-300"></div>
                    <span className="text-sm text-gray-600 font-medium">
                      {filteredInstitutions.length} institution{filteredInstitutions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setInstitutionToEdit(null);
                    setIsModalOpen(true);
                  }}
                  className="h-9 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 px-4 shadow-sm"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Institution
                </Button>
              </div>

              {/* Bottom Row - Search and Stats */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 w-full">
                {/* Search Bar */}
                <div className="flex-1 max-w-4xl">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search institutions by name, ID, owner, or phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-8 h-10 text-sm border-gray-300 focus:border-indigo-500 w-full bg-gray-50/50"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Statistics and Filter Toggle */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Statistics */}
                  <div className="flex items-center gap-2">
                    {[
                      { 
                        title: "Total", 
                        value: statistics.total, 
                        color: "bg-blue-50 text-blue-700 border-blue-200",
                        loading: isLoading
                      },
                      { 
                        title: "Recent", 
                        value: statistics.recent, 
                        color: "bg-purple-50 text-purple-700 border-purple-200",
                        loading: isLoading
                      },
                      { 
                        title: "Active", 
                        value: statistics.active, 
                        color: "bg-emerald-50 text-emerald-700 border-emerald-200",
                        loading: isLoading
                      }
                    ].map((stat, index) => (
                      <motion.div
                        key={stat.title}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${stat.color} text-xs font-medium shadow-sm`}
                      >
                        {stat.loading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <span className="font-bold text-sm">{stat.value}</span>
                        )}
                        <span className="text-xs">{stat.title}</span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Filter Toggle */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 h-9 text-xs font-medium border-gray-300 ${
                      showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : ''
                    }`}
                  >
                    <Filter className="h-4 w-4" />
                    Filters
                    {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Expandable Filters Section */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 mt-4 border-t border-gray-200">
                    {/* Status Filter */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full h-9 text-sm border border-gray-300 rounded-lg px-3 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                      >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>

                    {/* Sort Options */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Sort By
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={sortField || 'date'}
                          onChange={(e) => setSortField(e.target.value as 'date' | 'name' | 'owner' | null)}
                          className="flex-1 h-9 text-sm border border-gray-300 rounded-lg px-3 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                        >
                          <option value="date">Date Created</option>
                          <option value="name">Institution Name</option>
                          <option value="owner">Owner Name</option>
                        </select>
                        <button
                          onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                          className="h-9 px-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Clear Filters */}
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                        className="h-9 text-xs font-medium border-gray-300 hover:bg-gray-50"
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Main Content Area */}
          <div className="w-full px-6 pt-6">
            <div className="w-full">
              {/* Table Section */}
              <div className="bg-white overflow-hidden w-full">
                <UserTable
                  users={paginatedData}
                  isLoading={isLoading}
                  columns={columns}
                  pagination={{
                    currentPage: currentPage,
                    totalPages: Math.ceil(filteredInstitutions.length / itemsPerPage),
                    totalItems: filteredInstitutions.length,
                    itemsPerPage: itemsPerPage,
                    onPageChange: (page) => setCurrentPage(page),
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Full Details Overlay - Appears on top of everything */}
        <FullDetailsOverlay
          institution={institutionForDetails}
          onClose={() => {
            setShowFullDetailsOverlay(false);
            setInstitutionForDetails(null);
          }}
          onEdit={(institutionId: string) => {
            setShowFullDetailsOverlay(false);
            setInstitutionToEdit(institutionId);
            setIsModalOpen(true);
          }}
        />

        {/* Add/Edit Institution Modal - Simple direct call to AddInstitutionForm */}
        <AddInstitutionForm
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          institutionId={institutionToEdit || undefined}
          totalInstitutions={institutions.length}
          mode={institutionToEdit ? 'edit' : 'add'}
          initialData={institutionData}
        />

        {/* Quick View Modal */}
        <AnimatePresence>
          {selectedInstitution && (
            <Dialog open={!!selectedInstitution} onOpenChange={() => setSelectedInstitution(null)}>
              <DialogContent className="max-w-md bg-white rounded-xl">
                <motion.div
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={popupVariants}
                  className="w-full"
                >
                  <DialogHeader className="pb-3 border-b border-gray-200">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="p-1.5 bg-indigo-100 rounded-lg flex-shrink-0">
                          <Building2 className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <DialogTitle className="text-base font-semibold text-gray-900 truncate">
                            {selectedInstitution.inst_name}
                          </DialogTitle>
                          <DialogDescription className="text-xs text-gray-600 mt-0.5 truncate">
                            Quick view of institution details
                          </DialogDescription>
                        </div>
                      </div>
                      <StatusBadge isActive={selectedInstitution.isActive} />
                    </div>
                  </DialogHeader>

                  <div className="space-y-3 py-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <div className="bg-gray-50 rounded p-2 border border-gray-200">
                          <label className="block text-xs font-semibold text-gray-500 mb-1">
                            Institution ID
                          </label>
                          <div className="flex items-center gap-1">
                            <Hash className="w-3 h-3 text-indigo-600" />
                            <span className="text-sm font-semibold text-gray-900 font-mono">
                              {selectedInstitution.inst_id}
                            </span>
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded p-2 border border-gray-200">
                          <label className="block text-xs font-semibold text-gray-500 mb-1">
                            Owner
                          </label>
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-indigo-600" />
                            <span className="text-sm text-gray-900">
                              {selectedInstitution.inst_owner}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="bg-gray-50 rounded p-2 border border-gray-200">
                          <label className="block text-xs font-semibold text-gray-500 mb-1">
                            Phone
                          </label>
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-indigo-600" />
                            <span className="text-sm text-gray-900">
                              {selectedInstitution.phone}
                            </span>
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded p-2 border border-gray-200">
                          <label className="block text-xs font-semibold text-gray-500 mb-1">
                            Created
                          </label>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-indigo-600" />
                            <span className="text-xs text-gray-700">
                              {formatDate(selectedInstitution.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded p-2 border border-gray-200">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Address
                      </label>
                      <p className="text-sm text-gray-700">
                        {selectedInstitution.address || "No address provided"}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </DialogContent>
            </Dialog>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteModal && (
            <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
              <DialogContent className="max-w-md bg-white rounded-xl">
                <motion.div
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={popupVariants}
                >
                  <DialogHeader className="text-center">
                    <div className="mx-auto w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mb-3">
                      <Trash2 className="h-5 w-5 text-red-600" />
                    </div>
                    <DialogTitle className="text-base font-semibold text-gray-900">
                      Delete Institution
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-600 mt-1">
                      This action cannot be undone. The institution will be permanently removed.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm font-semibold text-red-800 truncate">
                      {institutionToDelete?.inst_name}
                    </p>
                    <p className="text-xs text-red-600 mt-0.5">
                      ID: {institutionToDelete?.inst_id}
                    </p>
                  </div>

                  <DialogFooter className="mt-4 gap-2 flex-col sm:flex-row">
                    <Button
                      variant="outline"
                      onClick={() => setShowDeleteModal(false)}
                      className="flex-1 text-sm h-9 font-medium w-full sm:w-auto"
                      disabled={isDeleting}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={confirmDelete}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-sm h-9 font-medium w-full sm:w-auto"
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          Deleting...
                        </>
                      ) : (
                        "Delete Institution"
                      )}
                    </Button>
                  </DialogFooter>
                </motion.div>
              </DialogContent>
            </Dialog>
          )}
        </AnimatePresence>
      </motion.div>
    </DashboardLayout>
  );
}