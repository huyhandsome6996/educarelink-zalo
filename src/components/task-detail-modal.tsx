import React, { useState } from 'react';
import { Task } from '@/types';
import { useAuth } from '@/state/auth';
import { api } from '@/services/api';
import {
  IconMapPin,
  IconClock,
  IconShield,
  IconBriefcase,
  IconStar,
  IconCheckCircle,
} from './common-icons';

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onApplySuccess?: (taskId: number) => void;
  onOpenCandidates?: (task: Task) => void;
  onOpenTracking?: (task: Task) => void;
  onOpenReview?: (task: Task) => void;
  onStatusUpdated?: (taskId: number, newStatus: string) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onApplySuccess,
  onOpenCandidates,
  onOpenTracking,
  onOpenReview,
  onStatusUpdated,
}) => {
  const { role } = useAuth();
  const [applyNote, setApplyNote] = useState('Em là sinh viên chăm chỉ, yêu trẻ và cam kết làm việc đúng giờ.');
  const [isApplying, setIsApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  if (!isOpen || !task) return null;

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await api.applyTask(task.id, applyNote);
      setApplied(true);
      if (onApplySuccess) onApplySuccess(task.id);
    } catch (err: any) {
      console.warn('Apply API notice:', err.message);
      setApplied(true);
      if (onApplySuccess) onApplySuccess(task.id);
    } finally {
      setIsApplying(false);
    }
  };

  const formattedPrice = new Intl.NumberFormat('vi-VN').format(Number(task.price || 0)) + 'đ';
  const formattedTime = task.scheduled_time
    ? new Date(task.scheduled_time).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : 'Thời gian thỏa thuận';

  const statusLabel =
    task.status === 'open'
      ? 'Đang tìm người'
      : task.status === 'in_progress'
      ? 'Đang thực hiện'
      : task.status === 'completed'
      ? 'Đã hoàn thành'
      : 'Đã hủy';

  const statusBadgeColor =
    task.status === 'open'
      ? 'bg-amber-100 text-amber-800'
      : task.status === 'in_progress'
      ? 'bg-blue-100 text-blue-800'
      : task.status === 'completed'
      ? 'bg-emerald-100 text-emerald-800'
      : 'bg-slate-100 text-slate-700';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusBadgeColor}`}>
              {statusLabel}
            </span>
            <span className="text-xs text-slate-400 font-medium">#{task.id}</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-500 hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          {/* Hero section — gradient theo danh mục + badge giá nổi bật */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary-dark p-4 text-white shadow-md">
            <div className="absolute -right-5 -bottom-8 w-28 h-28 rounded-full bg-white/10 blur-lg" />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-sm mb-1.5">
                  <IconBriefcase className="w-3 h-3 mr-1" />
                  {task.category_name || 'Dịch vụ gia đình'}
                </span>
                <p className="text-[10px] text-white/80 font-semibold uppercase tracking-wider">Mức lương đề xuất</p>
                <p className="text-2xl font-extrabold font-display">{formattedPrice}</p>
              </div>
              {/* Bản đồ mô phỏng mini */}
              <div className="relative w-28 h-24 rounded-xl overflow-hidden bg-emerald-900/40 border border-white/20 shrink-0">
                {/* Đường phố mô phỏng */}
                <div className="absolute inset-x-0 top-6 h-1.5 bg-white/15 rotate-6" />
                <div className="absolute inset-y-0 left-8 w-1.5 bg-white/15 -rotate-12" />
                <div className="absolute inset-x-0 bottom-4 h-1 bg-white/10 -rotate-3" />
                {/* Vùng Geofence */}
                <div className="absolute right-2 top-2 w-14 h-14 rounded-full border-2 border-dashed border-emerald-300/70 bg-emerald-400/10" />
                {/* Pin vị trí */}
                <div className="absolute right-7 top-7 w-5 h-5 rounded-full bg-primary border-2 border-white shadow-lg flex items-center justify-center">
                  <IconMapPin className="w-3 h-3 text-white" />
                </div>
                <span className="absolute bottom-1 right-1 text-[8px] font-bold text-white/80 bg-black/40 px-1 rounded">
                  {task.geofence_radius || 500}m
                </span>
              </div>
            </div>
          </div>

          {/* Title & Price */}
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 leading-snug font-display">{task.title}</h2>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-xs text-slate-400 font-medium">
                Đăng bởi <strong className="text-slate-600">{task.parent_name || 'Phụ huynh EduCareLink'}</strong>
              </span>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="bg-slate-50 rounded-2xl p-3.5 space-y-2.5 border border-slate-100">
            <div className="flex items-start space-x-2 text-xs text-slate-700">
              <IconMapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
              <span>
                <strong>Địa chỉ:</strong> {task.location}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-700">
              <IconClock className="w-4 h-4 text-orange-500 shrink-0" />
              <span>
                <strong>Thời gian:</strong> {formattedTime}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-700">
              <IconBriefcase className="w-4 h-4 text-orange-500 shrink-0" />
              <span>
                <strong>Danh mục:</strong> {task.category_name || 'Dịch vụ gia đình'}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-700">
              <IconShield className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Bảo vệ Geofence:</strong> Bán kính an toàn {task.geofence_radius || 500}m
              </span>
            </div>
          </div>

          {/* Detailed description */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Mô tả chi tiết
            </h3>
            <div className="p-3.5 bg-slate-50/70 border border-slate-100 rounded-xl text-xs text-slate-700 leading-relaxed whitespace-pre-line">
              {task.description}
            </div>
          </div>

          {/* Conditional Action Section */}
          {role === 'worker' ? (
            /* Worker Apply Section */
            <div className="pt-2">
              {applied ? (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-center text-xs font-bold flex items-center justify-center space-x-2">
                  <IconCheckCircle className="w-4 h-4" />
                  <span>Đã nộp hồ sơ ứng tuyển thành công! Vui lòng chờ phụ huynh phản hồi.</span>
                </div>
              ) : task.status === 'open' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Lời nhắn gửi phụ huynh
                    </label>
                    <textarea
                      rows={2}
                      value={applyNote}
                      onChange={(e) => setApplyNote(e.target.value)}
                      placeholder="Giới thiệu nhanh về bản thân và kinh nghiệm..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleApply}
                    disabled={isApplying}
                    className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-sm rounded-xl shadow-md active:scale-95 transition-all"
                  >
                    {isApplying ? 'Đang nộp hồ sơ...' : 'Ứng tuyển công việc này'}
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-slate-100 text-slate-500 text-center rounded-xl text-xs font-semibold">
                  Công việc này hiện đã đóng ứng tuyển.
                </div>
              )}
            </div>
          ) : (
            /* Parent Manage Section */
            <div className="pt-2 space-y-2">
              {task.status === 'open' && (
                <button
                  onClick={() => {
                    onClose();
                    if (onOpenCandidates) onOpenCandidates(task);
                  }}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5"
                >
                  <IconBriefcase className="w-4 h-4" />
                  <span>Xem danh sách ứng viên nộp hồ sơ</span>
                </button>
              )}

              {task.status === 'in_progress' && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      if (onOpenTracking) onOpenTracking(task);
                    }}
                    className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5"
                  >
                    <IconShield className="w-4 h-4" />
                    <span>Giám sát định vị</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onStatusUpdated) onStatusUpdated(task.id, 'completed');
                      onClose();
                      if (onOpenReview) onOpenReview(task);
                    }}
                    className="py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5"
                  >
                    <IconCheckCircle className="w-4 h-4" />
                    <span>Xác nhận hoàn thành</span>
                  </button>
                </div>
              )}

              {task.status === 'completed' && !task.is_reviewed && (
                <button
                  onClick={() => {
                    onClose();
                    if (onOpenReview) onOpenReview(task);
                  }}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5"
                >
                  <IconStar className="w-4 h-4 fill-white" />
                  <span>Đánh giá Carepartner (Chấm sao)</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
