/**
 * CandidateProfileV2Screen — port CHÍNH XÁC mobile/src/screens/Parent/CandidateProfileV2Screen.js (1752 dòng).
 * Thiết kế Google Stitch AI: "EduCareLink - Hồ sơ chi tiết CarePartner" — 100% dynamic từ
 * matching_service, KHÔNG gọi API riêng (RN route params: { candidate, jobId, job } — không phải
 * { workerId }; getWorkerProfile(/worker/{id}/profile/) chỉ dùng ở CandidateProfileScreen V1 cũ).
 * Nhận thêm alias `worker` (worker = candidate) cho tương thích prompt; chỉ có workerId (không có
 * object) → render bộ fallback demo như RN khi không có params.
 * Thứ tự khối giữ nguyên RN:
 *  1. Sticky Top App Bar: back, "Hồ sơ CarePartner" + pill "Đã đối soát", mã #CP-xxxx, share + bookmark
 *  2. Hero Profile Header Card: banner trường ĐH, avatar lớn + tick xanh, huy hiệu ELO xx/100,
 *     tên + tuổi/giới tính, trường & chuyên ngành, tags phản hồi
 *  3. Core Credibility Bento 4 ô: ⭐ rating, năm học, cự ly km (~Xp), số ca đúng giờ
 *  4. Verified Trust Shield: khung xác thực 4 lớp động theo trường/ngành
 *  5. Giới thiệu bản thân & Phương pháp đồng hành
 *  6. Kỹ năng & Chuyên môn: chips chuyên môn động (getSkillIcon) + kỹ năng mềm
 *  7. Minh chứng bằng cấp & Giải thưởng (carousel ngang, getDynamicCertificates)
 *  8. Đánh giá thực tế từ phụ huynh (getDynamicReviews — sao + comment + thời gian)
 *  9. Escrow & Satisfaction Commitment
 * 10. Sticky Bottom Action Dock: học phí/giờ, tạm tính ca 2h, ký quỹ, CTA "Chọn CarePartner này"
 * 11. Instant Confirmation Modal → selectCarePartner(jobId, carepartner_id, uuid()) → BookingDetail
 * Khác biệt platform: Share.share → clipboard + showAlert; Alert.alert 1 nút onPress → window.confirm;
 * Modal → overlay fixed zIndex 300; icon thiếu glyph → alias cục bộ ic(); dock nâng lên trên TabBar
 * (bottom: TAB_BAR_HEIGHT — web TabBar fixed 84px thay cho native tab bar của RN).
 */
import React, { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, showAlert, Screen, useStatusBarHeight } from "@/components/ui";
import { SHADOWS, TAB_BAR_HEIGHT } from "@/theme";
import { useNav } from "@/navigation/router";
import { selectCarePartner } from "@/api/matching";

/** Icon thiếu glyph trong ionicons.ts (159 glyph) → glyph Ionicons gần nhất cùng nghĩa */
const ic = (name: string) =>
  (
    {
      "share-social-outline": "send",
      "business-outline": "business",
      "school-outline": "school",
      "chatbox-ellipses": "chatbubble-ellipses",
      "bulb-outline": "sparkles",
      "calculator-outline": "stats-chart-outline",
      "language-outline": "globe-outline",
      "code-slash-outline": "hardware-chip",
      "medkit-outline": "medkit",
      "chatbubble-outline": "chatbubbles-outline",
      "ribbon-outline": "ribbon",
      "trophy-outline": "trophy",
      bulb: "flash",
      bicycle: "car",
      "lock-closed": "lock-closed-outline",
    } as Record<string, string>
  )[name] ?? name;

// Bộ màu avatar sinh viên — nguyên bản RN dòng 42-51
const AVATAR_COLORS = [
  "#F26522", // Signature Orange
  "#2563EB", // Royal Blue
  "#0E9F6E", // Emerald Green
  "#D97706", // Amber Gold
  "#7C3AED", // Purple
  "#EC4899", // Pink
  "#0D9488", // Teal
  "#4F46E5", // Indigo
];

function getAvatarColor(identifier = "") {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitial(name = "") {
  if (!name) return "C";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1]?.charAt(0).toUpperCase() || "C";
}

function inferGender(candidate: any) {
  if (candidate?.gender === "female") return "Nữ";
  if (candidate?.gender === "male") return "Nam";
  const name = candidate?.display_name || "";
  const femaleMarkers = [
    "Thị", "Hà", "Thư", "Linh", "Trang", "Chi", "Mai", "Lan",
    "Hương", "Nhi", "Phương", "Vy", "Thảo", "Yến", "Ngọc", "Quỳnh",
    "Hoa", "Huyền", "Dung", "Ly", "An", "My",
  ];
  const maleMarkers = [
    "Văn", "Đức", "Hoàng", "Nam", "Quang", "Long", "Dũng", "Minh",
    "Tuấn", "Huy", "Khoa", "Tùng", "Bách", "Thành", "Phong", "Việt",
    "Đạt", "Hải", "Sơn", "Hưng",
  ];
  for (const m of femaleMarkers) {
    if (name.includes(m)) return "Nữ";
  }
  for (const m of maleMarkers) {
    if (name.includes(m)) return "Nam";
  }
  return "Nữ";
}

function inferAgeAndYear(candidate: any) {
  const major = candidate?.major || "";
  if (major.includes("Năm 1")) return { age: 19, year: "Năm 1", type: "Chính quy" };
  if (major.includes("Năm 2")) return { age: 20, year: "Năm 2", type: "Chính quy" };
  if (major.includes("Năm 3")) return { age: 21, year: "Năm 3", type: "Chính quy" };
  if (major.includes("Năm 4")) return { age: 22, year: "Năm 4", type: "Chính quy" };
  if (major.includes("Năm 5")) return { age: 23, year: "Năm 5", type: "Chính quy" };
  if (major.includes("Năm 6")) return { age: 24, year: "Năm 6", type: "Chính quy" };
  if (major.toLowerCase().includes("tốt nghiệp") || major.toLowerCase().includes("cử nhân")) {
    return { age: 24, year: "Cử nhân", type: "Đã tốt nghiệp" };
  }
  return { age: 21, year: "Năm 3", type: "Chính quy" };
}

function getUniversityBadgeText(school = "") {
  if (school.includes("Sư Phạm")) return "Sinh viên Sư Phạm Huế Tuyển Chọn";
  if (school.includes("Y Dược") || school.includes("Y -")) return "Sinh viên Y Dược Huế Tuyển Chọn";
  if (school.includes("Ngoại Ngữ")) return "Sinh viên Ngoại Ngữ Huế Tuyển Chọn";
  if (school.includes("Khoa học")) return "Sinh viên Khoa học Huế Tuyển Chọn";
  if (school.includes("Kinh Tế")) return "Sinh viên Kinh Tế Huế Tuyển Chọn";
  if (school.includes("Kỹ Thuật")) return "Sinh viên Sư Phạm Kỹ Thuật Huế Tuyển Chọn";
  if (school) return `Sinh viên ${school} Tuyển Chọn`;
  return "Sinh viên Đại học Tuyển Chọn";
}

