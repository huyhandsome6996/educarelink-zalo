export type UserRole = 'parent' | 'worker' | 'admin';

export interface User {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  address?: string;
  role: UserRole;
  is_verified?: boolean;
  is_approved?: boolean;
  avatar_url?: string;
  ai_profile_summary?: string;
  qualifications?: string[];
  latitude?: number;
  longitude?: number;
  first_login?: boolean;
  id_card_front?: string | null;
  id_card_back?: string | null;
  selfie_photo?: string | null;
  certificate_photo?: string | null;
  has_verification_papers?: boolean;
}

export interface AuthResponse {
  message: string;
  tokens: {
    refresh: string;
    access: string;
  };
  user_id: number;
  username: string;
  role: UserRole;
  is_staff?: boolean;
  is_approved?: boolean;
  first_name?: string;
  last_name?: string;
  first_login?: boolean;
}

export interface ServiceCategory {
  id: number;
  name: string;
  icon_name: string;
  description: string;
}

export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

export interface Task {
  id: number;
  title: string;
  description: string;
  price: string | number;
  status: TaskStatus;
  parent: number;
  parent_name?: string;
  category?: number;
  category_name?: string;
  category_code?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  scheduled_time: string;
  geofence_lat?: number | null;
  geofence_lng?: number | null;
  geofence_radius?: number;
  created_at?: string;
  is_reviewed?: boolean;
  review_detail?: any;
}

export interface TaskApplication {
  id: number;
  task: number;
  worker: number;
  worker_name?: string;
  worker_tier?: 'bronze' | 'silver' | 'gold' | 'diamond' | string;
  worker_tier_label?: string;
  worker_university?: string;
  task_title?: string;
  task_status?: TaskStatus | 'pending_payment' | string;
  task_price?: string | number;
  task_location?: string;
  task_scheduled_time?: string;
  task_description?: string;
  parent_username?: string;
  parent_name?: string;
  status: 'pending' | 'approved' | 'accepted' | 'rejected' | string;
  note?: string;
  applied_at?: string;
  worker_avatar?: string;
  worker_rating?: number;
}

export interface EarningsSummary {
  total_earned?: string | number;
  pending_payout?: string | number;
  cash_commission_owed?: string | number;
  recent_payments?: Array<{
    id: number;
    task: number;
    task_title?: string;
    parent_name?: string;
    worker_full_name?: string;
    amount?: string | number;
    worker_payout_amount?: string | number;
    commission_amount?: string | number;
    method?: string;
    created_at?: string;
  }>;
}

export interface Review {
  id?: number;
  task: number;
  rating: number;
  comment: string;
  reviewer_name?: string;
  reviewee_name?: string;
  created_at?: string;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  notification_type?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  quickReplies?: string[];
}
