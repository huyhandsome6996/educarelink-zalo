import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
  color?: string;
}

export const IconBook: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
  </svg>
);

export const IconBaby: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 12h.01M15 12h.01M10 16c.5 1 2.5 1 3 0"></path>
    <circle cx="12" cy="12" r="9"></circle>
    <path d="M9 3.5c1.5 1 4.5 1 6 0"></path>
  </svg>
);

export const IconHeart: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
  </svg>
);

export const IconHome: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
);

export const IconSparkles: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"></path>
  </svg>
);

export const IconMapPin: React.FC<IconProps> = ({ className = 'w-4 h-4', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
);

export const IconClock: React.FC<IconProps> = ({ className = 'w-4 h-4', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

export const IconShield: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    <path d="m9 12 2 2 4-4"></path>
  </svg>
);

export const IconStar: React.FC<IconProps & { filled?: boolean }> = ({ className = 'w-4 h-4', size, color = 'currentColor', filled = false }) => (
  <svg width={size} height={size} className={className} fill={filled ? color : 'none'} stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
  </svg>
);

export const IconBell: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
  </svg>
);

export const IconSearch: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <path d="m21 21-4.3-4.3"></path>
  </svg>
);

export const IconPlus: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14"></path>
    <path d="M12 5v14"></path>
  </svg>
);

export const IconBriefcase: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="14" x="2" y="7" rx="2" ry="2"></rect>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
  </svg>
);

export const IconBot: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8"></path>
    <rect width="16" height="12" x="4" y="8" rx="2"></rect>
    <path d="M2 14h2"></path>
    <path d="M20 14h2"></path>
    <path d="M15 13v2"></path>
    <path d="M9 13v2"></path>
  </svg>
);

export const IconUser: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

export const IconSend: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

export const IconCheckCircle: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

export const IconAlertTriangle: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

export const IconLock: React.FC<IconProps> = ({ className = 'w-4 h-4 text-slate-400 absolute left-3.5 top-3', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

export const IconFilter: React.FC<IconProps> = ({ className = 'w-4 h-4', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
  </svg>
);

export const IconGraduationCap: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10 12 5 2 10l10 5 10-5z"></path>
    <path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"></path>
    <path d="M22 10v6"></path>
  </svg>
);

export const IconWallet: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path>
  </svg>
);

export const IconTrendingUp: React.FC<IconProps> = ({ className = 'w-4 h-4', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
    <polyline points="16 7 22 7 22 13"></polyline>
  </svg>
);

export const IconRefresh: React.FC<IconProps> = ({ className = 'w-4 h-4', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 15.5-6.4L21 8"></path>
    <path d="M21 3v5h-5"></path>
    <path d="M21 12a9 9 0 0 1-15.5 6.4L3 16"></path>
    <path d="M3 21v-5h5"></path>
  </svg>
);

export const IconX: React.FC<IconProps> = ({ className = 'w-4 h-4', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"></path>
    <path d="m6 6 12 12"></path>
  </svg>
);

export const IconUtensils: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path>
    <path d="M7 2v20"></path>
    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path>
  </svg>
);

export const IconShoppingCart: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="21" r="1"></circle>
    <circle cx="19" cy="21" r="1"></circle>
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
  </svg>
);

export const IconSmartToy: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8"></path>
    <rect width="16" height="12" x="4" y="8" rx="2"></rect>
    <path d="M2 14h2"></path>
    <path d="M20 14h2"></path>
    <path d="M15 13v2"></path>
    <path d="M9 13v2"></path>
  </svg>
);

export const IconMore: React.FC<IconProps> = ({ className = 'w-5 h-5', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1"></circle>
    <circle cx="12" cy="5" r="1"></circle>
    <circle cx="12" cy="19" r="1"></circle>
  </svg>
);

export const IconNavigation: React.FC<IconProps> = ({ className = 'w-4 h-4', size, color = 'currentColor' }) => (
  <svg width={size} height={size} className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
  </svg>
);
