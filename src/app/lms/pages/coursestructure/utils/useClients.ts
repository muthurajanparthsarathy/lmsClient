import { getToken } from "@/lib/session";
// AddCourseSettingsPopup/hooks/useClients.ts
import { useState, useCallback } from 'react';
import { clientManagementApi } from '@/app/lms/pages/clientmanagement/api/clientManagementService';
import { Client } from '../components/types';

interface UseClientsProps {
    isOpen: boolean;
}

// No-op cleanup kept for API compatibility with existing callers
const cleanup = () => {};

export const useClients = ({ isOpen }: UseClientsProps) => {
    const [clientList, setClientList] = useState<Client[]>([]);
    const [isClientsLoading, setIsClientsLoading] = useState(true);

    const loadClients = useCallback(async () => {
        const token = getToken();
        if (!token) {
            console.error("Authentication token is missing");
            setIsClientsLoading(false);
            return;
        }

        setIsClientsLoading(true);
        try {
            const response = await clientManagementApi.getAll();
            if (response?.data) {
                setClientList(response.data.map((client: any) => ({ ...client })) as Client[]);
            }
        } catch (error) {
            console.error("Failed to load clients:", error);
        } finally {
            setIsClientsLoading(false);
        }
    }, []);

    return {
        clientList,
        isClientsLoading,
        loadClients,
        cleanup
    };
};