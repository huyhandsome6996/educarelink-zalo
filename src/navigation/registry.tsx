/**
 * Route registry — bảng ánh xạ route RN -> component Zalo (xem docs/mobile-parity-map.md).
 * Tên route GIỐNG HỆT AppNavigator.js để QA đối chiếu 1:1.
 */
import React from "react";
import Icon from "@/components/Icon";
import { Spinner, StatusBarSpacer } from "@/components/ui";
import { COLORS } from "@/theme";

import SplashScreen from "@/screens/auth/SplashScreen";
import GuestHomeScreen from "@/screens/auth/GuestHomeScreen";
import LoginScreen from "@/screens/auth/LoginScreen";
import RegisterScreen from "@/screens/auth/RegisterScreen";
import OnboardingScreen from "@/screens/shared/OnboardingScreen";

import ParentHomeScreen from "@/screens/parent/ParentHomeScreen";
import MyTasksScreen from "@/screens/parent/MyTasksScreen";
import TrackingOverviewScreen from "@/screens/parent/TrackingOverviewScreen";
import ParentProfileScreen from "@/screens/parent/ParentProfileScreen";
import ChatbotScreen from "@/screens/parent/ChatbotScreen";
import CandidatesListScreen from "@/screens/parent/CandidatesListScreen";
import CandidateProfileV2Screen from "@/screens/parent/CandidateProfileV2Screen";
import CandidatesScreen from "@/screens/parent/CandidatesScreen";
import CandidateProfileScreen from "@/screens/parent/CandidateProfileScreen";
import PaymentQRScreen from "@/screens/parent/PaymentQRScreen";
import PaymentSetupScreen from "@/screens/parent/PaymentSetupScreen";
import PaymentDetailScreen from "@/screens/parent/PaymentDetailScreen";
import WalletScreen from "@/screens/parent/WalletScreen";
import RewardPointsScreen from "@/screens/parent/RewardPointsScreen";
import SmartMatchesScreen from "@/screens/parent/SmartMatchesScreen";
import CreateTaskScreen from "@/screens/parent/CreateTaskScreen";
import ReviewScreen from "@/screens/parent/ReviewScreen";
import LiveTrackingScreen from "@/screens/parent/LiveTrackingScreen";
import CareDiaryDetailScreen from "@/screens/parent/CareDiaryDetailScreen";
import CareDiaryHistoryScreen from "@/screens/parent/CareDiaryHistoryScreen";
import JobTypeSelectScreen from "@/screens/parent/JobTypeSelectScreen";
import TutoringForm from "@/screens/parent/TutoringForm";
import ChildcareForm from "@/screens/parent/ChildcareForm";
import PickupForm from "@/screens/parent/PickupForm";

import NotificationsScreen from "@/screens/shared/NotificationsScreen";
import ChatScreen from "@/screens/shared/ChatScreen";
import ImagePreviewScreen from "@/screens/shared/ImagePreviewScreen";
import HelpCenterScreen from "@/screens/shared/HelpCenterScreen";
import CancellationPolicyScreen from "@/screens/shared/CancellationPolicyScreen";
import BookingDetailScreen from "@/screens/shared/BookingDetailScreen";

import WorkerFeedScreen from "@/screens/worker/WorkerFeedScreen";
import AvailabilityScreen from "@/screens/worker/AvailabilityScreen";
import WorkerAvailabilityScreen from "@/screens/worker/WorkerAvailabilityScreen";
import BlackoutScreen from "@/screens/worker/BlackoutScreen";
import WorkerChatbotScreen from "@/screens/worker/WorkerChatbotScreen";
import MyJobsScreen from "@/screens/worker/MyJobsScreen";
import WorkerProfileScreen from "@/screens/worker/WorkerProfileScreen";
import WorkerScreeningStatusScreen from "@/screens/worker/WorkerScreeningStatusScreen";
import MyBookingsScreen from "@/screens/worker/MyBookingsScreen";
import AppealScreen from "@/screens/worker/AppealScreen";
import CareDiaryFormScreen from "@/screens/worker/CareDiaryFormScreen";
import TaskDetailScreen from "@/screens/worker/TaskDetailScreen";
import ComplaintScreen from "@/screens/worker/ComplaintScreen";
import MyComplaintsScreen from "@/screens/worker/MyComplaintsScreen";
import ProfileChangeRequestsScreen from "@/screens/worker/ProfileChangeRequestsScreen";
import MyEarningsScreen from "@/screens/worker/MyEarningsScreen";
import SettlementDetailScreen from "@/screens/worker/SettlementDetailScreen";

