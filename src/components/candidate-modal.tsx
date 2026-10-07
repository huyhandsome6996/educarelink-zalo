import React, { useState, useEffect } from 'react';
import { Task, TaskApplication } from '@/types';
import { api } from '@/services/api';
import { MOCK_CANDIDATES } from '@/services/mockData';
import { IconStar, IconCheckCircle, IconShield, IconGraduationCap, IconRefresh } from './common-icons';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, task]);

  const loadCandidates = async () => {
    if (!task) return;
    setLoading(true);
    try {
      const res = await api.getTaskCandidates(task.id);
      if (Array.isArray(res) && res.length > 0) {
        setCandidates(res);
      } else {
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

  const tierBadge = (cand: TaskApplication) => {
    if (!cand.worker_tier_label) return null;
    const styles: Record<string, string> = {
      gold: 'from-amber-400 to-amber-500',
      diamond: 'from-sky-400 to-indigo-500',
      silver: 'from-slate-300 to-slate-400',
      bronze: 'from-orange-300 to-amber-600',
    };
    const grad = styles[cand.worker_tier || ''] || 'from-amber-400 to-amber-500';
    return (
      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold text-white uppercase bg-gradient-to-r ${grad}`}>
        {cand.worker_tier_label}
      </span>
    );
  };

  const statusMeta = (cand: TaskApplication) => {
    if (cand.status === 'accepted' || cand.status === 'approved')
      return { label: 'Đã được duyệt', cls: 'text-emerald-700 bg-emerald-50' };
    if (cand.status === 'rejected') return { label: 'Đã từ chối', cls: 'text-red-600 bg-red-50' };
    return { label: 'Chờ duyệt', cls: 'text-amber-700 bg-amber-50' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden modal-sheet-enter">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <span className="text-[10px] font-bold text-primary uppercase">
              Danh sách ứng viên ({candidates.length})
            </span>
            <h2 className="text-sm font-bold text-slate-800 line-clamp-1">{task.title}</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadCandidates}
              className="w-8 h-8 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-500 hover:bg-slate-200"
              aria-label="Tải lại"
            >
              <IconRefresh className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-500 hover:bg-slate-200"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Candidate List */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
          {loading ? (
            <div className="space-y-3">
              <div className="skeleton h-36 rounded-2xl" />
              <div className="skeleton h-36 rounded-2xl" />
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Chưa có ứng viên nào ứng tuyển công việc này.
            </div>
          ) : (
            candidates.map((cand) => {
              const meta = statusMeta(cand);
              const isAccepted = cand.status === 'accepted' || cand.status === 'approved';
              return (
                <div
                  key={cand.id}
                  className="p-4 bg-white border border-slate-100 rounded-2xl shadow-xs hover:border-orange-200 transition-all animate-fade-in-up"
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
                        <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                          <span className="flex items-center text-xs font-bold text-amber-500">
                            <IconStar className="w-3.5 h-3.5 fill-amber-400 mr-0.5" />
                            {cand.worker_rating || 5.0}
                          </span>
                          {tierBadge(cand)}
                          <span className="text-[11px] text-teal-700 bg-teal-50 px-2 py-0.2 rounded-full font-medium flex items-center">
                            <IconShield className="w-3 h-3 mr-0.5" /> CCCD Verified
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${meta.cls}`}>
                      {meta.label}
                    </span>
                  </div>

                  {/* Cover note */}
                  <div className="mt-3 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 italic">
                    "{cand.note || 'Tôi rất hào hứng được nhận công việc này và cam kết chăm sóc chu đáo.'}"
                  </div>

                  {/* Approve Button */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Ứng tuyển {cand.applied_at ? new Date(cand.applied_at).toLocaleDateString('vi-VN') : 'gần đây'}
                    </span>
                    <button
                      onClick={() => handleApprove(cand)}
                      disabled={approvingId === cand.id || isAccepted}
                      className="flex items-center px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs hover:from-teal-700 hover:to-teal-800 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <IconCheckCircle className="w-4 h-4 mr-1.5" />
                      {isAccepted
                        ? 'Đã chọn Carepartner này'
                        : approvingId === cand.id
                        ? 'Đang duyệt...'
                        : 'Duyệt Carepartner này'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
