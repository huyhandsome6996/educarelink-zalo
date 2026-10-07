import React, { useState } from 'react';
import { Task } from '@/types';
import { api } from '@/services/api';
import { IconStar } from './common-icons';

interface ReviewModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onReviewed: (taskId: number, rating: number, comment: string) => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ task, isOpen, onClose, onReviewed }) => {
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tags = ['Rất đúng giờ', 'Yêu trẻ', 'Tận tâm chu đáo', 'Kỹ năng tốt', 'Sẽ đặt lại'];

  if (!isOpen || !task) return null;

  const handleAddTag = (tag: string) => {
    if (comment.includes(tag)) return;
    setComment((prev) => (prev ? `${prev}, ${tag}` : tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.submitReview(task.id, rating, comment || 'Carepartner phục vụ rất tốt và chu đáo.');
    } catch (err) {
      console.warn('Review API notice:', err);
    } finally {
      setIsSubmitting(false);
      onReviewed(task.id, rating, comment);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-orange-50/50">
          <div>
            <span className="text-[10px] font-bold text-orange-600 uppercase">Đánh giá dịch vụ</span>
            <h2 className="text-sm font-bold text-slate-800 line-clamp-1">{task.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-500 hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Star selector */}
          <div className="text-center py-2">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Chấm điểm chất lượng</p>
            <div className="flex justify-center items-center space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1 text-amber-400 hover:scale-110 active:scale-95 transition-all"
                >
                  <IconStar
                    size={36}
                    filled={star <= rating}
                    color={star <= rating ? '#F59E0B' : '#E2E8F0'}
                    className="w-9 h-9"
                  />
                </button>
              ))}
            </div>
            <p className="text-xs font-bold text-amber-600 mt-2">
              {rating === 5
                ? 'Tuyệt vời (5/5 sao)'
                : rating === 4
                ? 'Rất tốt (4/5 sao)'
                : rating === 3
                ? 'Hài lòng (3/5 sao)'
                : 'Cần cải thiện'}
            </p>
          </div>

          {/* Quick tags */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
              Nhận xét nhanh
            </label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => handleAddTag(t)}
                  className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-orange-50 hover:text-orange-600 text-slate-600 rounded-full font-medium transition-all"
                >
                  + {t}
                </button>
              ))}
            </div>
          </div>

          {/* Detail comment */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Lời nhắn gửi Carepartner
            </label>
            <textarea
              rows={3}
              placeholder="Chia sẻ cảm nhận về thái độ và chất lượng phục vụ của Carepartner..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:bg-white focus:border-orange-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold text-sm shadow-md hover:from-orange-600 active:scale-[0.98] transition-all"
          >
            {isSubmitting ? 'Đang gửi đánh giá...' : 'Gửi đánh giá & Hoàn tất'}
          </button>
        </form>
      </div>
    </div>
  );
};
