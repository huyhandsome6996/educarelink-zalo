import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/types';
import { api } from '@/services/api';
import { useAuth } from '@/state/auth';
import { IconBot, IconSend, IconSparkles } from '@/components/common-icons';

export const AIChat: React.FC = () => {
  const { role } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text:
        role === 'parent'
          ? 'Xin chào! Tôi là Trợ lý AI EduCareLink. Tôi có thể hỗ trợ bạn tư vấn mức học phí gia sư, kinh nghiệm chọn Carepartner, giải đáp thắc mắc về an toàn hoặc gợi ý thực đơn cho bé. Bạn cần tôi hỗ trợ điều gì hôm nay?'
          : 'Xin chào Carepartner! Tôi là Trợ lý AI đồng hành của bạn. Tôi có thể hướng dẫn kỹ năng sư phạm, xử lý tình huống khi trẻ ăn vạ, mẹo bảo đảm an toàn khi đưa đón bé và quy tắc ứng xử chuyên nghiệp.',
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      quickReplies:
        role === 'parent'
          ? [
              'Mức phí gia sư Toán lớp 5',
              'Quy trình kiểm tra an toàn Carepartner',
              'Làm sao bật định vị Live Geofence?',
            ]
          : [
              'Cách dỗ bé khi khóc đòi mẹ',
              'Quy trình đưa đón học sinh an toàn',
              'Mẹo dạy kèm học sinh mất tập trung',
            ],
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      let botResponse = '';
      if (role === 'worker') {
        const res = await api.askWorkerChatbot(text);
        botResponse = res.response;
      } else {
        const res = await api.askChatbot(text);
        botResponse = res.response;
      }

      if (!botResponse) {
        botResponse =
          'EduCareLink luôn đặt tiêu chí an toàn và sự phát triển của trẻ lên hàng đầu. Các công việc và hồ sơ đều được AI & Ban quản trị thẩm định kỹ lưỡng.';
      }

      const botMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'bot',
        text: botResponse,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.warn('AI Chat notice:', err.message);
      // Fallback response for seamless demo
      const fallbackMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'bot',
        text: `Cảm ơn bạn đã hỏi về "${text}". Đối với dịch vụ chăm sóc và giáo dục trẻ, EduCareLink khuyến nghị phụ huynh và Carepartner luôn trao đổi lịch trình chi tiết và kích hoạt tính năng Live Geofence để đảm bảo an toàn tuyệt đối.`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-135px)] pb-16">
      {/* Top AI badge */}
      <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl text-white shadow-xs flex items-center justify-between shrink-0 mb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <IconSparkles className="w-5 h-5 text-yellow-300" />
          </div>
          <div>
            <h3 className="text-xs font-black">EduCareLink AI Co-pilot</h3>
            <p className="text-[10px] text-white/80">Tích hợp mô hình Gemini AI thông minh</p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
          {role === 'parent' ? 'Dành cho Phụ huynh' : 'Dành cho Carepartner'}
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-3 px-1">
        {messages.map((m) => {
          const isBot = m.sender === 'bot';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}
            >
              <div
                className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                  isBot
                    ? 'bg-white border border-slate-100 text-slate-800 shadow-2xs rounded-tl-xs'
                    : 'bg-orange-500 text-white shadow-xs rounded-tr-xs'
                }`}
              >
                {m.text}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 px-1">{m.timestamp}</span>

              {/* Quick Reply Suggestions */}
              {isBot && m.quickReplies && m.quickReplies.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {m.quickReplies.map((qr, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(qr)}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-full transition-all border border-indigo-100"
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center space-x-2 p-3 bg-white border border-slate-100 rounded-2xl w-24">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"></span>
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce delay-100"></span>
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce delay-200"></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Bar */}
      <div className="pt-2 bg-white sticky bottom-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Hỏi AI bất kỳ câu hỏi nào về dịch vụ, an toàn..."
            className="flex-1 px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all shadow-inner"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-11 h-11 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md active:scale-95 disabled:opacity-50 transition-all"
          >
            <IconSend className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