function getSkillIcon(skillName = "") {
  const s = skillName.toLowerCase();
  if (s.includes("toán") || s.includes("logic") || s.includes("tính")) return "calculator-outline";
  if (s.includes("anh") || s.includes("ngoại ngữ") || s.includes("ngữ pháp") || s.includes("phát âm"))
    return "language-outline";
  if (s.includes("chữ") || s.includes("viết") || s.includes("đọc") || s.includes("văn")) return "create-outline";
  if (s.includes("khoa học") || s.includes("lập trình") || s.includes("scratch") || s.includes("stem"))
    return "code-slash-outline";
  if (s.includes("y tế") || s.includes("sơ cứu") || s.includes("dinh dưỡng") || s.includes("sức khỏe"))
    return "medkit-outline";
  if (s.includes("chăm sóc") || s.includes("kiên nhẫn") || s.includes("tâm lý") || s.includes("dịu dàng"))
    return "heart-outline";
  if (s.includes("giao tiếp") || s.includes("nói")) return "chatbubble-outline";
  return "ribbon-outline";
}

interface CertItem {
  id: string;
  icon: string;
  badgeColor: "blue" | "green" | "amber";
  badgeText: string;
  title: string;
  desc: string;
  footer: string;
}

function getDynamicCertificates(candidate: any): CertItem[] {
  const school = candidate.school || "Đại học";
  const major = candidate.major || "";
  const list: CertItem[] = [
    {
      id: "cert-academic",
      icon: "trophy-outline",
      badgeColor: "blue",
      badgeText: "Đã duyệt",
      title: `Sinh viên Giỏi ${school} 2024`,
      desc: "Điểm rèn luyện xuất sắc & Học bổng",
      footer: `Cấp bởi ${school}`,
    },
  ];

  if (
    major.includes("Kinh tế") ||
    major.includes("Tiếng Anh") ||
    major.includes("Tiếng Trung") ||
    major.includes("Tiếng Pháp") ||
    major.includes("Tiếng Nhật") ||
    major.includes("IELTS")
  ) {
    list.push({
      id: "cert-lang",
      icon: "shield-checkmark-outline",
      badgeColor: "green",
      badgeText: "IDP/BC đối soát",
      title: "IELTS Academic 7.5 - 8.0",
      desc: "Phát âm chuẩn bản xứ & Giao tiếp lưu loát",
      footer: "Chứng chỉ quốc tế 2023 - 2024",
    });
  } else if (
    major.includes("Máy tính") ||
    major.includes("Toán") ||
    major.includes("Khoa học") ||
    major.includes("Kỹ thuật")
  ) {
    list.push({
      id: "cert-stem",
      icon: "shield-checkmark-outline",
      badgeColor: "green",
      badgeText: "Đã kiểm tra",
      title: "Tư duy Logic & Kèm Toán nâng cao",
      desc: "Giải thưởng Olympic / NCKH Sinh viên",
      footer: "Khoa Toán - Tin học cấp chứng nhận",
    });
  } else if (major.includes("Y") || major.includes("Bác sĩ") || major.includes("Dược")) {
    list.push({
      id: "cert-med",
      icon: "shield-checkmark-outline",
      badgeColor: "green",
      badgeText: "Bộ Y tế / Viện",
      title: "Sơ cấp cứu & Dinh dưỡng Nhi khoa",
      desc: "Thực hành lâm sàng & An toàn trẻ em",
      footer: "Viện Nhi Trung ương đối soát",
    });
  } else {
    list.push({
      id: "cert-pedagogy",
      icon: "shield-checkmark-outline",
      badgeColor: "green",
      badgeText: "Đã thẩm định",
      title: "Nghiệp vụ Sư phạm & Giảng dạy",
      desc: "Phương pháp tiếp cận tâm lý trẻ em",
      footer: "Chứng chỉ chuẩn đầu ra chính quy",
    });
  }

  list.push({
    id: "cert-educarelink",
    icon: "happy-outline",
    badgeColor: "amber",
    badgeText: "Đạt chuẩn",
    title: "Khóa Huấn luyện An toàn EduCareLink",
    desc: "Quy tắc ứng xử và bảo vệ an toàn bé",
    footer: "Đạt chuẩn kiểm duyệt 2024",
  });

  return list;
}

interface ReviewItem {
  id: string;
  authorName: string;
  authorSub: string;
  avatarLetter: string;
  avatarBg: string;
  avatarColor: string;
  rating: number;
  content: string;
  timeAgo: string;
}

function getDynamicReviews(candidate: any): ReviewItem[] {
  const firstName = candidate.display_name?.trim().split(/\s+/).pop() || "bạn";
  const roleName = candidate.gender === "female" ? `Cô ${firstName}` : `Thầy ${firstName}`;
  const reviews: ReviewItem[] = [];

  if (candidate.latest_review) {
    reviews.push({
      id: "rev-1",
      authorName: "Chị Phương Mai",
      authorSub: "Phụ huynh bé lớp 4 · TP. Huế",
      avatarLetter: "M",
      avatarBg: "#FFE4E6",
      avatarColor: "#E11D48",
      rating: 5,
      content: candidate.latest_review,
      timeAgo: "3 ngày trước · Kèm học tại nhà",
    });
  } else {
    reviews.push({
      id: "rev-1",
      authorName: "Chị Phương Mai",
      authorSub: "Phụ huynh bé lớp 4 · TP. Huế",
      avatarLetter: "M",
      avatarBg: "#FFE4E6",
      avatarColor: "#E11D48",
      rating: 5,
      content: `Bé nhà mình trước đây rất sợ học và hay mất tập trung. ${roleName} dạy rất nhẹ nhàng và có phương pháp trực quan sinh động. Sau 1 tháng bé đã hào hứng tự giác làm bài. Rất cảm ơn ${roleName}!`,
      timeAgo: "3 ngày trước · Kèm học tại nhà",
    });
  }

  reviews.push({
    id: "rev-2",
    authorName: "Anh Quốc Tuấn",
    authorSub: "Phụ huynh bé 7 tuổi · TP. Huế",
    avatarLetter: "T",
    avatarBg: "#DBEAFE",
    avatarColor: "#2563EB",
    rating: 5,
    content: `Bạn ${firstName} rất đúng giờ, lễ phép và chuẩn tác phong. Gia đình rất yên tâm khi gửi gắm con. Bạn còn chu đáo mang thêm phiếu bài tập và tài liệu rèn luyện cho con.`,
    timeAgo: "2 tuần trước · Đồng hành cùng bé",
  });

  return reviews;
}

interface TrustItem {
  id: string;
  title: string;
  desc: string;
}

