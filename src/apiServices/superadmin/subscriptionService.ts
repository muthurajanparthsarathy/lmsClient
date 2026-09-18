import { superAdminApi } from '@/lib/superAdminApiClient';

export interface Subscription {
  _id: string;
  institution: string;
  status: 'active' | 'suspended';
  plan: string;
  storageQuotaMB: number;
  maxUsers: number;
  amount: number;
  expiryDate?: string;
}

export interface SubscriptionRow {
  institution: { _id: string; inst_id: string; inst_name: string };
  subscription: Subscription | null;
}

export interface SubscriptionInput {
  institution: string;
  plan?: string;
  status?: 'active' | 'suspended';
  storageQuotaMB?: number;
  maxUsers?: number;
  amount?: number;
  expiryDate?: string;
}

export const getSubscriptions = () =>
  superAdminApi.get<{ rows: SubscriptionRow[] }>('/superadmin/subscriptions');

export const upsertSubscription = (data: SubscriptionInput) =>
  superAdminApi.put<{ subscription: Subscription }>('/superadmin/subscriptions', data);
