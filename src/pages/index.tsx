import React, { useState, useEffect, useCallback } from 'react';
import { Page, useSnackbar } from 'zmp-ui';
import { useAuth } from '@/state/auth';
import { api } from '@/services/api';
import { Task, TaskApplication } from '@/types';

// Components
import { AppHeader } from '@/components/app-header';
import { BottomNav, NavTab } from '@/components/bottom-nav';
import { SplashScreen } from '@/components/splash-screen';
import { CreateTaskModal } from '@/components/create-task-modal';
import { CandidateModal } from '@/components/candidate-modal';
import { TrackingModal } from '@/components/tracking-modal';
import { ReviewModal } from '@/components/review-modal';
import { TaskDetailModal } from '@/components/task-detail-modal';
import { NotificationSheet } from '@/components/notification-sheet';

// Pages
import { WelcomeAuth } from './welcome-auth';
import { ParentHome } from './parent-home';
import { ParentTasks } from './parent-tasks';
import { WorkerFeed } from './worker-feed';
import { WorkerJobs } from './worker-jobs';
import { AIChat } from './ai-chat';
import { ProfilePage } from './profile';

function HomePage() {
  const { isLoggedIn, role, setUnreadCount } = useAuth();
  const { openSnackbar } = useSnackbar();

  // Splash Screen — hiển thị logo 2.5s khi khởi động app
  const [showSplash, setShowSplash] = useState(true);

  // Active Tab navigation
  const [activeTab, setActiveTab] = useState<NavTab>('home');

  // Modals state
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [candidateTask, setCandidateTask] = useState<Task | null>(null);
  const [isCandidatesOpen, setIsCandidatesOpen] = useState(false);
  const [trackingTask, setTrackingTask] = useState<Task | null>(null);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [reviewTask, setReviewTask] = useState<Task | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Polling số thông báo chưa đọc (60s/lần) để cập nhật chấm đỏ
  const syncUnread = useCallback(async () => {
    try {
      const res = await api.getUnreadCount();
      if (res && typeof res.unread_count === 'number') setUnreadCount(res.unread_count);
    } catch {
      /* im lặng — fallback demo giữ nguyên badge */
    }
  }, [setUnreadCount]);

  useEffect(() => {
    if (!isLoggedIn) return;
    syncUnread();
    const t = setInterval(syncUnread, 60000);
    return () => clearInterval(t);
  }, [isLoggedIn, syncUnread]);

  // Nếu không đăng nhập -> WelcomeAuth (vẫn hiển thị splash trước đó)
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // If not logged in, render the clean Welcome & Fast-login experience
  if (!isLoggedIn) {
    return <WelcomeAuth />;
  }

  // Handlers
  const handleTaskCreated = (newTask: any) => {
    openSnackbar({
      text: 'Đăng công việc mới thành công! Hệ thống đang thông báo cho Carepartner.',
      type: 'success',
      duration: 3000,
    });
  };

  const handleSelectTask = (task: Task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleOpenCandidates = (task: Task) => {
    setCandidateTask(task);
    setIsCandidatesOpen(true);
  };

  const handleOpenTracking = (task: Task) => {
    setTrackingTask(task);
    setIsTrackingOpen(true);
  };

  const handleOpenReview = (task: Task) => {
    setReviewTask(task);
    setIsReviewOpen(true);
  };

  const handleCandidateApproved = (taskId: number, candidate: TaskApplication) => {
    openSnackbar({
      text: `Đã duyệt Carepartner ${candidate.worker_name}! Đang kích hoạt Geofence.`,
      type: 'success',
      duration: 3500,
    });
  };

  const handleApplySuccess = (taskId: number) => {
    openSnackbar({
      text: 'Ứng tuyển thành công! Hồ sơ của bạn đã được gửi tới phụ huynh.',
      type: 'success',
      duration: 3000,
    });
  };

  const handleReviewed = (taskId: number, rating: number, comment: string) => {
    openSnackbar({
      text: `Đã chấm ${rating} sao! Cảm ơn bạn đã phản hồi chất lượng.`,
      type: 'success',
      duration: 3000,
    });
  };

  // Render view depending on role and current active tab
  const renderContent = () => {
    if (activeTab === 'chat') {
      return <AIChat />;
    }

    if (activeTab === 'profile') {
      return <ProfilePage />;
    }

    if (role === 'parent') {
      if (activeTab === 'tasks') {
        return (
          <ParentTasks
            onOpenCreateTask={() => setIsCreateTaskOpen(true)}
            onSelectTask={handleSelectTask}
            onOpenCandidates={handleOpenCandidates}
            onOpenTracking={handleOpenTracking}
            onOpenReview={handleOpenReview}
          />
        );
      }
      return (
        <ParentHome
          onOpenCreateTask={() => setIsCreateTaskOpen(true)}
          onSelectTask={handleSelectTask}
          onOpenCandidates={handleOpenCandidates}
          onOpenTracking={handleOpenTracking}
          onOpenReview={handleOpenReview}
        />
      );
    } else {
      // Role: Worker
      if (activeTab === 'my_jobs') {
        return <WorkerJobs />;
      }
      return (
        <WorkerFeed
          onSelectTask={handleSelectTask}
          onApplySuccess={handleApplySuccess}
        />
      );
    }
  };

  return (
    <Page className="bg-slate-50 min-h-screen text-slate-800">
      {/* Top Header */}
      <AppHeader
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenProfile={() => setActiveTab('profile')}
      />

      {/* Main Container */}
      <main className="max-w-md mx-auto px-4 pt-3">{renderContent()}</main>

      {/* Modals & Overlays */}
      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        onCreated={handleTaskCreated}
      />

      <CandidateModal
        task={candidateTask}
        isOpen={isCandidatesOpen}
        onClose={() => setIsCandidatesOpen(false)}
        onCandidateApproved={handleCandidateApproved}
      />

      <TrackingModal
        task={trackingTask}
        isOpen={isTrackingOpen}
        onClose={() => setIsTrackingOpen(false)}
      />

      <ReviewModal
        task={reviewTask}
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        onReviewed={handleReviewed}
      />

      <TaskDetailModal
        task={selectedTask}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onApplySuccess={handleApplySuccess}
        onOpenCandidates={handleOpenCandidates}
        onOpenTracking={handleOpenTracking}
        onOpenReview={handleOpenReview}
      />

      <NotificationSheet
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      {/* Fixed Bottom Navigation */}
      <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} />
    </Page>
  );
}

export default HomePage;