function getDynamicTrustShieldItems(candidate: any): TrustItem[] {
  const school = candidate.school || "Đại học";
  const major = candidate.major || "";

  let certTitle = "Chứng chỉ Đào tạo Kỹ năng Gia sư EduCareLink";
  let certDesc = "Đã qua bài kiểm tra năng lực và phỏng vấn trực tiếp";

  if (school.includes("Sư Phạm") || major.includes("Sư phạm") || major.includes("Giáo dục")) {
    certTitle = "Chứng chỉ Nghiệp vụ Sư phạm & Kỹ năng Trẻ";
    certDesc = "Nắm vững phương pháp giảng dạy tích cực và tâm lý học";
  } else if (
    major.includes("IELTS") ||
    major.includes("Tiếng Anh") ||
    major.includes("Tiếng Trung") ||
    major.includes("Tiếng Pháp") ||
    major.includes("Tiếng Nhật") ||
    school.includes("Ngoại Ngữ")
  ) {
    certTitle = "Chứng chỉ Ngoại ngữ IELTS / Chuẩn C1 Quốc tế";
    certDesc = "Điểm số ngôn ngữ chuẩn và phát âm chuẩn đã đối soát";
  } else if (
    school.includes("Khoa học") ||
    school.includes("Kỹ Thuật") ||
    major.includes("Máy tính") ||
    major.includes("Toán")
  ) {
    certTitle = "Chứng chỉ Tư duy Logic, Toán & STEM";
    certDesc = "Phương pháp tư duy trực quan, rèn tính tự lập cho bé";
  } else if (school.includes("Y") || major.includes("Bác sĩ") || major.includes("Dược")) {
    certTitle = "Chứng chỉ Sơ cấp cứu Nhi khoa & Dinh dưỡng Trẻ";
    certDesc = "Thực hành an toàn sức khỏe và chăm sóc trẻ em";
  }

  return [
    {
      id: "shield-student-card",
      title: `Thẻ sinh viên chính quy ${school}`,
      desc: "Đã đối soát trực tiếp cùng thẻ sinh viên & CSDL trường",
    },
    {
      id: "shield-id-card",
      title: "CCCD gắn chip Bộ Công An",
      desc: "Đối soát sinh trắc học khuôn mặt AI · Không tiền án tiền sự",
    },
    {
      id: "shield-cert",
      title: certTitle,
      desc: certDesc,
    },
    {
      id: "shield-ethics",
      title: "Ký cam kết Đạo đức bảo vệ trẻ em",
      desc: "Cam kết không tự ý hủy ca, tôn trọng nề nếp gia đình",
    },
  ];
}

// UUID ngẫu nhiên cho Idempotency-Key — nguyên bản RN dòng 289-293
const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

interface Props {
  candidate?: any; // route params chính xác của RN V2: { candidate, jobId, job }
  worker?: any; // alias tương thích (RN V2 không dùng workerId/getWorkerProfile)
  jobId?: string | number;
  job?: any;
}

