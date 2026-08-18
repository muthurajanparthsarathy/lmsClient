// components/modals/PedagogyDetailsModal.tsx
import { AnimatePresence, motion } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BookOpenText, User, Users, UserCheck } from 'lucide-react';
import { BaseModalProps, popupVariants } from './types';

export const PedagogyDetailsModal: React.FC<BaseModalProps> = ({
    selectedPedagogy,
    setSelectedPedagogy
}) => {
    if (!selectedPedagogy || !setSelectedPedagogy) return null;

    return (
        <AnimatePresence>
            {selectedPedagogy && (
                <Dialog open={!!selectedPedagogy} onOpenChange={() => setSelectedPedagogy(null)}>
                    <DialogContent className="max-w-md bg-white dark:bg-gray-900 rounded-xl max-h-[80vh] overflow-y-auto border border-gray-200 dark:border-gray-800">
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={popupVariants}
                        >
                            <DialogHeader className="pb-3 border-b border-gray-200 dark:border-gray-800">
                                <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                                    <BookOpenText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    Pedagogy Details
                                </DialogTitle>
                            </DialogHeader>

                            {selectedPedagogy && (
                                <div className="grid gap-3 py-2">
                                    <PedagogySection
                                        title="I Do (Instructor Led)"
                                        icon={User}
                                        items={selectedPedagogy.I_Do}
                                        color="indigo"
                                    />
                                    <PedagogySection
                                        title="We Do (Collaborative)"
                                        icon={Users}
                                        items={selectedPedagogy.We_Do}
                                        color="teal"
                                    />
                                    <PedagogySection
                                        title="You Do (Independent)"
                                        icon={UserCheck}
                                        items={selectedPedagogy.You_Do}
                                        color="amber"
                                    />
                                </div>
                            )}
                        </motion.div>
                    </DialogContent>
                </Dialog>
            )}
        </AnimatePresence>
    );
};

const PedagogySection: React.FC<{
    title: string;
    icon: any;
    items: string[];
    color: string;
}> = ({ title, icon: Icon, items, color }) => {
    const bgColors = {
        indigo: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800',
        teal: 'bg-teal-50 dark:bg-teal-900/20 border-teal-100 dark:border-teal-800',
        amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800'
    };

    const textColors = {
        indigo: 'text-indigo-700 dark:text-indigo-300',
        teal: 'text-teal-700 dark:text-teal-300',
        amber: 'text-amber-700 dark:text-amber-300'
    };

    const badgeColors = {
        indigo: 'bg-white dark:bg-gray-800 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700',
        teal: 'bg-white dark:bg-gray-800 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-700',
        amber: 'bg-white dark:bg-gray-800 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700'
    };

    return (
        <div className={`p-3 ${bgColors[color as keyof typeof bgColors]} rounded border`}>
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${textColors[color as keyof typeof textColors]}`} />
                <h4 className={`text-sm font-semibold ${textColors[color as keyof typeof textColors]}`}>
                    {title}
                </h4>
            </div>
            <div className="flex flex-wrap gap-1">
                {Array.isArray(items) ? (
                    items.length > 0 ? (
                        items.map((item: string, index: number) => (
                            <Badge
                                key={index}
                                variant="outline"
                                className={`text-xs ${badgeColors[color as keyof typeof badgeColors]} hover:bg-opacity-50 px-2 py-0.5`}
                            >
                                {item}
                            </Badge>
                        ))
                    ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">No activities</p>
                    )
                ) : (
                    <Badge
                        variant="outline"
                        className={`text-xs ${badgeColors[color as keyof typeof badgeColors]} hover:bg-opacity-50 px-2 py-0.5`}
                    >
                        {items}
                    </Badge>
                )}
            </div>
        </div>
    );
};