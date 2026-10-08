#!/usr/bin/env python3
"""Sinh stub TSX cho mọi route RN còn lại — agent port sẽ ghi đè từng file.
Stub bảo đảm: build pass, route hợp lệ, AppBar + thông báo đang port."""
import pathlib, textwrap

ROOT = pathlib.Path(__file__).resolve().parent.parent / "src" / "screens"

# (file_path, component, title, tabbed?)  tabbed = hiển thị trong tab stack (cần chừa bottom 84px)
SCREENS = [
    # Auth / guest
    ("auth/GuestHomeScreen", "GuestHomeScreen", "GuestHome", False),
    ("auth/RegisterScreen", "RegisterScreen", "Đăng ký", False),
    ("shared/OnboardingScreen", "OnboardingScreen", "Onboarding", False),
    # Parent
    ("parent/ParentHomeScreen", "ParentHomeScreen", "ParentHome", True),
    ("parent/MyTasksScreen", "MyTasksScreen", "Công việc", True),
    ("parent/TrackingOverviewScreen", "TrackingOverviewScreen", "Theo dõi", True),
    ("parent/ParentProfileScreen", "ParentProfileScreen", "Tài khoản", True),
    ("parent/ChatbotScreen", "ChatbotScreen", "AI Trợ lý", True),
    ("parent/CandidatesListScreen", "CandidatesListScreen", "Ứng viên", False),
    ("parent/CandidateProfileV2Screen", "CandidateProfileV2Screen", "Hồ sơ ứng viên", False),
    ("parent/CandidatesScreen", "CandidatesScreen", "Ứng viên", False),
    ("parent/CandidateProfileScreen", "CandidateProfileScreen", "Hồ sơ", False),
    ("shared/BookingDetailScreen", "BookingDetailScreen", "Chi tiết đơn", False),
    ("parent/PaymentQRScreen", "PaymentQRScreen", "Thanh toán", False),
    ("parent/PaymentSetupScreen", "PaymentSetupScreen", "Thiết lập thanh toán", False),
    ("parent/PaymentDetailScreen", "PaymentDetailScreen", "Chi tiết thanh toán", False),
    ("parent/WalletScreen", "WalletScreen", "Ví EduCare", False),
    ("parent/RewardPointsScreen", "RewardPointsScreen", "Điểm thưởng", False),
    ("parent/SmartMatchesScreen", "SmartMatchesScreen", "Gợi ý AI", False),
    ("parent/CreateTaskScreen", "CreateTaskScreen", "Tạo nhiệm vụ", False),
    ("parent/ReviewScreen", "ReviewScreen", "Đánh giá", False),
    ("parent/LiveTrackingScreen", "LiveTrackingScreen", "Theo dõi trực tiếp", False),
    ("parent/CareDiaryDetailScreen", "CareDiaryDetailScreen", "Nhật ký chăm sóc", False),
    ("parent/CareDiaryHistoryScreen", "CareDiaryHistoryScreen", "Lịch sử nhật ký", False),
    ("parent/JobTypeSelectScreen", "JobTypeSelectScreen", "Đăng việc mới", False),
    ("parent/TutoringForm", "TutoringForm", "Gia sư & Kèm học 1:1", False),
    ("parent/ChildcareForm", "ChildcareForm", "Đồng hành cùng trẻ", False),
    ("parent/PickupForm", "PickupForm", "Đón trẻ tan học", False),
    # Shared
    ("shared/NotificationsScreen", "NotificationsScreen", "Thông báo", False),
    ("shared/ChatScreen", "ChatScreen", "Tin nhắn", False),
    ("shared/ImagePreviewScreen", "ImagePreviewScreen", "Xem ảnh", False),
    ("shared/HelpCenterScreen", "HelpCenterScreen", "Trung tâm trợ giúp", False),
    ("shared/CancellationPolicyScreen", "CancellationPolicyScreen", "Chính sách huỷ", False),
    # Worker
    ("worker/WorkerFeedScreen", "WorkerFeedScreen", "WorkerFeed", True),
    ("worker/AvailabilityScreen", "AvailabilityScreen", "Lịch rảnh", True),
    ("worker/WorkerAvailabilityScreen", "WorkerAvailabilityScreen", "Quản lý lịch rảnh", False),
    ("worker/BlackoutScreen", "BlackoutScreen", "Lịch bận", False),
    ("worker/WorkerChatbotScreen", "WorkerChatbotScreen", "AI Trợ lý", True),
    ("worker/MyJobsScreen", "MyJobsScreen", "Công việc", True),
    ("worker/WorkerProfileScreen", "WorkerProfileScreen", "Tài khoản", True),
    ("worker/WorkerScreeningStatusScreen", "WorkerScreeningStatusScreen", "Trạng thái xét duyệt", False),
    ("worker/MyBookingsScreen", "MyBookingsScreen", "Đơn của tôi", False),
    ("worker/AppealScreen", "AppealScreen", "Kháng cáo", False),
    ("worker/CareDiaryFormScreen", "CareDiaryFormScreen", "Nhật ký ca", False),
    ("worker/TaskDetailScreen", "TaskDetailScreen", "Chi tiết công việc", False),
    ("worker/ComplaintScreen", "ComplaintScreen", "Gửi khiếu nại", False),
    ("worker/MyComplaintsScreen", "MyComplaintsScreen", "Khiếu nại của tôi", False),
    ("worker/ProfileChangeRequestsScreen", "ProfileChangeRequestsScreen", "Yêu cầu đổi hồ sơ", False),
    ("worker/MyEarningsScreen", "MyEarningsScreen", "Thu nhập", False),
    ("worker/SettlementDetailScreen", "SettlementDetailScreen", "Chi tiết thanh toán", False),
    # Admin
    ("admin/AdminDashboardScreen", "AdminDashboardScreen", "Admin Dashboard", False),
    ("admin/AdminModerationScreen", "AdminModerationScreen", "Kiểm duyệt", False),
    ("admin/AdminChatbotScreen", "AdminChatbotScreen", "AI Admin", False),
    ("admin/AdminPaymentsScreen", "AdminPaymentsScreen", "Thanh toán", False),
    ("admin/AdminTrackingOverviewScreen", "AdminTrackingOverviewScreen", "Giám sát tracking", False),
    ("admin/AdminReviewScreen", "AdminReviewScreen", "Quản lý đánh giá", False),
    ("admin/AdminSendNotificationScreen", "AdminSendNotificationScreen", "Gửi thông báo", False),
    ("admin/AdminAllTasksScreen", "AdminAllTasksScreen", "Tất cả nhiệm vụ", False),
]

TEMPLATE = '''/**
 * {component} — STUB chuyển tiếp. Agent port sẽ thay bằng bản port đầy đủ từ
 * mobile/src/screens/{rn}. (Route đã đăng ký trong registry.tsx.)
 */
import React from "react";
import {{ Screen, StatusBarSpacer, AppBar }} from "@/components/ui";
import {{ COLORS }} from "@/theme";
import {{ useNav }} from "@/navigation/router";

const {component}: React.FC = () => {{
  const nav = useNav();
  return (
    <Screen bg={{COLORS.background}}>
      <StatusBarSpacer />
      <AppBar title="{title}" onBack={{nav.goBack}} />
      <div style={{{{ padding: 24, textAlign: "center", color: COLORS.textSecondary }}}}>
        Màn hình "{title}" đang được port từ bản React Native.
      </div>
    </Screen>
  );
}};

export default {component};
'''

count = 0
for path, comp, title, tabbed in SCREENS:
    p = ROOT / f"{path}.tsx"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(TEMPLATE.format(component=comp, title=title, rn=path))
    count += 1
print(f"OK {count} stubs")