import AdminDashboardScreen from "@/screens/admin/AdminDashboardScreen";
import AdminModerationScreen from "@/screens/admin/AdminModerationScreen";
import AdminChatbotScreen from "@/screens/admin/AdminChatbotScreen";
import AdminPaymentsScreen from "@/screens/admin/AdminPaymentsScreen";
import AdminTrackingOverviewScreen from "@/screens/admin/AdminTrackingOverviewScreen";
import AdminReviewScreen from "@/screens/admin/AdminReviewScreen";
import AdminSendNotificationScreen from "@/screens/admin/AdminSendNotificationScreen";
import AdminAllTasksScreen from "@/screens/admin/AdminAllTasksScreen";

export const SCREENS: Record<string, React.ComponentType<any>> = {
  // Auth
  Splash: SplashScreen,
  GuestHome: GuestHomeScreen,
  Login: LoginScreen,
  Register: RegisterScreen,
  Onboarding: OnboardingScreen,
  // Parent tabs
  ParentHome: ParentHomeScreen,
  MyTasks: MyTasksScreen,
  Chatbot: ChatbotScreen,
  TrackingOverview: TrackingOverviewScreen,
  ParentProfile: ParentProfileScreen,
  // Parent stack
  JobTypeSelect: JobTypeSelectScreen,
  TutoringForm,
  ChildcareForm,
  PickupForm,
  CandidatesList: CandidatesListScreen,
  CandidateProfileV2: CandidateProfileV2Screen,
  Candidates: CandidatesScreen,
  CandidateProfile: CandidateProfileScreen,
  BookingDetail: BookingDetailScreen,
  PaymentQR: PaymentQRScreen,
  PaymentSetup: PaymentSetupScreen,
  PaymentDetail: PaymentDetailScreen,
  WalletCredits: WalletScreen,
  RewardPoints: RewardPointsScreen,
  RewardPointsScreen,
  SmartMatches: SmartMatchesScreen,
  CreateTask: CreateTaskScreen,
  Review: ReviewScreen,
  LiveTracking: LiveTrackingScreen,
  CareDiaryDetail: CareDiaryDetailScreen,
  CareDiaryHistory: CareDiaryHistoryScreen,
  // Shared
  Notifications: NotificationsScreen,
  Chat: ChatScreen,
  ImagePreview: ImagePreviewScreen,
  HelpCenter: HelpCenterScreen,
  CancellationPolicy: CancellationPolicyScreen,
  // Worker tabs
  WorkerFeed: WorkerFeedScreen,
  MatchingAvailability: AvailabilityScreen,
  WorkerChatbot: WorkerChatbotScreen,
  MyJobs: MyJobsScreen,
  WorkerProfile: WorkerProfileScreen,
  // Worker stack
  WorkerAvailability: WorkerAvailabilityScreen,
  Blackout: BlackoutScreen,
  WorkerScreeningStatus: WorkerScreeningStatusScreen,
  MyBookings: MyBookingsScreen,
  Appeal: AppealScreen,
  CareDiaryForm: CareDiaryFormScreen,
  TaskDetail: TaskDetailScreen,
  Complaint: ComplaintScreen,
  MyComplaints: MyComplaintsScreen,
  ProfileChangeRequests: ProfileChangeRequestsScreen,
  MyEarnings: MyEarningsScreen,
  SettlementDetail: SettlementDetailScreen,
  // Admin
  AdminDashboard: AdminDashboardScreen,
  AdminModeration: AdminModerationScreen,
  AdminChatbot: AdminChatbotScreen,
  AdminPayments: AdminPaymentsScreen,
  AdminTrackingOverview: AdminTrackingOverviewScreen,
  AdminReview: AdminReviewScreen,
  AdminSendNotification: AdminSendNotificationScreen,
  AdminAllTasks: AdminAllTasksScreen,
};

/** Modal screens (presentation: 'modal' trong AppNavigator) — phủ toàn màn, không tab bar */
export const MODAL_ROUTES = new Set([
  "CreateTask",
  "PaymentSetup",
  "CancellationPolicy",
  "ImagePreview",
  "Complaint",
  "AdminChatbot",
  "AdminSendNotification",
]);

/** Loading state mở app — style nguyên bản AppNavigator (loadingLogoWrap/heart/ActivityIndicator) */
export const NavLoadingView: React.FC = () => (
  <div
    style={{
      minHeight: "100dvh",
      background: COLORS.background,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "absolute",
        width: 120,
        height: 120,
        borderRadius: 60,
        background: "rgba(242,101,34,0.08)",
        filter: "blur(2px)",
      }}
    />
    <div
      style={{
        width: 80,
        height: 80,
        borderRadius: 20,
        background: COLORS.primaryLight,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        zIndex: 1,
      }}
    >
      <Icon name="heart" size={56} color={COLORS.primary} />
      <Spinner size={22} color={COLORS.primary} />
    </div>
  </div>
);
