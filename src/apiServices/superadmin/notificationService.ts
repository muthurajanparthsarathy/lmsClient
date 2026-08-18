import { superAdminApi } from '@/lib/superAdminApiClient';

export interface AudienceRow { _id: string; inst_name: string; userCount: number; }

export const getAudience = () =>
  superAdminApi.get<{ institutions: AudienceRow[]; total: number }>('/superadmin/notifications/audience');

export const broadcastNotification = (data: {
  title: string;
  message: string;
  type: string;
  institution?: string;
}) => superAdminApi.post<{ recipients: number }>('/superadmin/notifications/broadcast', data);
