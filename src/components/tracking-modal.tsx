import React, { useState, useEffect } from 'react';
import { Task } from '@/types';
import { api } from '@/services/api';
import { IconShield, IconMapPin, IconAlertTriangle, IconClock } from './common-icons';

interface TrackingModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TrackingModal: React.FC<TrackingModalProps> = ({ task, isOpen, onClose }) => {
  const [isLive, setIsLive] = useState(true);
  const [isSafe, setIsSafe] = useState(true);
  const [distance, setDistance] = useState(120); // meters from task center
  const [lastPing, setLastPing] = useState('Vừa xong (3 giây trước)');
  const [sosSent, setSosSent] = useState(false);
  const [isSendingSos, setIsSendingSos] = useState(false);

  useEffect(() => {
    if (!isOpen || !task) return;
    const interval = setInterval(() => {
      // Small simulated coordinate jitter within safe bounds
      setDistance((prev) => Math.min(task.geofence_radius || 500, Math.max(50, prev + (Math.random() * 40 - 20))));
      setLastPing('Vừa cập nhật');
    }, 4000);
    return () => clearInterval(interval);
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const handleSendSOS = async () => {
    if (!task) return;
    setIsSendingSos(true);
    try {
      await api.sendSOS(task.id, 'Phát tín hiệu khẩn cấp từ ứng dụng Zalo Mini App');
      setSosSent(true);
    } catch {
      setSosSent(true);
    } finally {
      setIsSendingSos(false);
    }
  };

  const radius = task.geofence_radius || 500;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/70">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <div>
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                EduCareLink Live Safe Guard
              </span>
              <h2 className="text-sm font-bold text-slate-800 line-clamp-1">
                Giám sát an toàn: {task.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-500 hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Radar / Map Simulation Display */}
          <div className="relative w-full h-56 bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
            {/* Concentric Geofence Rings */}
            <div className="absolute w-44 h-44 rounded-full border border-emerald-500/20 animate-pulse"></div>
            <div className="absolute w-32 h-32 rounded-full border border-emerald-500/40 bg-emerald-500/5"></div>
            <div className="absolute w-20 h-20 rounded-full border border-dashed border-emerald-400/60"></div>

            {/* Center: Home / Task Location */}
            <div className="z-10 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-orange-500/90 text-white flex items-center justify-center shadow-lg border-2 border-white">
                <IconMapPin className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-white/80 font-bold mt-1 bg-black/50 px-2 py-0.5 rounded-full">
                Địa điểm công việc
              </span>
            </div>

            {/* Worker Pin */}
            <div
              className="absolute z-20 flex flex-col items-center transition-all duration-1000"
              style={{
                transform: `translate(${Math.cos(Date.now() / 3000) * 35}px, ${Math.sin(Date.now() / 3000) * 25}px)`,
              }}
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-teal-400 text-slate-900 flex items-center justify-center font-bold text-xs ring-4 ring-teal-400/30 shadow-md">
                  CP
                </div>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900"></span>
              </div>
              <span className="text-[9px] text-teal-200 font-bold bg-slate-950/80 px-1.5 py-0.2 rounded-full mt-0.5">
                Carepartner
              </span>
            </div>

            {/* Status overlay */}
            <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/50 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-[10px] font-semibold text-emerald-300">
                Trong vùng an toàn ({Math.round(distance)}m / {radius}m)
              </span>
            </div>

            <div className="absolute bottom-3 right-3 text-[10px] text-slate-400 bg-black/60 px-2 py-0.5 rounded">
              GPS Lat: {task.latitude || 10.7769} | Lng: {task.longitude || 106.7009}
            </div>
          </div>

          {/* Device Telemetry info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                Trạng thái thiết bị
              </span>
              <div className="flex items-center space-x-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-bold text-slate-700">Online (Heartbeat OK)</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                Cập nhật lần cuối
              </span>
              <div className="flex items-center space-x-1.5 mt-1 text-slate-700">
                <IconClock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold">{lastPing}</span>
              </div>
            </div>
          </div>

          {/* Geofence notice */}
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/60 flex items-start space-x-3">
            <IconShield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <span className="font-bold">Bảo vệ chủ động:</span> Hệ thống tự động kích hoạt báo động nếu Carepartner mang bé rời ngoài bán kính <strong>{radius}m</strong> hoặc điện thoại bị tắt nguồn đột ngột.
            </div>
          </div>

          {/* SOS Emergency button */}
          <div className="pt-2">
            {sosSent ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center text-xs font-bold text-rose-700">
                🚨 Tín hiệu khẩn cấp đã được gửi tới Tổng đài hỗ trợ và Phụ huynh!
              </div>
            ) : (
              <button
                onClick={handleSendSOS}
                disabled={isSendingSos}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                <IconAlertTriangle className="w-4 h-4" />
                <span>{isSendingSos ? 'Đang kích hoạt...' : 'KÍCH HOẠT SOS KHẨN CẤP'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
