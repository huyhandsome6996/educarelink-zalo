import { ServiceCategory, Task, TaskApplication, NotificationItem } from '@/types';

export const MOCK_CATEGORIES: ServiceCategory[] = [
  { id: 1, name: 'Gia sư', icon_name: 'BookOpen', description: 'Dạy kèm Toán, Lý, Hóa, Tiếng Anh từ lớp 1-12' },
  { id: 2, name: 'Đón trẻ', icon_name: 'Baby', description: 'Đón bé từ trường về nhà an toàn, giám sát hành trình' },
  { id: 3, name: 'Trông trẻ', icon_name: 'Heart', description: 'Trông coi, vui chơi cùng bé tại nhà hoặc ngoài trời' },
  { id: 4, name: 'Nấu ăn', icon_name: 'Restaurant', description: 'Chuẩn bị bữa cơm gia đình đủ dinh dưỡng, hợp khẩu vị' },
  { id: 5, name: 'Dọn dẹp', icon_name: 'Home', description: 'Vệ sinh phòng ốc, sắp xếp đồ đạc ngăn nắp' },
  { id: 6, name: 'Mua sắm hộ', icon_name: 'ShoppingCart', description: 'Đi chợ, siêu thị mua nhu yếu phẩm theo danh sách' },
  { id: 7, name: 'Hỗ trợ AI', icon_name: 'SmartToy', description: 'Luyện tập kỹ năng số & công nghệ AI cho bé' },
  { id: 8, name: 'Khác', icon_name: 'MoreHoriz', description: 'Hỗ trợ sự kiện, kỹ năng sống và dịch vụ khác' },
];

export const MOCK_TASKS: Task[] = [
  {
    id: 101,
    title: 'Gia sư dạy kèm Toán & Tiếng Việt lớp 4',
    description: 'Cần một bạn sinh viên Sư phạm kèm bé trai học Toán tư duy và củng cố bài vở lúc 18h-20h các ngày thứ 3, 5, 7.',
    price: 250000,
    status: 'open',
    parent: 1,
    parent_name: 'Chị Lan (Quận 1)',
    category: 1,
    category_name: 'Gia sư',
    category_code: 'gia-su',
    location: '45 Lê Lợi, Bến Nghé, Quận 1, TP.HCM',
    latitude: 10.7769,
    longitude: 106.7009,
    scheduled_time: '2026-10-10T18:00:00+07:00',
    geofence_radius: 500,
    created_at: '2026-10-07T08:30:00+07:00',
  },
  {
    id: 102,
    title: 'Đón bé gái 6 tuổi tại trường Tiểu học Lê Ngọc Hân',
    description: 'Đón bé lúc 16h30 từ trường về nhà cách đó 2km, phụ huynh chuẩn bị sẵn mũ bảo hiểm. Yêu cầu có xe máy an toàn.',
    price: 150000,
    status: 'in_progress',
    parent: 2,
    parent_name: 'Anh Minh (Quận 3)',
    category: 2,
    category_name: 'Đón trẻ',
    category_code: 'don-tre',
    location: 'Trường TH Lê Ngọc Hân, Quận 1, TP.HCM',
    latitude: 10.7725,
    longitude: 106.6961,
    scheduled_time: '2026-10-08T16:30:00+07:00',
    geofence_radius: 800,
    created_at: '2026-10-07T09:15:00+07:00',
  },
  {
    id: 103,
    title: 'Trông bé 3 tuổi và đọc truyện tranh buổi chiều',
    description: 'Trông bé tại nhà trong khi mẹ tham gia họp trực tuyến. Cần người có tính kiên nhẫn, vui vẻ, không dùng điện thoại khi trông bé.',
    price: 320000,
    status: 'open',
    parent: 3,
    parent_name: 'Chị Mai Hoa (Bình Thạnh)',
    category: 3,
    category_name: 'Trông trẻ',
    category_code: 'trong-tre',
    location: 'Vinhomes Central Park, Bình Thạnh, TP.HCM',
    latitude: 10.7952,
    longitude: 106.7218,
    scheduled_time: '2026-10-09T14:00:00+07:00',
    geofence_radius: 300,
    created_at: '2026-10-06T14:00:00+07:00',
  },
  {
    id: 104,
    title: 'Dọn dẹp căn hộ 2 phòng ngủ & gấp quần áo',
    description: 'Dọn dẹp định kỳ cuối tuần căn hộ 70m2, lau sàn, hút bụi và hỗ trợ gấp quần áo sạch.',
    price: 280000,
    status: 'completed',
    parent: 1,
    parent_name: 'Chị Lan (Quận 1)',
    category: 5,
    category_name: 'Dọn dẹp',
    category_code: 'don-dep',
    location: 'Căn hộ Masteri Thảo Điền, TP. Thủ Đức',
    latitude: 10.8016,
    longitude: 106.7412,
    scheduled_time: '2026-10-05T09:00:00+07:00',
    created_at: '2026-10-04T10:00:00+07:00',
    is_reviewed: true,
  },
];

