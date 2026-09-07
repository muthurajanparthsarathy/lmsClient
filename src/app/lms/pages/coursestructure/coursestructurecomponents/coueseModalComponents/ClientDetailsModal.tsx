// components/modals/ClientDetailsModal.tsx
import { AnimatePresence, motion } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
    Building2,
    CheckCircle,
    Briefcase,
    MapPin,
    Activity,
    FileText,
    Users,
    User,
    Mail,
    Phone,
    Clock
} from 'lucide-react';
import { BaseModalProps, popupVariants } from './types';

export const ClientDetailsModal: React.FC<BaseModalProps> = ({
    selectedClient,
    setSelectedClient
}) => {
    if (!selectedClient || !setSelectedClient) return null;

    return (
        <AnimatePresence>
            {selectedClient && (
                <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
                    <DialogContent className="max-w-2xl bg-white dark:bg-gray-900 rounded-xl w-[95vw] max-h-[80vh] overflow-y-auto border border-gray-200 dark:border-gray-800">
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={popupVariants}
                        >
                            <DialogHeader className="pb-3 border-b border-gray-200 dark:border-gray-800">
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    <DialogTitle className="text-sm font-semibold text-gray-800 dark:text-gray-200">Client Details</DialogTitle>
                                </div>
                            </DialogHeader>

                            {selectedClient && (
                                <div className="space-y-3 py-2">
                                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                                        <div className="grid grid-cols-1 gap-3">
                                            <InfoRow icon={Briefcase} label="Company Name">
                                                {selectedClient.clientCompany}
                                            </InfoRow>
                                            <InfoRow icon={MapPin} label="Address">
                                                {selectedClient.clientAddress}
                                            </InfoRow>
                                            <InfoRow icon={Activity} label="Status">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-xs ${
                                                        selectedClient.status === 'active' 
                                                            ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800' 
                                                            : 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                                                    }`}
                                                >
                                                    {selectedClient.status === 'active' ? (
                                                        <CheckCircle className="h-3 w-3 mr-0.5" />
                                                    ) : (
                                                        <Clock className="h-3 w-3 mr-0.5" />
                                                    )}
                                                    {selectedClient.status.charAt(0).toUpperCase() + selectedClient.status.slice(1)}
                                                </Badge>
                                            </InfoRow>
                                            <InfoRow icon={FileText} label="Description">
                                                {selectedClient.description || "-"}
                                            </InfoRow>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="flex items-center text-sm font-medium text-gray-800 dark:text-gray-200">
                                                <Users className="h-4 w-4 mr-1 text-blue-600 dark:text-blue-400" />
                                                Contact Persons
                                            </h3>
                                            <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                                                {selectedClient.contactPersons.length}
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            {selectedClient.contactPersons.map((person: any, index: number) => (
                                                <ContactPersonCard key={index} person={person} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </DialogContent>
                </Dialog>
            )}
        </AnimatePresence>
    );
};

const InfoRow: React.FC<{ icon: any; label: string; children: React.ReactNode }> = ({ icon: Icon, label, children }) => (
    <div className="space-y-1">
        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
            <Icon className="h-3 w-3 mr-1 text-blue-500 dark:text-blue-400" />
            {label}
        </div>
        <div className="pl-4">
            {typeof children === 'string' ? (
                <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{children}</p>
            ) : children}
        </div>
    </div>
);

const ContactPersonCard: React.FC<{ person: any }> = ({ person }) => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
                <User className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
                <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{person.name}</span>
            </div>
            {person.isPrimary && <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />}
        </div>
        <div className="space-y-1">
            <a
                href={`mailto:${person.email}`}
                className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
            >
                <Mail className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                <span className="break-all">{person.email}</span>
            </a>
            <a
                href={`tel:${person.phoneNumber}`}
                className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
            >
                <Phone className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                <span>{person.phoneNumber}</span>
            </a>
        </div>
    </div>
);