const CandidateProfileV2Screen: React.FC<Props> = (props) => {
  const nav = useNav();
  const statusBarH = useStatusBarHeight();
  const rawCandidate = props.candidate ?? props.worker;
  const jobId = props.jobId;
  const passedJob = props.job;

  // Dữ liệu ứng viên hoàn toàn động, trích xuất chuẩn xác từ matching_service — nguyên bản RN
  const candidate = useMemo(() => {
    const inferred = inferAgeAndYear(rawCandidate);
    const genderVi = inferGender(rawCandidate);

    return {
      carepartner_id: rawCandidate?.carepartner_id || "cp-8824",
      display_name: rawCandidate?.display_name || "Nguyễn Thu Hà",
      avatar_url: rawCandidate?.avatar_url || "",
      gender: rawCandidate?.gender || (genderVi === "Nam" ? "male" : "female"),
      gender_vi: genderVi,
      age: inferred.age,
      academic_year: inferred.year,
      academic_type: inferred.type,
      school: rawCandidate?.school || "Sinh viên EduCareLink đã đối soát",
      major: rawCandidate?.major || "",
      match_score: rawCandidate?.match_score != null ? rawCandidate.match_score : 96,
      match_level_vi: rawCandidate?.match_level_vi || "Rất phù hợp",
      rating: rawCandidate?.rating != null ? Number(rawCandidate.rating).toFixed(1) : "4.9",
      completed_jobs: rawCandidate?.completed_jobs != null ? rawCandidate.completed_jobs : 48,
      distance_km: rawCandidate?.distance_km != null ? rawCandidate.distance_km : 1.2,
      response_tag: rawCandidate?.response_tag
        ? rawCandidate.response_tag === "replies_fast"
          ? "Phản hồi trong ~3 phút"
          : rawCandidate.response_tag
        : "Phản hồi trong ~5 phút",
      top_skills:
        rawCandidate?.top_skills && rawCandidate.top_skills.length
          ? rawCandidate.top_skills
          : ["Toán tiểu học", "Rèn tư duy", "Kiên nhẫn với trẻ"],
      latest_review: rawCandidate?.latest_review || "",
      bio: rawCandidate?.bio || "",
    };
  }, [rawCandidate]);

  // Thông tin ca làm việc đồng bộ trực tiếp từ form tạo việc của phụ huynh — nguyên bản RN
  const job = useMemo(() => {
    return {
      title: passedJob?.title || "Toán lớp 5 & Rèn tư duy",
      schedule: passedJob?.schedule || "Thứ 3, Thứ 5 (19:00 - 21:00)",
      location_note: passedJob?.location_note || "Vị trí đã chọn trên bản đồ",
      hourly_rate_vnd: passedJob?.hourly_rate_vnd || 120000,
    };
  }, [passedJob]);

  const [selecting, setSelecting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Xử lý chia sẻ hồ sơ — RN Share.share → web: copy clipboard + alert nội dung
  const handleShare = async () => {
    const message = `Xem hồ sơ CarePartner ${candidate.display_name} (${candidate.school}) trên EduCareLink! Đã đối soát CCCD & Thẻ SV: https://educarelink.vn/profile/${candidate.carepartner_id}`;
    try {
      await navigator.clipboard?.writeText(message);
    } catch {}
    showAlert("Chia sẻ hồ sơ CarePartner", message);
  };

  // Xử lý chốt ứng viên (Escrow Booking) — nguyên bản RN doSelect
  const doSelect = async () => {
    setConfirmVisible(false);
    setSelecting(true);

    // Xử lý dữ liệu thử nghiệm khi chưa có job thật từ server
    if (!jobId || jobId === "demo" || String(jobId).startsWith("demo")) {
      setTimeout(() => {
        setSelecting(false);
        const ok = window.confirm(
          "Ghép cặp thành công! 🎉\n\n" +
            `Yêu cầu của bạn đã được chuyển đến CarePartner ${candidate.display_name}. Khoản ký quỹ đang được giữ an toàn bởi EduCareLink Guarantee.`
        );
        if (ok) {
          nav.navigate("ParentHome"); // RN: ParentTabs { screen: 'ParentHome' }
        }
      }, 500);
      return;
    }

    try {
      const booking: any = await selectCarePartner(String(jobId), candidate.carepartner_id, uuid());
      const ok = window.confirm(
        "Ghép cặp thành công! 🎉\n\n" +
          `Bạn đã chọn ${candidate.display_name}. Đơn đã được xác nhận và thông báo có tiếng chuông đã gửi tới CarePartner.`
      );
      if (ok) {
        nav.replace("BookingDetail", { bookingId: booking.id });
      }
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === "slot_taken") {
        const goBack = window.confirm(
          "Slot đã có người chọn\n\n" +
            "Rất tiếc, CarePartner này vừa nhận đơn khác. Bạn vui lòng quay lại để chọn ứng viên phù hợp khác nhé."
        );
        if (goBack) {
          nav.goBack();
        }
      } else {
        const msg = err?.response?.data?.detail || "Không chọn được ứng viên. Vui lòng thử lại sau.";
        showAlert("Thông báo", msg);
      }
    } finally {
      setSelecting(false);
    }
  };

  const cpNumber = String(candidate.carepartner_id).replace("cp-", "");
  const hourlyRate = job.hourly_rate_vnd || 120000;
  const estimatedSession = hourlyRate * 2;
  const avatarColor = getAvatarColor(candidate.carepartner_id || candidate.display_name);
  const avatarInitial = getInitial(candidate.display_name);
  const universityBannerText = getUniversityBadgeText(candidate.school);
  const travelMinutes = Math.max(2, Math.round(Number(candidate.distance_km) * 3.5));
  const trustItems = useMemo(() => getDynamicTrustShieldItems(candidate), [candidate]);
  const certificates = useMemo(() => getDynamicCertificates(candidate), [candidate]);
  const reviews = useMemo(() => getDynamicReviews(candidate), [candidate]);

  return (
    <Screen bg="#F8FAFC" scroll={false}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, position: "relative" }}>
        {/* ============================================================ */}
        {/* 1. STICKY TOP APP BAR — paddingTop max(insets.top, 10) như RN */}
        {/* ============================================================ */}
        <div style={{ ...S.topBar, paddingTop: Math.max(statusBarH, 10) }}>
          <Touchable onPress={nav.goBack} hitSlop={10} style={S.circleBtn}>
            <Icon name="arrow-back" size={20} color="#1E293B" />
          </Touchable>

          <div style={S.topBarCenter}>
            <div style={S.verifiedTitleRow}>
              <span style={S.topBarTitle}>Hồ sơ CarePartner</span>
              <div style={S.verifiedPillSmall}>
                <Icon name="shield-checkmark" size={11} color="#0E9F6E" />
                <span style={S.verifiedPillSmallText}>Đã đối soát</span>
              </div>
            </div>
            <span style={S.topBarSub}>Mã đối tác: #CP-{cpNumber}</span>
          </div>

          <div style={S.topBarActions}>
            <Touchable onPress={handleShare} hitSlop={10} style={S.circleBtn}>
              <Icon name={ic("share-social-outline")} size={19} color="#475569" />
            </Touchable>

            <Touchable
              onPress={() => setIsBookmarked(!isBookmarked)}
              hitSlop={10}
              style={S.circleBtn}
            >
              <Icon
                name={isBookmarked ? "heart" : "heart-outline"}
                size={20}
                color={isBookmarked ? "#EF4444" : "#475569"}
              />
            </Touchable>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 2. SCROLLABLE CONTENT BODY                                   */}
        {/* ============================================================ */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ ...S.scrollContent, paddingBottom: 130 + TAB_BAR_HEIGHT }}>
            {/* HERO PROFILE HEADER CARD */}
            <div style={S.heroCard}>
              {/* Top Banner with University Vibe */}
              <div style={S.heroBanner}>
                <div style={S.bannerBadgeLeft}>
                  <Icon name="school" size={14} color="#EA580C" />
                  <span style={S.bannerBadgeLeftText}>{universityBannerText}</span>
                </div>
                <div style={S.bannerBadgeRight}>
                  <span style={S.bannerBadgeRightText}>
                    {candidate.match_score >= 90
                      ? `Top ELO ${candidate.match_score}/100`
                      : "Hồ sơ đã xác minh"}
                  </span>
                </div>
              </div>

              <div style={S.heroBody}>
                {/* Avatar & ELO Match Badge Row */}
                <div style={S.avatarRow}>
                  {/* Large Portrait Avatar */}
                  <div style={S.avatarWrapper}>
                    {candidate.avatar_url ? (
                      <img src={candidate.avatar_url} alt={candidate.display_name} style={S.avatarImage} />
                    ) : (
                      <div style={{ ...S.avatarInner, backgroundColor: avatarColor }}>
                        <span style={S.avatarInitialText}>{avatarInitial}</span>
                      </div>
                    )}
                    <div style={S.avatarCheckBadge}>
                      <Icon name="checkmark" size={12} color="#FFFFFF" />
                    </div>
                  </div>

                  {/* ELO Match Badge */}
                  <div style={S.eloBadge}>
                    <div style={S.eloBadgeHeader}>
                      <Icon name="sparkles" size={12} color="#FDE68A" />
                      <span style={S.eloBadgeHeaderText}>Thuật toán ELO</span>
                    </div>
                    <div style={S.eloScoreRow}>
                      <span style={S.eloScoreNum}>{candidate.match_score}</span>
                      <span style={S.eloScoreSuffix}>/100 điểm</span>
                    </div>
                  </div>
                </div>

                {/* Name & Academic Info */}
                <div style={S.nameSection}>
                  <div style={S.nameRow}>
                    <span style={S.candidateName}>{candidate.display_name}</span>
                    <div style={S.genderAgePill}>
                      <span style={S.genderAgeText}>
                        {candidate.age} tuổi · {candidate.gender_vi}
                      </span>
                    </div>
                  </div>

                  <div style={S.schoolRow}>
                    <Icon name={ic("business-outline")} size={15} color="#2563EB" style={{ marginRight: 5 }} />
                    <span style={S.schoolTextBold}>{candidate.school}</span>
                    <span style={S.dotDivider}>·</span>
                    <span style={S.majorText}>{candidate.major}</span>
                  </div>

                  {/* Fast Response & Schedule Tags */}
                  <div style={S.quickTagsWrap}>
                    <div style={S.quickTagOrange}>
                      <Icon name="flash" size={13} color="#EA580C" style={{ marginRight: 4 }} />
                      <span style={S.quickTagOrangeText}>{candidate.response_tag}</span>
                    </div>
                    <div style={S.quickTagGreen}>
                      <Icon name="calendar-outline" size={13} color="#059669" style={{ marginRight: 4 }} />
                      <span style={S.quickTagGreenText}>Trùng khớp 100% lịch hẹn</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CORE CREDIBILITY BENTO (4-Column Metric Grid) */}
            <div style={S.bentoGrid}>
              {/* Box 1: Rating */}
              <div style={S.bentoCard}>
                <Icon name="star" size={18} color="#F59E0B" />
                <span style={S.bentoValue}>
                  {candidate.rating}
                  <span style={S.bentoSubValue}>/5</span>
                </span>
                <span style={S.bentoLabel}>
                  {candidate.completed_jobs > 0 ? `${candidate.completed_jobs} đánh giá` : "Được tin cậy"}
                </span>
              </div>

              {/* Box 2: Academic Year */}
              <div style={S.bentoCard}>
                <Icon name={ic("school-outline")} size={18} color="#2563EB" />
                <span style={S.bentoValue}>{candidate.academic_year}</span>
                <span style={S.bentoLabel}>{candidate.academic_type}</span>
              </div>

              {/* Box 3: Distance */}
              <div style={S.bentoCard}>
                <Icon name="navigate-outline" size={18} color="#E11D48" />
                <span style={S.bentoValue}>
                  {candidate.distance_km} <span style={S.bentoSubValue}>km</span>
                </span>
                <span style={S.bentoLabel}>~{travelMinutes}p di chuyển</span>
              </div>

              {/* Box 4: Completed Jobs */}
              <div style={S.bentoCard}>
                <Icon name="shield-checkmark-outline" size={18} color="#059669" />
                <span style={S.bentoValue}>
                  {candidate.completed_jobs} <span style={S.bentoSubValue}>ca</span>
                </span>
                <span style={S.bentoLabel}>100% đúng giờ</span>
              </div>
            </div>

            {/* VERIFIED TRUST SHIELD (Xác thực 4 lớp EduCareLink) */}
            <div style={S.trustShieldCard}>
              <div style={S.trustShieldHeader}>
                <div style={S.trustShieldTitleWrap}>
                  <div style={S.shieldIconBox}>
                    <Icon name="shield-checkmark" size={15} color="#FFFFFF" />
                  </div>
                  <span style={S.trustShieldTitle}>Xác thực 4 lớp bởi EduCareLink</span>
                </div>
                <div style={S.safetyPill}>
                  <span style={S.safetyPillText}>Tuyệt đối an toàn</span>
                </div>
              </div>

              <div style={S.trustItemsList}>
                {trustItems.map((item) => (
                  <div key={item.id} style={S.trustItemRow}>
                    <Icon name="checkmark-circle" size={17} color="#0E9F6E" style={{ marginTop: 1 }} />
                    <div style={{ flex: 1 }}>
                      <div style={S.trustItemTitle}>{item.title}</div>
                      <div style={S.trustItemDesc}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* INTRODUCTION & TEACHING PHILOSOPHY */}
            <div style={S.sectionCard}>
              <div style={S.sectionTitleRow}>
                <Icon name={ic("chatbox-ellipses")} size={17} color="#F26522" style={{ marginRight: 6 }} />
                <span style={S.sectionTitle}>Giới thiệu bản thân & Phương pháp đồng hành</span>
              </div>
              <div style={S.introText}>
                {candidate.bio ||
                  `Chào các bậc phụ huynh! Em là ${candidate.display_name}, hiện đang theo học tại ${candidate.school} (${candidate.major}). Với tinh thần trách nhiệm cao, lòng yêu thương trẻ nhỏ và sự kiên nhẫn, em luôn chú trọng phương pháp đồng hành gần gũi: vừa học vừa khơi gợi tư duy, lắng nghe tính cách từng bé để giúp con hình thành tính tự giác và niềm vui học tập mỗi ngày. Em luôn chủ động gửi báo cáo tiến độ và phản hồi cùng gia đình sau mỗi buổi!`}
              </div>
            </div>

            {/* SPECIALIZED SKILLS & SUBJECTS */}
            <div style={S.sectionCard}>
              <div style={S.sectionTitleRow}>
                <Icon name={ic("bulb-outline")} size={17} color="#F26522" style={{ marginRight: 6 }} />
                <span style={S.sectionTitle}>Kỹ năng & Chuyên môn thế mạnh</span>
              </div>

              {/* Chuyên môn giảng dạy động theo candidate.top_skills */}
              <div style={S.categorySubLabel}>CHUYÊN MÔN NỔI BẬT</div>
              <div style={S.chipsWrap}>
                {candidate.top_skills.map((skill: string, idx: number) => (
                  <div key={idx} style={S.orangeChip}>
                    <Icon name={ic(getSkillIcon(skill))} size={13} color="#EA580C" style={{ marginRight: 4 }} />
                    <span style={S.orangeChipText}>{skill}</span>
                  </div>
                ))}
              </div>

              {/* Kỹ năng mềm & Thái độ */}
              <div style={{ ...S.categorySubLabel, marginTop: 12 }}>KỸ NĂNG CHĂM SÓC & THÁI ĐỘ</div>
              <div style={S.chipsWrap}>
                <div style={S.grayChip}>
                  <Icon name="heart" size={13} color="#E11D48" style={{ marginRight: 4 }} />
                  <span style={S.grayChipText}>Kiên nhẫn với trẻ</span>
                </div>
                <div style={S.grayChip}>
                  <Icon name={ic("bulb")} size={13} color="#2563EB" style={{ marginRight: 4 }} />
                  <span style={S.grayChipText}>Phương pháp gợi mở</span>
                </div>
                <div style={S.grayChip}>
                  <Icon name={ic("bicycle")} size={13} color="#059669" style={{ marginRight: 4 }} />
                  <span style={S.grayChipText}>Có xe máy riêng</span>
                </div>
                <div style={S.grayChip}>
                  <Icon name="time" size={13} color="#D97706" style={{ marginRight: 4 }} />
                  <span style={S.grayChipText}>Luôn đúng giờ</span>
                </div>
              </div>
            </div>

            {/* CERTIFICATES & HONORS CAROUSEL */}
            <div style={S.sectionCard}>
              <div style={S.sectionHeaderBetween}>
                <div style={S.sectionTitleRow}>
                  <Icon name={ic("ribbon-outline")} size={17} color="#2563EB" style={{ marginRight: 6 }} />
                  <span style={S.sectionTitle}>Minh chứng bằng cấp & Giải thưởng</span>
                </div>
                <span style={S.countHint}>{certificates.length} chứng chỉ</span>
              </div>

              <div className="edc-scroll" style={S.certificatesScroll}>
                {certificates.map((cert) => (
                  <div key={cert.id} style={S.certCard}>
                    <div style={S.certCardTop}>
                      <Icon
                        name={ic(cert.icon)}
                        size={20}
                        color={
                          cert.badgeColor === "green" ? "#059669" : cert.badgeColor === "amber" ? "#D97706" : "#2563EB"
                        }
                      />
                      <div
                        style={
                          cert.badgeColor === "green"
                            ? S.certBadgeGreen
                            : cert.badgeColor === "amber"
                            ? S.certBadgeAmber
                            : S.certBadgeBlue
                        }
                      >
                        <span
                          style={
                            cert.badgeColor === "green"
                              ? S.certBadgeGreenText
                              : cert.badgeColor === "amber"
                              ? S.certBadgeAmberText
                              : S.certBadgeBlueText
                          }
                        >
                          {cert.badgeText}
                        </span>
                      </div>
                    </div>
                    <div style={{ ...S.certTitle, ...clampLine(2) }}>{cert.title}</div>
                    <div style={{ ...S.certDesc, ...clampLine(2) }}>{cert.desc}</div>
                    <div style={{ ...S.certFooter, ...clampLine(1) }}>{cert.footer}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* VERIFIED PARENT REVIEWS & RATINGS */}
            <div style={S.sectionCard}>
              <div style={S.sectionHeaderBetween}>
                <div style={S.sectionTitleRow}>
                  <Icon name="chatbubbles-outline" size={17} color="#F59E0B" style={{ marginRight: 6 }} />
                  <span style={S.sectionTitle}>Đánh giá thực tế từ phụ huynh</span>
                </div>
                <div style={S.ratingScoreBox}>
                  <Icon name="star" size={13} color="#F59E0B" style={{ marginRight: 3 }} />
                  <span style={S.ratingScoreBold}>{candidate.rating}</span>
                  <span style={S.ratingCountSmall}>
                    ({candidate.completed_jobs > 0 ? `${candidate.completed_jobs} ca` : "Đã duyệt"})
                  </span>
                </div>
              </div>

              <div style={S.reviewsList}>
                {reviews.map((rev) => (
                  <div key={rev.id} style={S.reviewCard}>
                    <div style={S.reviewHeader}>
                      <div style={S.reviewAuthorWrap}>
                        <div style={{ ...S.reviewAvatar, backgroundColor: rev.avatarBg }}>
                          <span style={{ ...S.reviewAvatarText, color: rev.avatarColor }}>{rev.avatarLetter}</span>
                        </div>
                        <div>
                          <div style={S.reviewAuthorName}>{rev.authorName}</div>
                          <div style={S.reviewAuthorSub}>{rev.authorSub}</div>
                        </div>
                      </div>
                      <div style={S.starsRow}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Icon key={i} name="star" size={12} color="#F59E0B" />
                        ))}
                      </div>
                    </div>
                    <div style={S.reviewQuoteText}>"{rev.content}"</div>
                    <div style={S.reviewMetaTime}>{rev.timeAgo}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ESCROW & SATISFACTION COMMITMENT CARD */}
            <div style={S.escrowCard}>
              <Icon name="shield-checkmark" size={22} color="#2563EB" style={{ marginTop: 2, marginRight: 10 }} />
              <div style={{ flex: 1 }}>
                <div style={S.escrowCardTitle}>Bảo hộ Ký quỹ an toàn EduCareLink</div>
                <div style={S.escrowCardDesc}>
                  Khoản tiền ca học được giữ an toàn tại ví Escrow. Chỉ giải ngân cho CarePartner sau khi ca học
                  kết thúc hài lòng. Nếu bạn không ưng ý hoặc sinh viên hủy ca, hệ thống bồi hoàn 100% cọc ngay
                  lập tức.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 3. STICKY BOTTOM ACTION DOCK — fixed trên TabBar web (84px)  */}
        {/* ============================================================ */}
        <div style={{ ...S.bottomDock, bottom: TAB_BAR_HEIGHT }}>
          <div style={S.dockPriceCol}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "baseline", gap: 2 }}>
              <span style={S.dockRateMain}>{hourlyRate.toLocaleString("vi-VN")}đ</span>
              <span style={S.dockRateSuffix}>/giờ</span>
            </div>
            <div style={S.dockSessionText}>
              Ca 2h: <span style={{ fontWeight: 800, color: "#0F172A" }}>{estimatedSession.toLocaleString("vi-VN")}đ</span>
            </div>
            <div style={S.dockLockRow}>
              <Icon name={ic("lock-closed")} size={11} color="#059669" />
              <span style={S.dockLockText}>Ký quỹ an toàn</span>
            </div>
          </div>

          <Touchable
            style={{ ...S.dockCtaBtn, ...(selecting ? { opacity: 0.7 } : null) }}
            disabled={selecting}
            activeOpacity={0.88}
            onPress={() => setConfirmVisible(true)}
          >
            {selecting ? (
              <Spinner size={20} color="#FFFFFF" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <span style={S.dockCtaTitle}>Chọn CarePartner này</span>
                  <Icon name="arrow-forward" size={16} color="#FFFFFF" />
                </div>
                <span style={S.dockCtaSub}>Giữ lịch & ghép cặp ngay</span>
              </div>
            )}
          </Touchable>
        </div>

        {/* ============================================================ */}
        {/* 4. INSTANT CONFIRMATION BOOKING MODAL (STITCH SPEC)          */}
        {/* ============================================================ */}
        {confirmVisible && (
          <div style={S.modalOverlay}>
            <div style={{ ...S.modalSheet, paddingBottom: 20 /* RN: max(insets.bottom≈20, 20) */ }}>
              <div style={S.modalDragHandle} />

              <div style={S.modalHeaderRow}>
                <div>
                  <div style={S.modalPreTitle}>Xác nhận chọn CarePartner</div>
                  <div style={S.modalMainTitle}>Ghép cặp với {candidate.display_name}</div>
                </div>
                <Touchable style={S.modalCloseBtn} onPress={() => setConfirmVisible(false)} hitSlop={8}>
                  <Icon name="close" size={18} color="#64748B" />
                </Touchable>
              </div>

              {/* Summary Box */}
              <div style={S.modalSummaryBox}>
                <div style={S.summaryRow}>
                  <span style={S.summaryLabel}>Ca học đã chọn:</span>
                  <span style={S.summaryValue}>{job.title}</span>
                </div>
                <div style={S.summaryRow}>
                  <span style={S.summaryLabel}>Lịch học:</span>
                  <span style={S.summaryValue}>{job.schedule}</span>
                </div>
                <div style={S.summaryRow}>
                  <span style={S.summaryLabel}>Địa chỉ kèm học:</span>
                  <span style={S.summaryValue}>{job.location_note}</span>
                </div>
                <div style={{ ...S.summaryRow, ...S.summaryBorderTop }}>
                  <span style={S.summaryTotalLabel}>Khoản cọc giữ lịch:</span>
                  <span style={S.summaryTotalValue}>{estimatedSession.toLocaleString("vi-VN")}đ</span>
                </div>
              </div>

              {/* Escrow Reassurance */}
              <div style={S.modalEscrowBox}>
                <Icon name="shield-checkmark" size={16} color="#059669" style={{ marginRight: 6, marginTop: 1 }} />
                <span style={S.modalEscrowText}>
                  Tiền cọc được giữ an toàn qua MoMo / VietQR Escrow, chỉ giải ngân sau khi bạn ký nhận ca học hài
                  lòng.
                </span>
              </div>

              {/* Modal Actions */}
              <div style={S.modalButtonsRow}>
                <Touchable style={S.modalCancelBtn} activeOpacity={0.8} onPress={() => setConfirmVisible(false)}>
                  <span style={S.modalCancelText}>Xem thêm</span>
                </Touchable>

                <Touchable style={S.modalConfirmBtn} onPress={doSelect} activeOpacity={0.88}>
                  <span style={S.modalConfirmText}>Xác nhận & Giữ chỗ</span>
                  <Icon name="checkmark" size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
                </Touchable>
              </div>
            </div>
          </div>
        )}
      </div>
    </Screen>
  );
};

