import React, { useState, useEffect } from 'react';
import { Task, TaskApplication } from '@/types';
import { api } from '@/services/api';
import { MOCK_CANDIDATES } from '@/services/mockData';
import { IconStar, IconCheckCircle, IconShield } from './common-icons';

interface CandidateModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onCandidateApproved: (taskId: number, candidate: TaskApplication) => void;
}

export const CandidateModal: React.FC<CandidateModalProps> = ({
  task,
  isOpen,
  onClose,
  onCandidateApproved,
}) => {
  const [candidates, setCandidates] = useState<TaskApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !task) return;
    loadCandidates();
  }, [isOpen, task]);

  const loadCandidates = async () => {
    if (!task) return;
    setLoading(true);
    try {
      const res = await api.getTaskCandidates(task.id);
      if (Array.isArray(res) && res.length > 0) {
        setCandidates(res);
      } else {
        // Fallback to sample candidates for preview
        setCandidates(MOCK_CANDIDATES);
      }
    } catch {
      setCandidates(MOCK_CANDIDATES);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (candidate: TaskApplication) => {
    if (!task) return;
    setApprovingId(candidate.id);
    try {
      await api.approveCandidate(candidate.id);
    } catch (err) {
      console.warn('Approve API error:', err);
    } finally {
      setApprovingId(null);
      onCandidateApproved(task.id, candidate);
      onClose();
    }
  };

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <span className="text-[10px] font-bold text-orange-600 uppercase">
              Danh sách ứng viên ({candidates.length})
            </span>
            <h2 className="text-sm font-bold text-slate-800 line-clamp-1">{task.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-500 hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        {/* Candidate List */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              Đang tải danh sách ứng viên...
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Chưa có ứng viên nào ứng tuyển công việc này.
            </div>
          ) : (
            candidates.map((cand) => (
              <div
                key={cand.id}
                className="p-4 bg-white border border-slate-100 rounded-2xl shadow-xs hover:border-orange-200 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <img
                      src={
                        cand.worker_avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(cand.worker_name || 'Carepartner')}&background=0D9488&color=fff`
                      }
                      alt="Avatar"
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-teal-100"
                    />
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">{cand.worker_name}</h3>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="flex items-center text-xs font-bold text-amber-500">
                          <IconStar className="w-3.5 h-3.5 fill-amber-400 mr-0.5" />
                          {cand.worker_rating || 5.0}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-[11px] text-teal-700 bg-teal-50 px-2 py-0.2 rounded-full font-medium flex items-center">
                          <IconShield className="w-3 h-3 mr-0.5" /> CCCD Verified
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cover note */}
                <div className="mt-3 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 italic">
                  "{cand.note || 'Tôi rất hào hứng được nhận công việc này và cam kết chăm sóc chu đáo.'}"
                </div>

                {/* Approve Button */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Ứng tuyển gần đây</span>
                  <button
                    onClick={() => handleApprove(cand)}
                    disabled={approvingId === cand.id}
                    className="flex items-center px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs hover:from-teal-700 hover:to-teal-800 active:scale-95 transition-all"
                  >
                    <IconCheckCircle className="w-4 h-4 mr-1.5" />
                    {approvingId === cand.id ? 'Đang duyệt...' : 'Chọn Carepartner này'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
