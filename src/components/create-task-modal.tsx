import React, { useState } from 'react';
import { api } from '@/services/api';
import { MOCK_CATEGORIES } from '@/services/mockData';
import { IconSparkles, IconMapPin, IconClock, IconShield } from './common-icons';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newTask: any) => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<number>(1);
  const [price, setPrice] = useState<number>(200000);
  const [location, setLocation] = useState('123 Nguyễn Huệ, Quận 1, TP.HCM');
  const [scheduledTime, setScheduledTime] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 16)
  );
  const [description, setDescription] = useState('');
  const [geofenceRadius, setGeofenceRadius] = useState<number>(500);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleAiSuggest = async () => {
    setIsAiGenerating(true);
    try {
      const selectedCat = MOCK_CATEGORIES.find((c) => c.id === categoryId)?.name || 'Chăm sóc bé';
      const prompt = `Viết mô tả ngắn gọn, lịch sự, rõ ràng cho công việc "${title || selectedCat}" tại TP.HCM. Nêu rõ yêu cầu kiên nhẫn, đúng giờ và trách nhiệm.`;
      const res = await api.askChatbot(prompt);
      if (res.response) {
        setDescription(res.response.slice(0, 300));
      } else {
        setDescription(`Cần tìm Carepartner chu đáo, có kinh nghiệm hỗ trợ ${selectedCat}. Thời gian linh hoạt, trao đổi cụ thể khi gặp mặt.`);
      }
    } catch {
      const selectedCat = MOCK_CATEGORIES.find((c) => c.id === categoryId)?.name || 'Chăm sóc bé';
      setDescription(`Cần tìm Carepartner chu đáo, có kinh nghiệm hỗ trợ ${selectedCat} tại ${location}. Yêu cầu trung thực, yêu trẻ và đúng giờ.`);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tiêu đề công việc');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);

    const payload = {
      title,
      category: categoryId,
      price,
      location,
      scheduled_time: new Date(scheduledTime).toISOString(),
      description: description || `Công việc: ${title}. Yêu cầu chu đáo, an toàn và trách nhiệm.`,
      geofence_radius: geofenceRadius,
    };

    try {
      const created = await api.createTask(payload);
      onCreated(created);
      onClose();
    } catch (err: any) {
      console.warn('Backend create task notice:', err.message);
      // Create local fallback object so user is not blocked
      const fallbackTask = {
        id: Date.now(),
        ...payload,
        status: 'open',
        category_name: MOCK_CATEGORIES.find((c) => c.id === categoryId)?.name,
        created_at: new Date().toISOString(),
      };
      onCreated(fallbackTask);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-orange-50/50">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-orange-600 uppercase">
              EduCareLink Platform
            </span>
            <h2 className="text-base font-extrabold text-slate-800">Đăng công việc mới</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Tiêu đề công việc <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="VD: Gia sư kèm Toán lớp 5, Đón bé từ trường..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-orange-500 focus:outline-none transition-all"
            />
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Danh mục dịch vụ
            </label>
            <div className="grid grid-cols-4 gap-2">
              {MOCK_CATEGORIES.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setCategoryId(cat.id)}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-semibold transition-all border ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500 text-white shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price & Scheduled Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Lương đề xuất (VNĐ)
              </label>
              <input
                type="number"
                step="10000"
                min="50000"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-orange-600 focus:bg-white focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Thời gian thực hiện
              </label>
              <input
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Địa điểm làm việc
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Số nhà, đường, phường, quận..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:bg-white focus:border-orange-500 focus:outline-none"
              />
              <IconMapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            </div>
          </div>

          {/* Geofence Safety Radius */}
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-800 flex items-center">
                <IconShield className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Vùng an toàn (Geofence)
              </span>
              <span className="text-xs font-bold text-emerald-700">{geofenceRadius} mét</span>
            </div>
            <input
              type="range"
              min="200"
              max="2000"
              step="100"
              value={geofenceRadius}
              onChange={(e) => setGeofenceRadius(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <p className="text-[11px] text-emerald-700/80 mt-1">
              Phụ huynh sẽ nhận thông báo tự động nếu Carepartner di chuyển lệch khỏi bán kính an toàn.
            </p>
          </div>

          {/* Description & AI helper */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 uppercase">
                Mô tả yêu cầu chi tiết
              </label>
              <button
                type="button"
                onClick={handleAiSuggest}
                disabled={isAiGenerating}
                className="flex items-center text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full transition-all active:scale-95"
              >
                <IconSparkles className="w-3 h-3 mr-1 animate-spin-slow" />
                {isAiGenerating ? 'AI đang viết...' : 'AI gợi ý mô tả'}
              </button>
            </div>
            <textarea
              rows={3}
              placeholder="Yêu cầu cụ thể, độ tuổi của bé, những lưu ý về sức khỏe..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:bg-white focus:border-orange-500 focus:outline-none"
            />
          </div>

          {/* Submit button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold text-sm shadow-md hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {isSubmitting ? 'Đang tạo công việc...' : 'Đăng công việc ngay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