/** numberOfLines(n) của RN → web clamp 1/2 dòng */
const clampLine = (n: number): React.CSSProperties =>
  n === 1
    ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }
    : {
        display: "-webkit-box",
        WebkitLineClamp: n,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      };

// ============================================================
// STYLESHEET — port 1:1 StyleSheet.create của RN (dòng 910-1752)
// ============================================================
const S: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  // 1. TOP APP BAR
  topBar: {
    backgroundColor: "#FFFFFF",
    padding: "0 16px 10px",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #F1F5F9",
    boxShadow: SHADOWS.small,
    zIndex: 10,
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    border: "1px solid #E2E8F0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: SHADOWS.small,
    flexShrink: 0,
  },
  topBarCenter: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minWidth: 0,
  },
  verifiedTitleRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#0F172A",
  },
  verifiedPillSmall: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    border: "1px solid #A7F3D0",
    padding: "1.5px 6px",
    borderRadius: 999,
    gap: 3,
  },
  verifiedPillSmallText: {
    fontSize: 9.5,
    fontWeight: 700,
    color: "#0E9F6E",
  },
  topBarSub: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: 500,
    marginTop: 2,
  },
  topBarActions: {
    display: "flex",
    flexDirection: "row",
    gap: 8,
  },

  // 2. SCROLL CONTENT
  scrollContent: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: "12px 16px 130px",
  },

  // HERO CARD
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    border: "1px solid #E2E8F0",
    overflow: "hidden",
    boxShadow: SHADOWS.small,
  },
  heroBanner: {
    height: 60,
    backgroundColor: "#FFF7ED",
    borderBottom: "1px solid #FFEDD5",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 14px",
  },
  bannerBadgeLeft: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minWidth: 0,
  },
  bannerBadgeLeftText: {
    fontSize: 12,
    fontWeight: 700,
    color: "#9A3412",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  bannerBadgeRight: {
    backgroundColor: "rgba(255,255,255,0.85)",
    padding: "3px 8px",
    borderRadius: 999,
    border: "1px solid #FED7AA",
    flexShrink: 0,
  },
  bannerBadgeRightText: {
    fontSize: 10.5,
    fontWeight: 600,
    color: "#C2410C",
    whiteSpace: "nowrap",
  },
  heroBody: {
    padding: "0 14px 16px",
  },
  avatarRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: -32,
    marginBottom: 10,
  },
  avatarWrapper: {
    width: 84,
    height: 84,
    borderRadius: 22,
    border: "3px solid #FFFFFF",
    backgroundColor: "#FFF4ED",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: SHADOWS.medium,
    position: "relative",
    overflow: "hidden",
    flexShrink: 0,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    objectFit: "cover", // RN Image resizeMode default cover
  },
  avatarInner: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialText: {
    fontSize: 34,
    fontWeight: 900,
    color: "#FFFFFF",
  },
  avatarCheckBadge: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#0E9F6E",
    border: "2px solid #FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
  },
  eloBadge: {
    backgroundColor: "#F26522",
    padding: "6px 12px",
    borderRadius: 14,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    boxShadow: SHADOWS.small,
  },
  eloBadgeHeader: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  eloBadgeHeaderText: {
    fontSize: 10,
    fontWeight: 700,
    color: "#FFEDD5",
  },
  eloScoreRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  eloScoreNum: {
    fontSize: 18,
    fontWeight: 900,
    color: "#FFFFFF",
  },
  eloScoreSuffix: {
    fontSize: 10,
    fontWeight: 600,
    color: "#FFEDD5",
  },

  nameSection: {
    marginTop: 4,
  },
  nameRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  candidateName: {
    fontSize: 20,
    fontWeight: 800,
    color: "#0F172A",
  },
  genderAgePill: {
    backgroundColor: "#F1F5F9",
    padding: "2px 8px",
    borderRadius: 6,
  },
  genderAgeText: {
    fontSize: 11,
    fontWeight: 600,
    color: "#475569",
  },
  schoolRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    flexWrap: "wrap",
  },
  schoolTextBold: {
    fontSize: 13,
    fontWeight: 700,
    color: "#1E293B",
  },
  dotDivider: {
    margin: "0 5px",
    color: "#CBD5E1",
    fontWeight: 800,
  },
  majorText: {
    fontSize: 12.5,
    color: "#475569",
    fontWeight: 500,
  },
  quickTagsWrap: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px solid #F1F5F9",
  },
  quickTagOrange: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    border: "1px solid #FED7AA",
    padding: "4.5px 9px",
    borderRadius: 8,
  },
  quickTagOrangeText: {
    fontSize: 11.5,
    fontWeight: 700,
    color: "#C2410C",
  },
  quickTagGreen: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    border: "1px solid #A7F3D0",
    padding: "4.5px 9px",
    borderRadius: 8,
  },
  quickTagGreenText: {
    fontSize: 11.5,
    fontWeight: 700,
    color: "#065F46",
  },

  // BENTO GRID
  bentoGrid: {
    display: "flex",
    flexDirection: "row",
    gap: 8,
  },
  bentoCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    border: "1px solid #E2E8F0",
    padding: "10px 4px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    boxShadow: SHADOWS.small,
  },
  bentoValue: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0F172A",
    marginTop: 4,
  },
  bentoSubValue: {
    fontSize: 10,
    fontWeight: 500,
    color: "#94A3B8",
  },
  bentoLabel: {
    fontSize: 9.5,
    fontWeight: 600,
    color: "#64748B",
    marginTop: 2,
  },

  // TRUST SHIELD CARD
  trustShieldCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: 18,
    border: "1px solid #BBF7D0",
    padding: 14,
    boxShadow: SHADOWS.small,
  },
  trustShieldHeader: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  trustShieldTitleWrap: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  shieldIconBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "#0E9F6E",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  trustShieldTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#065F46",
  },
  safetyPill: {
    backgroundColor: "#FFFFFF",
    padding: "2.5px 8px",
    borderRadius: 999,
    border: "1px solid #86EFAC",
    flexShrink: 0,
  },
  safetyPillText: {
    fontSize: 10,
    fontWeight: 700,
    color: "#059669",
    whiteSpace: "nowrap",
  },
  trustItemsList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  trustItemRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  trustItemTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#0F172A",
  },
  trustItemDesc: {
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 1,
  },

  // COMMON SECTION CARD
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    border: "1px solid #E2E8F0",
    padding: 14,
    boxShadow: SHADOWS.small,
  },
  sectionTitleRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: 800,
    color: "#0F172A",
  },
  sectionHeaderBetween: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  countHint: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: 500,
    flexShrink: 0,
    marginLeft: 8,
  },
  introText: {
    fontSize: 12.5,
    color: "#475569",
    lineHeight: "19px",
    marginTop: 8,
  },

  // CHIPS
  categorySubLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: "#94A3B8",
    letterSpacing: "0.5px",
    marginTop: 10,
    marginBottom: 6,
  },
  chipsWrap: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  orangeChip: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    border: "1px solid #FED7AA",
    padding: "5px 9px",
    borderRadius: 8,
  },
  orangeChipText: {
    fontSize: 11.5,
    fontWeight: 600,
    color: "#9A3412",
  },
  grayChip: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    border: "1px solid #E2E8F0",
    padding: "5px 9px",
    borderRadius: 8,
  },
  grayChipText: {
    fontSize: 11.5,
    fontWeight: 600,
    color: "#334155",
  },

  // CERTIFICATES CAROUSEL (RN horizontal ScrollView → overflow-x)
  certificatesScroll: {
    display: "flex",
    flexDirection: "row",
    gap: 10,
    overflowX: "auto",
  },
  certCard: {
    width: 180,
    flexShrink: 0,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    border: "1px solid #E2E8F0",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  certCardTop: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  certBadgeBlue: {
    backgroundColor: "#DBEAFE",
    padding: "2px 6px",
    borderRadius: 4,
  },
  certBadgeBlueText: {
    fontSize: 9.5,
    fontWeight: 800,
    color: "#1D4ED8",
  },
  certBadgeGreen: {
    backgroundColor: "#DCFCE7",
    padding: "2px 6px",
    borderRadius: 4,
  },
  certBadgeGreenText: {
    fontSize: 9.5,
    fontWeight: 800,
    color: "#15803D",
  },
  certBadgeAmber: {
    backgroundColor: "#FEF3C7",
    padding: "2px 6px",
    borderRadius: 4,
  },
  certBadgeAmberText: {
    fontSize: 9.5,
    fontWeight: 800,
    color: "#B45309",
  },
  certTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: "#0F172A",
    lineHeight: "16px",
  },
  certDesc: {
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 4,
  },
  certFooter: {
    fontSize: 9.5,
    color: "#94A3B8",
    marginTop: 8,
  },

  // REVIEWS
  ratingScoreBox: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
  ratingScoreBold: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0F172A",
  },
  ratingCountSmall: {
    fontSize: 11,
    color: "#64748B",
    marginLeft: 3,
  },
  reviewsList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  reviewCard: {
    borderTop: "1px solid #F1F5F9",
    paddingTop: 10,
  },
  reviewHeader: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewAuthorWrap: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  reviewAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  reviewAvatarText: {
    fontSize: 12,
    fontWeight: 800,
  },
  reviewAuthorName: {
    fontSize: 12,
    fontWeight: 700,
    color: "#0F172A",
  },
  reviewAuthorSub: {
    fontSize: 10,
    color: "#94A3B8",
  },
  starsRow: {
    display: "flex",
    flexDirection: "row",
    gap: 1,
    flexShrink: 0,
  },
  reviewQuoteText: {
    fontSize: 11.5,
    color: "#475569",
    fontStyle: "italic",
    lineHeight: "16px",
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  reviewMetaTime: {
    fontSize: 10,
    color: "#94A3B8",
    textAlign: "right",
    marginTop: 4,
  },

  // ESCROW CARD
  escrowCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 18,
    border: "1px solid #BFDBFE",
    padding: 14,
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    boxShadow: SHADOWS.small,
  },
  escrowCardTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#1E40AF",
    marginBottom: 3,
  },
  escrowCardDesc: {
    fontSize: 11.5,
    color: "#334155",
    lineHeight: "17px",
  },

  // 3. STICKY BOTTOM DOCK — web: fixed phía trên TabBar (RN absolute bottom 0 phía sau tab bar native)
  bottomDock: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTop: "1px solid #E2E8F0",
    padding: "10px 16px 20px",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    boxShadow: SHADOWS.large,
    zIndex: 90, // dưới TabBar (100) như RN tab bar đè lên dock
  },
  dockPriceCol: {
    flexShrink: 0, // RN shrink: 0
  },
  dockRateMain: {
    fontSize: 18,
    fontWeight: 900,
    color: "#F26522",
  },
  dockRateSuffix: {
    fontSize: 11,
    fontWeight: 600,
    color: "#64748B",
  },
  dockSessionText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  dockLockRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  dockLockText: {
    fontSize: 10,
    fontWeight: 700,
    color: "#059669",
  },
  dockCtaBtn: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#F26522",
    padding: "10px 14px",
    borderRadius: 14,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: SHADOWS.medium,
  },
  dockCtaTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#FFFFFF",
    whiteSpace: "nowrap",
  },
  dockCtaSub: {
    fontSize: 10,
    color: "#FFEDD5",
    marginTop: 1,
    whiteSpace: "nowrap",
  },

  // 4. MODAL CONFIRMATION (RN Modal → fixed overlay bottom sheet)
  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 300,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: "12px 20px 20px",
    boxShadow: SHADOWS.large,
    animation: "edc-fade-in-up 0.2s ease-out",
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalHeaderRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalPreTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#EA580C",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  modalMainTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: "#0F172A",
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  modalSummaryBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    border: "1px solid #E2E8F0",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  summaryRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748B",
    flexShrink: 0,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: 700,
    color: "#1E293B",
    textAlign: "right",
  },
  summaryBorderTop: {
    borderTop: "1px solid #E2E8F0",
    paddingTop: 8,
    marginTop: 2,
  },
  summaryTotalLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0F172A",
  },
  summaryTotalValue: {
    fontSize: 16,
    fontWeight: 900,
    color: "#F26522",
  },
  modalEscrowBox: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ECFDF5",
    border: "1px solid #A7F3D0",
    padding: 10,
    borderRadius: 12,
    margin: "14px 0",
  },
  modalEscrowText: {
    fontSize: 11.5,
    color: "#065F46",
    lineHeight: "16px",
    flex: 1,
  },
  modalButtonsRow: {
    display: "flex",
    flexDirection: "row",
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    padding: "13px 0",
    borderRadius: 12,
    border: "1px solid #CBD5E1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: 700,
    color: "#475569",
  },
  modalConfirmBtn: {
    flex: 2,
    display: "flex",
    flexDirection: "row",
    backgroundColor: "#F26522",
    padding: "13px 0",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: SHADOWS.small,
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: 800,
    color: "#FFFFFF",
  },
};

export default CandidateProfileV2Screen;