export const MOCK_CANDIDATES: TaskApplication[] = [
  {
    id: 1,
    task: 101,
    worker: 201,
    worker_name: 'Trần Minh (ĐH Bách Khoa)',
    status: 'pending',
    note: 'Em là sinh viên năm 3 khoa CNTT, từng đạt giải Nhì Toán cấp tỉnh và có 2 năm kinh nghiệm dạy kèm gia sư cấp 1, 2.',
    applied_at: '2026-10-07T10:20:00+07:00',
    worker_rating: 4.9,
    worker_avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
  },
  {
    id: 2,
    task: 101,
    worker: 202,
    worker_name: 'Nguyễn Thị Hương (ĐH Sư Phạm)',
    status: 'pending',
    note: 'Em học Sư phạm Tiểu học năm cuối, rất yêu quý trẻ và có phương pháp sư phạm tâm lý giúp bé tiếp thu nhanh.',
    applied_at: '2026-10-07T11:45:00+07:00',
    worker_rating: 5.0,
    worker_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  },
];

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 1,
    title: 'Ứng viên mới nộp hồ sơ',
    message: 'Carepartner Nguyễn Thị Hương vừa ứng tuyển công việc Gia sư kèm Toán lớp 4 của bạn.',
    is_read: false,
    created_at: '2026-10-08T07:15:00+07:00',
  },
  {
    id: 2,
    title: 'Hồ sơ Carepartner đã được duyệt',
    message: 'Chúc mừng bạn! Tài khoản Carepartner đã được Admin xác thực và sẵn sàng nhận việc.',
    is_read: true,
    created_at: '2026-10-07T14:30:00+07:00',
  },
  {
    id: 3,
    title: 'Hệ thống an toàn Geofence',
    message: 'Carepartner đang di chuyển đúng lộ trình trong vùng bán kính 500m an toàn.',
    is_read: true,
    created_at: '2026-10-07T17:05:00+07:00',
  },
];

export interface FeaturedCarepartner {
  id: number;
  name: string;
  avatar: string;
  university: string;
  rating: number;
  jobs: number;
  tier_label: string;
}

export const MOCK_TOP_CAREPARTNERS: FeaturedCarepartner[] = [
  {
    id: 1,
    name: 'Trần Thị Hương',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    university: 'ĐH Sư Phạm TP.HCM',
    rating: 4.9,
    jobs: 127,
    tier_label: 'Hạng Kim Cương',
  },
  {
    id: 2,
    name: 'Lê Văn Minh',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
    university: 'ĐH Bách Khoa',
    rating: 4.8,
    jobs: 98,
    tier_label: 'Hạng Vàng',
  },
  {
    id: 3,
    name: 'Phạm Ngọc Anh',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    university: 'ĐH KHXH&NV',
    rating: 5.0,
    jobs: 86,
    tier_label: 'Hạng Vàng',
  },
  {
    id: 4,
    name: 'Vũ Đức Thắng',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    university: 'ĐH Y Dược TP.HCM',
    rating: 4.7,
    jobs: 74,
    tier_label: 'Hạng Bạc',
  },
];
