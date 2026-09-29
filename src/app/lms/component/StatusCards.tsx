import { Card } from "@/components/ui/card";
import { Users, Lock, CheckCircle, XCircle } from "lucide-react";

interface StatusCardsProps {
    users: {
        id: string;
        firstName: string;
        lastName: string;
        gender: string;
        email: string;
        phone: string;
        role: string;
        status: "active" | "inactive";
        lastLogin: string;
    }[];
}

export function StatusCards({ users }: StatusCardsProps) {
    // Calculate statistics
    const totalUsers = users.length;
    const activeUsers = users.filter(user => user.status === "active").length;
    const inactiveUsers = users.filter(user => user.status === "inactive").length;
    const adminUsers = users.filter(user => 
        user.role.toLowerCase().includes('lms') || 
        user.role.toLowerCase().includes('admin') ||
        user.role.toLowerCase().includes('super administrator')
    ).length;

    const stats = [
        {
            title: "Total Users",
            value: totalUsers,
            icon: <Users className="text-gray-600 dark:text-gray-400" size={20} />,
            description: "All registered users",
            bgColor: "bg-gray-100 dark:bg-gray-800"
        },
        {
            title: "Active Users",
            value: activeUsers,
            icon: <CheckCircle className="text-green-600 dark:text-green-400" size={20} />,
            description: "Currently active users",
            bgColor: "bg-green-50 dark:bg-green-900/20"
        },
        {
            title: "Inactive Users",
            value: inactiveUsers,
            icon: <XCircle className="text-red-600 dark:text-red-400" size={20} />,
            description: "Inactive accounts",
            bgColor: "bg-red-50 dark:bg-red-900/20"
        },
        {
            title: "Admins",
            value: adminUsers,
            icon: <Lock className="text-purple-600 dark:text-purple-400" size={20} />,
            description: "Administrator accounts",
            bgColor: "bg-purple-50 dark:bg-purple-900/20"
        }
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {stats.map((item, idx) => (
                <div 
                    key={idx} 
                    className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-2 transition-colors duration-200 hover:shadow-sm dark:hover:shadow-gray-800/50"
                >
                    <div className="flex items-center space-x-3">
                        <div className={`rounded-md p-2 ${item.bgColor} transition-colors duration-200`}>
                            {item.icon}
                        </div>
                        <div>
                            <div className="text-gray-900 dark:text-gray-100 text-xs font-semibold">
                                {item.value} {item.title}
                            </div>
                            <div className="text-gray-500 dark:text-gray-400 text-[10px]">
                                {item.description}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}