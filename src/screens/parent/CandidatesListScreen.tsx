/**
 * CandidatesListScreen — port CHÍNH XÁC mobile/src/screens/Parent/CandidatesListScreen.js (1877 dòng).
 * Thiết kế Google Stitch AI: "Danh sách ứng viên CarePartner tuyển chọn - EduCareLink".
 * Thứ tự khối giữ nguyên RN:
 *  1. Top App Bar: nút Quay lại + Pill "EduCareLink Guarantee" (+ nút refresh thay RefreshControl)
 *  2. Job Context Capsule (category badge, học phí/giờ, tiêu đề, lịch học & địa chỉ)
 *  3. Algorithm Live Status: radar xanh ngọc pulsing (CSS edc-pulse thay Animated.loop)
 *  4. Filter & Sort Pills: Điểm phù hợp nhất / Gần nhà nhất / Đánh giá cao nhất / Chỉ xem Nữ
 *  5. #1 Spotlight Hero Card: ribbon "GỢI Ý HÀNG ĐẦU · xx/100 ĐIỂM", verified badge,
 *     quote phụ huynh, CTA "Chọn CarePartner này" → modal xác nhận → selectCarePartner
 *  6. Standard Cards #2-#8: rank badge, điểm cam đậm, tags kỹ năng, nút Xem hồ sơ & Chọn bạn này
 *  7. Safety Guarantee Box
 *  8. Confirmation Modal (bottom sheet) — Idempotency-Key qua api/matching.ts
 *  9. Empty states (thật + do bộ lọc) — nguyên văn RN; error state RN không render riêng
 *     (set candidates=[] → rơi vào empty) — port y nguyên.
 * Dữ liệu: getMatchingCandidates(jobId) POST /matching/candidates/ (zalo client trả data trực tiếp,
 * không qua { data } như axios RN). Params: { jobId, job?, candidates?, totalMatched? }.
 * Khác biệt platform: RefreshControl → nút refresh trên app bar; Modal → overlay fixed zIndex 300;
 * Alert.alert 1 nút có onPress → window.confirm; icon female/search-outline/options-outline/
 * filter-outline/lock-closed thiếu glyph → alias cục bộ ic().
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, showAlert, StatusBarSpacer, Screen } from "@/components/ui";
import { SHADOWS } from "@/theme";
import { useNav } from "@/navigation/router";
import { getMatchingCandidates, selectCarePartner } from "@/api/matching";

/** Icon thiếu glyph trong ionicons.ts (159 glyph) → glyph Ionicons gần nhất cùng nghĩa */
const ic = (name: string) =>
  (
    {
      female: "person", // biểu tượng giới tính — không có trong bộ glyph
      "search-outline": "search",
      "options-outline": "settings-outline",
      "filter-outline": "list-outline",
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

// Dữ liệu mẫu khi chưa có job_id cụ thể — nguyên bản RN dòng 54-61
const DEMO_JOB = {
  title: "Gia sư Toán & Tiếng Anh kèm bé lớp 4",
  category_label: "Gia sư & Kèm học 1:1",
  category_icon: "school",
  hourly_rate_vnd: 120000,
  schedule: "18:00 - 20:00 (Thứ 2, 4, 6)",
  location_note: "Cách bạn 1.2 km (TP. Huế)",
};

// Dữ liệu mẫu 8 ứng viên — nguyên bản RN dòng 63-192
const DEMO_CANDIDATES = [
  {
    carepartner_id: "cp-8824",
    display_name: "Nguyễn Thu Hà",
    gender: "female",
    school: "ĐH Sư Phạm - Đại học Huế",
    major: "Sư phạm Giáo dục Tiểu học",
    match_level: "very_high",
    match_level_vi: "Rất phù hợp",
    match_score: 96,
    rating: 4.95,
    completed_jobs: 48,
    distance_km: 1.2,
    top_skills: ["Luyện chữ đẹp", "Tiểu học", "Kiên nhẫn", "Sư phạm"],
    latest_review:
      "Cô giáo dạy luyện chữ cực kỳ kiên nhẫn và ân cần. Sau 10 buổi nét chữ bé tiến bộ vượt bậc, tròn và đều tăm tắp!",
    response_tag: "Phản hồi < 5 phút",
  },
  {
    carepartner_id: "cp-7102",
    display_name: "Đỗ Hoàng Ngân",
    gender: "female",
    school: "ĐH Sư Phạm - Đại học Huế",
    major: "Giáo dục Mầm non",
    match_level: "very_high",
    match_level_vi: "Rất phù hợp",
    match_score: 95,
    rating: 5.0,
    completed_jobs: 38,
    distance_km: 1.4,
    top_skills: ["Đồng hành cùng trẻ", "Mầm non", "Montessori", "Sơ cấp cứu"],
    latest_review:
      "Cô Ngân trông bé rất khéo và chu đáo, bé quấn cô như người nhà. Gia đình hoàn toàn yên tâm gửi gắm.",
    response_tag: "Phản hồi < 3 phút",
  },
  {
    carepartner_id: "cp-6531",
    display_name: "Lê Thảo Vy",
    gender: "female",
    school: "ĐH Sư Phạm - Đại học Huế",
    major: "Sư phạm Ngữ Văn & Tiểu học",
    match_level: "very_high",
    match_level_vi: "Rất phù hợp",
    match_score: 93,
    rating: 4.9,
    completed_jobs: 35,
    distance_km: 1.8,
    top_skills: ["Luyện chữ đẹp", "Ngữ văn", "Rèn chữ", "Kiên nhẫn"],
    latest_review: "Phương pháp rèn chữ chuẩn nét thanh nét đậm, tư thế ngồi và cách cầm bút chuẩn y khoa.",
    response_tag: "Phản hồi < 5 phút",
  },
  {
    carepartner_id: "cp-5420",
    display_name: "Nguyễn Hữu Phước",
    gender: "male",
    school: "ĐH Y Dược - Đại học Huế",
    major: "Bác sĩ Đa khoa (Năm 4)",
    match_level: "high",
    match_level_vi: "Phù hợp cao",
    match_score: 91,
    rating: 4.9,
    completed_jobs: 34,
    distance_km: 1.5,
    top_skills: ["Đón trẻ", "Sơ cấp cứu", "Lái xe an toàn", "Đúng giờ"],
    latest_review: "Đón bé luôn đúng giờ hẹn, lái xe cẩn thận, đội mũ bảo hiểm chỉnh tề cho con. Rất yên tâm!",
    response_tag: "Phản hồi < 5 phút",
  },
  {
    carepartner_id: "cp-4319",
    display_name: "Vũ Khánh An",
    gender: "female",
    school: "ĐH Y Dược - Đại học Huế",
    major: "Điều dưỡng Nhi khoa (Năm 4)",
    match_level: "high",
    match_level_vi: "Phù hợp cao",
    match_score: 90,
    rating: 4.95,
    completed_jobs: 31,
    distance_km: 2.2,
    top_skills: ["Chăm bé sơ sinh", "Sơ cấp cứu nhi", "Dỗ ăn", "Vệ sinh"],
    latest_review:
      "Có kiến thức y tế nên đồng hành cùng trẻ rất an tâm, xử lý các tình huống quấy sốt của bé rất chuyên nghiệp.",
    response_tag: "Phản hồi < 5 phút",
  },
  {
    carepartner_id: "cp-3208",
    display_name: "Trần Thị Minh Thư",
    gender: "female",
    school: "Đại học Kinh Tế - Đại học Huế",
    major: "Kinh tế Quốc tế (IELTS 8.0)",
    match_level: "high",
    match_level_vi: "Phù hợp cao",
    match_score: 89,
    rating: 5.0,
    completed_jobs: 32,
    distance_km: 1.6,
    top_skills: ["Tiếng Anh giao tiếp", "Phát âm chuẩn", "Dạy ngữ pháp"],
    latest_review: "Phát âm chuẩn bản xứ, phương pháp truyền đạt qua trò chơi bé rất thích.",
    response_tag: "Phản hồi < 3 phút",
  },
  {
    carepartner_id: "cp-2197",
    display_name: "Đỗ Đức Anh",
    gender: "male",
    school: "Đại học Ngoại Ngữ - Đại học Huế",
    major: "Kỹ thuật Giao thông",
    match_level: "medium",
    match_level_vi: "Phù hợp",
    match_score: 86,
    rating: 4.88,
    completed_jobs: 25,
    distance_km: 2.0,
    top_skills: ["Đón trẻ an toàn", "Thông thạo đường", "Cẩn thận"],
    latest_review: "Đức Anh rất nhiệt tình và chu đáo, luôn gọi điện báo khi đã đón được bé.",
    response_tag: "Phản hồi < 10 phút",
  },
  {
    carepartner_id: "cp-1086",
    display_name: "Lê Hoàng Nam",
    gender: "male",
    school: "Đại học Khoa học - Đại học Huế",
    major: "Khoa học Máy tính (Năm 4)",
    match_level: "medium",
    match_level_vi: "Phù hợp",
    match_score: 84,
    rating: 4.8,
    completed_jobs: 26,
    distance_km: 2.5,
    top_skills: ["Toán tư duy", "Toán nâng cao", "Lập trình Scratch"],
    latest_review: "Kèm toán tư duy rất bài bản, rèn thói quen tự giác làm bài cho con.",
    response_tag: "Phản hồi < 10 phút",
  },
];

interface Props {
  jobId?: string | number;
  job?: any;
  candidates?: any[];
  totalMatched?: number;
}

const CandidatesListScreen: React.FC<Props> = ({
  jobId,
  job: passedJob,
  candidates: passedCandidates,
  totalMatched: passedTotal,
}) => {
  const nav = useNav();

  const [jobInfo, setJobInfo] = useState<any>(passedJob || DEMO_JOB);
  const [candidates, setCandidates] = useState<any[]>(Array.isArray(passedCandidates) ? passedCandidates : []);
  const [totalMatched, setTotalMatched] = useState<number>(
    typeof passedTotal === "number" ? passedTotal : Array.isArray(passedCandidates) ? passedCandidates.length : 0
  );
  // Nếu đã nhận danh sách ứng viên được tải trước từ modal tìm kiếm -> loading = false ngay lập tức!
  const [loading, setLoading] = useState<boolean>(!!jobId && !Array.isArray(passedCandidates));
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Ghi nhớ cờ đã có dữ liệu prefetch để tránh load() đè spinner khi focus lần đầu
  const hasPrefetchedRef = useRef<boolean>(Array.isArray(passedCandidates));

  useEffect(() => {
    if (passedJob) setJobInfo(passedJob);
    if (Array.isArray(passedCandidates)) {
      setCandidates(passedCandidates);
      setTotalMatched(typeof passedTotal === "number" ? passedTotal : passedCandidates.length);
      setLoading(false);
      hasPrefetchedRef.current = true;
    }
  }, [passedCandidates, passedTotal, passedJob]);

  // Bộ lọc & Sắp xếp tương tác (Stitch Filter Pills)
  const [currentSort, setCurrentSort] = useState<string>("score"); // 'score' | 'distance' | 'rating'
  const [filterFemaleOnly, setFilterFemaleOnly] = useState<boolean>(false);

  // Modal xác nhận đặt lịch
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [submittingBooking, setSubmittingBooking] = useState<boolean>(false);

  /* Animation radar xanh ngọc pulsing — RN Animated.loop 800ms lên + 800ms xuống
     → CSS edc-pulse 1.6s ease-in-out infinite (keyframe chung app.css) */
  const radarPulseStyle: React.CSSProperties = {
    ...S.radarPulseRing,
    animation: "edc-pulse 1.6s ease-in-out infinite",
  };

  // Tải danh sách ứng viên — nguyên bản RN load() (zalo client trả data trực tiếp, không bọc { data })
  const load = async (isRefresh = false) => {
    if (!jobId) {
      setCandidates([]);
      setTotalMatched(0);
      setLoading(false);
      return;
    }

    // Nếu vừa nhận dữ liệu prefetch và không phải người dùng chủ động kéo refresh
    if (!isRefresh && hasPrefetchedRef.current) {
      hasPrefetchedRef.current = false;
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");
    try {
      const res: any = await getMatchingCandidates(String(jobId));
      if (res?.job) {
        setJobInfo((prev: any) => ({ ...prev, ...res.job }));
      }
      if (res?.candidates) {
        setCandidates(res.candidates);
        setTotalMatched(res.total_matched !== undefined ? res.total_matched : res.candidates.length);
      } else {
        setCandidates([]);
        setTotalMatched(0);
      }
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === "slot_taken") {
        setError("Đơn vừa được chọn bởi người khác. Vui lòng làm mới.");
      } else {
        setError("Không thể tải danh sách ứng viên lúc này.");
        setCandidates([]);
        setTotalMatched(0);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // RN useFocusEffect(() => load()) — web: gọi khi mount (mỗi lần quay lại màn là remount)
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Xử lý Lọc & Sắp xếp động — nguyên bản RN
  const displayedCandidates = useMemo(() => {
    let list = [...candidates];

    if (filterFemaleOnly) {
      list = list.filter(
        (c: any) =>
          c.gender === "female" ||
          (!c.gender &&
            (c.display_name?.includes("Thị") ||
              c.display_name?.includes("Hà") ||
              c.display_name?.includes("Thư") ||
              c.display_name?.includes("Linh") ||
              c.display_name?.includes("Trang") ||
              c.display_name?.includes("Chi")))
      );
    }

    if (currentSort === "score") {
      list.sort((a: any, b: any) => (b.match_score || 0) - (a.match_score || 0));
    } else if (currentSort === "distance") {
      list.sort((a: any, b: any) => (a.distance_km ?? 999) - (b.distance_km ?? 999));
    } else if (currentSort === "rating") {
      list.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
    }

    return list;
  }, [candidates, currentSort, filterFemaleOnly]);

  // Lấy chữ cái đầu làm avatar — nguyên bản RN
  const getInitial = (name: string) => {
    if (!name) return "C";
    const parts = name.trim().split(" ");
    return parts[parts.length - 1].charAt(0).toUpperCase();
  };

  // Mở modal xác nhận đặt lịch
  const promptBooking = (cand: any) => {
    setSelectedCandidate(cand);
    setModalVisible(true);
  };

  // Thực thi đặt lịch — nguyên bản RN handleConfirmBooking
  const handleConfirmBooking = async () => {
    if (!selectedCandidate) return;

    if (!jobId) {
      // Demo mode
      setModalVisible(false);
      const ok = window.confirm(
        "Thành công! 🎉\n\n" +
          `Bạn đã chọn ${selectedCandidate.display_name}. Hệ thống sẽ chuyển tiếp đến thông tin chi tiết của CarePartner.`
      );
      if (ok) {
        nav.navigate("CandidateProfileV2", {
          candidate: selectedCandidate,
          jobId: "demo-job-1",
          job: jobInfo,
        });
      }
      return;
    }

    setSubmittingBooking(true);
    try {
      const idempotencyKey = `select_${jobId}_${selectedCandidate.carepartner_id}_${Date.now()}`;
      await selectCarePartner(String(jobId), selectedCandidate.carepartner_id, idempotencyKey);
      setModalVisible(false);
      const ok = window.confirm(
        "Ghép cặp thành công! 🎉\n\n" +
          `Bạn đã chọn ${selectedCandidate.display_name}. Khoản ký quỹ đang được bảo vệ an toàn qua MoMo Escrow.`
      );
      if (ok) {
        nav.navigate("ParentHome"); // RN: ParentTabs { screen: 'ParentHome' }
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "Thao tác không thành công. Vui lòng thử lại.";
      showAlert("Thông báo", detail);
    } finally {
      setSubmittingBooking(false);
    }
  };

  // ============================================================
  // RENDER HERO CARD (#1 SPOTLIGHT - STITCH DESIGN) — RN dòng 408-536
  // ============================================================
  const renderHeroCard = (c: any) => {
    const initial = getInitial(c.display_name);
    const color = AVATAR_COLORS[0];
    const schoolMajor =
      [c.school, c.major].filter(Boolean).join(" · ") || "Sinh viên EduCareLink đã đối soát";
    const ratingStr = c.rating != null ? Number(c.rating).toFixed(1) : "5.0";
    const distanceStr = c.distance_km != null ? `${c.distance_km} km` : "1.2 km";
    const skills = c.top_skills && c.top_skills.length ? c.top_skills : ["Toán tiểu học", "Kiên nhẫn", "Giao tiếp tốt"];

    return (
      <div key={c.carepartner_id} style={S.heroCard}>
        {/* Crown & Match Score Ribbon */}
        <div style={S.heroRibbonRow}>
          <div style={S.heroRibbon}>
            <Icon name="trophy" size={14} color="#ffffff" style={{ marginRight: 4 }} />
            <span style={S.heroRibbonText}>GỢI Ý HÀNG ĐẦU · {c.match_score}/100 ĐIỂM</span>
          </div>
          <div style={S.verifiedCheckBadge}>
            <Icon name="shield-checkmark" size={14} color="#0E9F6E" style={{ marginRight: 3 }} />
            <span style={S.verifiedCheckText}>CCCD & Thẻ SV chuẩn</span>
          </div>
        </div>

        {/* Profile Info Main Row */}
        <Touchable
          style={S.heroProfileRow}
          activeOpacity={0.9}
          onPress={() =>
            nav.navigate("CandidateProfileV2", {
              candidate: c,
              jobId: jobId || "demo",
              job: jobInfo,
            })
          }
        >
          <div style={S.heroAvatarWrapper}>
            <div style={{ ...S.heroAvatar, backgroundColor: color }}>
              <span style={S.heroAvatarText}>{initial}</span>
            </div>
            <div style={S.heroAvatarBadge}>
              <Icon name="checkmark" size={11} color="#ffffff" />
            </div>
          </div>

          <div style={S.heroInfoCol}>
            <div style={S.heroNameRow}>
              <span style={{ ...S.heroName, ...clampLine(1) }}>{c.display_name}</span>
              <span style={S.cpIdText}>#CP-{String(c.carepartner_id ?? "").replace("cp-", "")}</span>
            </div>

            <div style={S.heroSchoolRow}>
              <Icon name="school" size={13} color="#2563EB" style={{ marginRight: 4 }} />
              <span style={{ ...S.heroSchoolText, ...clampLine(1) }}>{schoolMajor}</span>
            </div>

            {/* Metrics */}
            <div style={S.heroMetricsRow}>
              <div style={S.metricItem}>
                <Icon name="star" size={13} color="#F59E0B" />
                <span style={S.metricBold}>{ratingStr}</span>
                <span style={S.metricMuted}>({c.completed_jobs} đơn)</span>
              </div>

              <div style={S.metricItem}>
                <Icon name="location" size={13} color="#F26522" />
                <span style={S.metricText}>{distanceStr}</span>
              </div>

              <div style={S.metricItem}>
                <Icon name="checkmark-circle" size={13} color="#0E9F6E" />
                <span style={S.metricGreen}>100% rảnh lịch</span>
              </div>
            </div>
          </div>
        </Touchable>

        {/* Skills Chips */}
        <div style={S.skillsRow}>
          {skills.slice(0, 4).map((skill: string) => (
            <div key={skill} style={S.skillChipHero}>
              <span style={S.skillChipHeroText}>{skill}</span>
            </div>
          ))}
        </div>

        {/* Verified Review Quote */}
        <div style={S.heroReviewBox}>
          <Icon
            name="chatbubble-ellipses-outline"
            size={14}
            color="#F26522"
            style={{ marginRight: 6, marginTop: 2 }}
          />
          <div style={{ flex: 1 }}>
            <div style={S.heroReviewText}>
              "{c.latest_review || "Gia sư dạy rất có tâm, bé nhà mình tiến bộ vượt bậc sau 1 tháng."}"
            </div>
            <div style={S.heroReviewAuthor}>
              — Phụ huynh tại {c.location_district || c.school || "khu vực của bạn"}
            </div>
          </div>
        </div>

        {/* Action Button CTA */}
        <div style={S.heroActionRow}>
          <Touchable
            style={S.heroBtnSecondary}
            activeOpacity={0.8}
            onPress={() =>
              nav.navigate("CandidateProfileV2", {
                candidate: c,
                jobId: jobId || "demo",
                job: jobInfo,
              })
            }
          >
            <span style={S.heroBtnSecondaryText}>Xem hồ sơ</span>
          </Touchable>

          <Touchable style={S.heroBtnPrimary} activeOpacity={0.85} onPress={() => promptBooking(c)}>
            <span style={S.heroBtnPrimaryText}>Chọn CarePartner này</span>
            <Icon name="arrow-forward" size={16} color="#ffffff" />
          </Touchable>
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER STANDARD CARD (#2 - #8) — RN dòng 541-642
  // ============================================================
  const renderStandardCard = (c: any, index: number) => {
    const rank = index + 1;
    const initial = getInitial(c.display_name);
    const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
    const schoolMajor =
      [c.school, c.major].filter(Boolean).join(" · ") || "Sinh viên EduCareLink đã đối soát";
    const ratingStr = c.rating != null ? Number(c.rating).toFixed(1) : "5.0";
    const distanceStr = c.distance_km != null ? `${c.distance_km} km` : "2.0 km";
    const skills = c.top_skills && c.top_skills.length ? c.top_skills : ["Nhiệt tình", "Đúng giờ"];

    return (
      <div key={c.carepartner_id} style={S.standardCard}>
        <Touchable
          style={S.stdTopRow}
          activeOpacity={0.9}
          onPress={() =>
            nav.navigate("CandidateProfileV2", {
              candidate: c,
              jobId: jobId || "demo",
              job: jobInfo,
            })
          }
        >
          {/* Avatar with rank pill */}
          <div style={S.stdAvatarWrapper}>
            <div style={{ ...S.stdAvatar, backgroundColor: color }}>
              <span style={S.stdAvatarText}>{initial}</span>
            </div>
            <div style={S.rankBadge}>
              <span style={S.rankBadgeText}>#{rank}</span>
            </div>
          </div>

          {/* Middle Info */}
          <div style={S.stdInfoCol}>
            <div style={S.stdNameRow}>
              <span style={{ ...S.stdName, ...clampLine(1) }}>{c.display_name}</span>
              <div style={S.stdScoreCol}>
                <span style={S.stdScoreNum}>{c.match_score}</span>
                <span style={S.stdScoreUnit}>điểm</span>
              </div>
            </div>

            <div style={{ ...S.stdSchool, ...clampLine(1) }}>{schoolMajor}</div>

            <div style={S.stdMetricsRow}>
              <div style={S.metricItem}>
                <Icon name="star" size={12} color="#F59E0B" />
                <span style={S.metricBoldSmall}>{ratingStr}</span>
                <span style={S.metricMutedSmall}>({c.completed_jobs} đơn)</span>
              </div>
              <span style={S.metricDot}>·</span>
              <div style={S.metricItem}>
                <Icon name="location" size={12} color="#F26522" />
                <span style={S.metricMutedSmall}>{distanceStr}</span>
              </div>
              <span style={S.metricDot}>·</span>
              <span style={S.stdFastTag}>⚡ {c.response_tag || "Phản hồi nhanh"}</span>
            </div>
          </div>
        </Touchable>

        {/* Skills Chips */}
        <div style={S.stdSkillsRow}>
          {skills.slice(0, 3).map((skill: string) => (
            <div key={skill} style={S.skillChipStd}>
              <span style={S.skillChipStdText}>{skill}</span>
            </div>
          ))}
        </div>

        {/* Actions Footer */}
        <div style={S.stdFooterRow}>
          <Touchable
            style={S.stdBtnDetails}
            activeOpacity={0.8}
            onPress={() =>
              nav.navigate("CandidateProfileV2", {
                candidate: c,
                jobId: jobId || "demo",
                job: jobInfo,
              })
            }
          >
            <span style={S.stdBtnDetailsText}>Xem hồ sơ</span>
          </Touchable>

          <Touchable style={S.stdBtnSelect} activeOpacity={0.85} onPress={() => promptBooking(c)}>
            <span style={S.stdBtnSelectText}>Chọn bạn này</span>
            <Icon name="checkmark-circle" size={15} color="#F26522" style={{ marginLeft: 4 }} />
          </Touchable>
        </div>
      </div>
    );
  };

  // ============================================================
  // HEADER COMPONENT (STITCH CAPSULE + RADAR + PILLS) — RN dòng 647-823
  // ============================================================
  const listHeader = (
    <div style={S.listHeaderContainer}>
      {/* 1. JOB CONTEXT CAPSULE */}
      <div style={S.jobCapsule}>
        <div style={S.jobCapsuleStripe} />
        <div style={S.jobCapsuleTopRow}>
          <div style={S.categoryBadge}>
            <Icon
              name={ic(
                jobInfo.category_icon ||
                  (jobInfo.job_type === "childcare" ? "heart" : jobInfo.job_type === "pickup" ? "car" : "school")
              )}
              size={13}
              color="#EA580C"
              style={{ marginRight: 4 }}
            />
            <span style={S.categoryBadgeText}>
              {jobInfo.category_label ||
                (jobInfo.job_type === "childcare"
                  ? "CHĂM SÓC & ĐỒNG HÀNH CÙNG TRẺ"
                  : jobInfo.job_type === "pickup"
                  ? "ĐƯA ĐÓN TRẺ AN TOÀN"
                  : "GIA SƯ & KÈM HỌC 1:1")}
            </span>
          </div>
          <span style={S.hourlyFeeText}>
            {jobInfo.hourly_rate_vnd
              ? `${Number(jobInfo.hourly_rate_vnd).toLocaleString("vi-VN")}đ/giờ`
              : "120.000đ/giờ"}
          </span>
        </div>

        <div style={{ ...S.jobTitleText, ...clampLine(2) }}>
          {jobInfo.title ||
            (jobInfo.job_type === "childcare"
              ? "Chăm sóc & Đồng hành cùng trẻ tại nhà"
              : jobInfo.job_type === "pickup"
              ? "Đưa đón bé đi học an toàn"
              : "Gia sư kèm học 1:1")}
        </div>

        <div style={S.jobMetaList}>
          <div style={S.jobMetaRow}>
            <Icon name="calendar-outline" size={14} color="#64748B" style={{ marginRight: 6 }} />
            <span style={S.jobMetaText}>{jobInfo.schedule || "Lịch học linh hoạt"}</span>
          </div>
          <div style={S.jobMetaRow}>
            <Icon name="location-outline" size={14} color="#64748B" style={{ marginRight: 6 }} />
            <span style={S.jobMetaText}>{jobInfo.location_note || "Vị trí đã chọn trên bản đồ"}</span>
          </div>
        </div>
      </div>

      {/* 2. ALGORITHM LIVE STATUS (EMERALD RADAR PULSING) */}
      <div style={S.radarBanner}>
        <div style={S.radarLeftGroup}>
          <div style={S.radarDotWrapper}>
            <div style={radarPulseStyle} />
            <div style={S.radarCoreDot} />
          </div>
          <div style={{ flex: 1, marginLeft: 10 }}>
            <div style={S.radarTitleText}>
              {candidates.length > 0
                ? `Tuyển chọn ${displayedCandidates.length} CarePartner xuất sắc nhất`
                : "Đang mở rộng quét mạng lưới CarePartner..."}
            </div>
            <div style={S.radarSubtitleText}>
              {candidates.length > 0
                ? "Khớp chuyên môn · Ưu tiên gần nhà · Đã đối soát CCCD & Thẻ SV"
                : "Chưa có ứng viên khớp chuyên môn rảnh ca này. Đang phát tín hiệu tiếp tục."}
            </div>
          </div>
        </div>
        <Icon name="sparkles" size={20} color={candidates.length > 0 ? "#059669" : "#F59E0B"} />
      </div>

      {/* 3. FILTER & SORT PILLS (RN horizontal ScrollView → overflow-x) */}
      <div className="edc-scroll" style={S.filterPillsContainer}>
        <Touchable
          style={{ ...S.filterPill, ...(currentSort === "score" ? S.filterPillActive : null) }}
          activeOpacity={0.8}
          onPress={() => setCurrentSort("score")}
        >
          <Icon
            name="ribbon"
            size={14}
            color={currentSort === "score" ? "#ffffff" : "#64748B"}
            style={{ marginRight: 4 }}
          />
          <span
            style={{ ...S.filterPillText, ...(currentSort === "score" ? S.filterPillTextActive : null) }}
          >
            Điểm phù hợp nhất
          </span>
        </Touchable>

        <Touchable
          style={{ ...S.filterPill, ...(currentSort === "distance" ? S.filterPillActive : null) }}
          activeOpacity={0.8}
          onPress={() => setCurrentSort("distance")}
        >
          <Icon
            name="navigate"
            size={14}
            color={currentSort === "distance" ? "#ffffff" : "#64748B"}
            style={{ marginRight: 4 }}
          />
          <span
            style={{ ...S.filterPillText, ...(currentSort === "distance" ? S.filterPillTextActive : null) }}
          >
            Gần nhà nhất
          </span>
        </Touchable>

        <Touchable
          style={{ ...S.filterPill, ...(currentSort === "rating" ? S.filterPillActive : null) }}
          activeOpacity={0.8}
          onPress={() => setCurrentSort("rating")}
        >
          <Icon
            name="star"
            size={14}
            color={currentSort === "rating" ? "#ffffff" : "#64748B"}
            style={{ marginRight: 4 }}
          />
          <span
            style={{ ...S.filterPillText, ...(currentSort === "rating" ? S.filterPillTextActive : null) }}
          >
            Đánh giá cao nhất
          </span>
        </Touchable>

        <Touchable
          style={{ ...S.filterPill, ...(filterFemaleOnly ? S.filterPillActive : null) }}
          activeOpacity={0.8}
          onPress={() => setFilterFemaleOnly((prev) => !prev)}
        >
          <Icon
            name={ic("female")}
            size={14}
            color={filterFemaleOnly ? "#ffffff" : "#64748B"}
            style={{ marginRight: 4 }}
          />
          <span
            style={{ ...S.filterPillText, ...(filterFemaleOnly ? S.filterPillTextActive : null) }}
          >
            Chỉ xem Nữ {filterFemaleOnly ? "✓" : ""}
          </span>
        </Touchable>
      </div>
    </div>
  );

  // ============================================================
  // FOOTER COMPONENT (SAFETY GUARANTEE) — RN dòng 828-849
  // ============================================================
  const listFooter = (
    <div style={S.footerGuaranteeCard}>
      <div style={S.guaranteeHeaderRow}>
        <Icon name="shield-checkmark" size={20} color="#2563EB" style={{ marginRight: 8 }} />
        <span style={S.guaranteeTitle}>Cam kết bảo vệ phụ huynh EduCareLink</span>
      </div>
      <div style={S.guaranteeItem}>
        <Icon
          name="checkmark-circle"
          size={15}
          color="#059669"
          style={{ marginRight: 6, marginTop: 2 }}
        />
        <span style={S.guaranteeDesc}>
          <span style={{ fontWeight: 700, color: "#1E293B" }}>Ký quỹ an toàn MoMo Escrow: </span>
          Chỉ giải ngân cho CarePartner sau khi ca làm kết thúc và bạn xác nhận hài lòng.
        </span>
      </div>
      <div style={S.guaranteeItem}>
        <Icon
          name="checkmark-circle"
          size={15}
          color="#059669"
          style={{ marginRight: 6, marginTop: 2 }}
        />
        <span style={S.guaranteeDesc}>
          <span style={{ fontWeight: 700, color: "#1E293B" }}>Bảo hiểm đổi ứng viên 100%: </span>
          Miễn phí đổi bạn khác ngay lập tức nếu phát sinh trường hợp bất khả kháng.
        </span>
      </div>
    </div>
  );

  return (
    <Screen bg="#F8F9FB" scroll={false}>
      <StatusBarSpacer />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* 1. TOP APP BAR (STITCH HEADER) — RN dòng 856-872 */}
        <div style={S.topAppBar}>
          <Touchable style={S.appBarBackBtn} onPress={nav.goBack} hitSlop={12}>
            <Icon name="arrow-back" size={22} color="#1A1A2E" />
            <span style={S.backBtnText}>Quay lại</span>
          </Touchable>

          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* Web thay RefreshControl (pull-to-refresh RN) — nút refresh trên app bar (spec Zalo) */}
            <Touchable style={S.webRefreshBtn} activeOpacity={0.7} onPress={() => load(true)}>
              <Icon
                name="refresh"
                size={16}
                color="#64748B"
                style={refreshing ? { animation: "edc-spin 0.8s linear infinite" } : undefined}
              />
            </Touchable>
            <div style={S.topGuaranteePill}>
              <Icon name="shield-checkmark" size={14} color="#2563EB" style={{ marginRight: 4 }} />
              <span style={S.topGuaranteeText}>EduCareLink Guarantee</span>
            </div>
          </div>
        </div>

        {/* 2. BODY CONTENT — RN FlatList → scroll div giữ ListHeader/ListFooter/Empty */}
        {loading ? (
          <div style={S.loadingContainer}>
            <Spinner size={36} color="#F26522" />
            <div style={S.loadingTitle}>Thuật toán ELO đang xếp hạng ứng viên...</div>
            <div style={S.loadingSubtitle}>
              Đối soát lịch rảnh, cự ly GPS và kinh nghiệm giảng dạy thực tế
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
            <div style={S.listContent}>
              {listHeader}

              {displayedCandidates.map((item: any, index: number) => {
                // Render Card #1 với Hero Spotlight Layout
                if (index === 0 && currentSort === "score" && !filterFemaleOnly) {
                  return renderHeroCard(item);
                }
                // Render Cards #2 qua #8 với Standard Layout
                return renderStandardCard(item, index);
              })}

              {listFooter}

              {displayedCandidates.length === 0 &&
                (candidates.length === 0 ? (
                  <div style={S.emptyContainer} data-testid="truthful-empty-container">
                    <div style={S.emptyIconCircle}>
                      <Icon name={ic("search-outline")} size={38} color="#F26522" />
                    </div>
                    <div style={S.emptyTitle}>Chưa tìm thấy CarePartner phù hợp trong khu vực</div>
                    <div style={S.emptySubtitle}>
                      Thử điều chỉnh khung giờ, giảm tiêu chí hoặc mở rộng bán kính tìm kiếm quanh địa điểm đã
                      chọn.
                    </div>
                    <div style={S.emptyAdviceCard}>
                      <div style={S.emptyAdviceTitle}>💡 Gợi ý cho bạn:</div>
                      <div style={S.emptyAdviceText}>
                        • Nới rộng khung giờ hoặc chọn ngày khác để có thêm ứng viên rảnh lịch.
                      </div>
                      <div style={S.emptyAdviceText}>
                        • Hệ thống liên tục quét mạng lưới CarePartner đã đối soát CCCD & Thẻ SV quanh "
                        {jobInfo.location_note || "vị trí đã chọn"}".
                      </div>
                    </div>
                    {/* RN testID: empty-adjust-btn (Touchable web không nhận data-testid) */}
                    <Touchable style={S.resetFilterBtn} activeOpacity={0.85} onPress={nav.goBack}>
                      <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                        <Icon name={ic("options-outline")} size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <span style={S.resetFilterBtnText}>Điều chỉnh yêu cầu / Đổi khung giờ</span>
                      </div>
                    </Touchable>
                  </div>
                ) : (
                  <div style={S.emptyContainer}>
                    <Icon name={ic("filter-outline")} size={42} color="#94A3B8" />
                    <div style={S.emptyTitle}>Không có ứng viên khớp bộ lọc</div>
                    <div style={S.emptySubtitle}>
                      Có {candidates.length} ứng viên phù hợp kỹ năng nhưng chưa khớp tiêu chí lọc hiện tại.
                    </div>
                    <Touchable
                      style={S.resetFilterBtn}
                      activeOpacity={0.85}
                      onPress={() => {
                        setCurrentSort("score");
                        setFilterFemaleOnly(false);
                      }}
                    >
                      <span style={S.resetFilterBtnText}>Xem tất cả {candidates.length} ứng viên</span>
                    </Touchable>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 3. CONFIRMATION BOOKING MODAL (POPUP STITCH) — RN Modal → fixed overlay */}
      {/* ============================================================ */}
      {modalVisible && (
        <div style={S.modalOverlay}>
          <div style={S.modalContainer}>
            {/* Modal Header */}
            <div style={S.modalHeaderRow}>
              <span style={S.modalTitle}>Xác nhận ghép cặp CarePartner</span>
              <Touchable onPress={() => setModalVisible(false)} hitSlop={10}>
                <Icon name="close" size={22} color="#64748B" />
              </Touchable>
            </div>

            {/* Candidate Quick Card */}
            {selectedCandidate && (
              <div style={S.modalCandidateBox}>
                <div style={{ ...S.modalAvatar, backgroundColor: AVATAR_COLORS[0] }}>
                  <span style={S.modalAvatarText}>{getInitial(selectedCandidate.display_name)}</span>
                </div>
                <div style={S.modalCandidateInfo}>
                  <div style={{ ...S.modalCandidateName, ...clampLine(1) }}>
                    {selectedCandidate.display_name}
                  </div>
                  <div style={{ ...S.modalCandidateSchool, ...clampLine(1) }}>
                    {selectedCandidate.school || "Sinh viên EduCareLink đã đối soát"}
                  </div>
                  <div style={S.modalCandidateScore}>
                    Điểm phù hợp: {selectedCandidate.match_score}/100 · Cách{" "}
                    {selectedCandidate.distance_km || 1.2} km
                  </div>
                </div>
              </div>
            )}

            {/* Fee & Policy Breakdown */}
            <div style={S.modalDetailsBox}>
              <div style={S.modalDetailRow}>
                <span style={S.modalDetailLabel}>Học phí dự kiến:</span>
                <span style={S.modalDetailFee}>240.000đ (ca 2h)</span>
              </div>
              <div style={S.modalDetailRow}>
                <span style={S.modalDetailLabel}>Lịch làm việc:</span>
                <span style={S.modalDetailValue}>{jobInfo.schedule || ""}</span>
              </div>
              <div
                style={{
                  ...S.modalDetailRow,
                  borderTop: "1px solid #E2E8F0",
                  paddingTop: 8,
                  marginTop: 4,
                }}
              >
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                  <Icon name={ic("lock-closed")} size={13} color="#2563EB" style={{ marginRight: 4 }} />
                  <span style={S.modalDetailEscrow}>Ký quỹ tạm giữ:</span>
                </div>
                <span style={S.modalDetailEscrowBold}>MoMo Escrow Bảo Vệ</span>
              </div>
            </div>

            {/* Modal Buttons */}
            <div style={S.modalActionsRow}>
              <Touchable style={S.modalCancelBtn} activeOpacity={0.8} onPress={() => setModalVisible(false)}>
                <span style={S.modalCancelBtnText}>Xem bạn khác</span>
              </Touchable>

              <Touchable
                style={S.modalConfirmBtn}
                onPress={handleConfirmBooking}
                disabled={submittingBooking}
                activeOpacity={0.85}
              >
                {submittingBooking ? (
                  <Spinner size={20} color="#ffffff" />
                ) : (
                  <>
                    <span style={S.modalConfirmBtnText}>Xác nhận đặt lịch</span>
                    <Icon name="checkmark" size={16} color="#ffffff" style={{ marginLeft: 4 }} />
                  </>
                )}
              </Touchable>
            </div>
          </div>
        </div>
      )}
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
// STYLESHEET (WARM PROFESSIONALISM + GOOGLE STITCH SPEC)
// — port 1:1 StyleSheet.create của RN (dòng 1056-1877)
// ============================================================
const S: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    backgroundColor: "#F8F9FB", // Canvas Bg Stitch
  },

  // 1. TOP APP BAR
  topAppBar: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    padding: "12px 16px",
    borderBottom: "1px solid #E2E8F0",
  },
  appBarBackBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: 600,
    color: "#64748B",
  },
  topGuaranteePill: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid #BFDBFE",
  },
  topGuaranteeText: {
    fontSize: 11,
    fontWeight: 700,
    color: "#1D4ED8",
  },
  /** web-only: thay RefreshControl — circular 32px viền nhẹ */
  webRefreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    border: "1px solid #E2E8F0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  // 2. LIST CONTENT
  listContent: {
    padding: "12px 16px 40px",
  },
  listHeaderContainer: {
    marginBottom: 12,
  },

  // 3. JOB CONTEXT CAPSULE
  jobCapsule: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    border: "1px solid #E2E8F0",
    overflow: "hidden",
    position: "relative",
    boxShadow: SHADOWS.small,
  },
  jobCapsuleStripe: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
    backgroundColor: "#F26522",
  },
  jobCapsuleTopRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingLeft: 4,
  },
  categoryBadge: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    padding: "3px 8px",
    borderRadius: 6,
    border: "1px solid #FED7AA",
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: 800,
    color: "#EA580C",
    textTransform: "uppercase",
  },
  hourlyFeeText: {
    fontSize: 13,
    fontWeight: 800,
    color: "#F26522",
  },
  jobTitleText: {
    fontSize: 15,
    fontWeight: 800,
    color: "#1A1A2E",
    lineHeight: "21px",
    paddingLeft: 4,
    marginBottom: 8,
  },
  jobMetaList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    paddingLeft: 4,
  },
  jobMetaRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
  jobMetaText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: 500,
  },

  // 4. RADAR BANNER
  radarBanner: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ECFDF5",
    border: "1px solid #A7F3D0",
    borderRadius: 14,
    padding: "10px 12px",
    marginTop: 10,
  },
  radarLeftGroup: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 8,
  },
  radarDotWrapper: {
    width: 14,
    height: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  radarPulseRing: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#34D399",
    opacity: 0.6,
  },
  radarCoreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#059669",
  },
  radarTitleText: {
    fontSize: 12,
    fontWeight: 700,
    color: "#064E3B",
  },
  radarSubtitleText: {
    fontSize: 10,
    color: "#047857",
    marginTop: 1,
  },

  // 5. FILTER PILLS
  filterPillsContainer: {
    display: "flex",
    flexDirection: "row",
    gap: 8,
    padding: "10px 0",
    overflowX: "auto",
  },
  filterPill: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    border: "1px solid #E2E8F0",
    padding: "7px 12px",
    borderRadius: 999,
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
  filterPillActive: {
    backgroundColor: "#F26522",
    borderColor: "#F26522",
    boxShadow: SHADOWS.small,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: 600,
    color: "#64748B",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },

  // 6. HERO CARD (#1 SPOTLIGHT)
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    border: "2px solid #FED7AA",
    marginBottom: 14,
    boxShadow: SHADOWS.medium,
  },
  heroRibbonRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  heroRibbon: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D97706",
    padding: "4px 10px",
    borderRadius: 999,
  },
  heroRibbonText: {
    fontSize: 10.5,
    fontWeight: 800,
    color: "#FFFFFF",
    letterSpacing: "0.3px",
  },
  verifiedCheckBadge: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
  verifiedCheckText: {
    fontSize: 11,
    fontWeight: 700,
    color: "#0E9F6E",
  },
  heroProfileRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  heroAvatarWrapper: {
    position: "relative",
    marginRight: 12,
  },
  heroAvatar: {
    width: 58,
    height: 58,
    borderRadius: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: SHADOWS.small,
  },
  heroAvatarText: {
    fontSize: 24,
    fontWeight: 800,
    color: "#FFFFFF",
  },
  heroAvatarBadge: {
    position: "absolute",
    bottom: -3,
    right: -3,
    backgroundColor: "#0E9F6E",
    width: 18,
    height: 18,
    borderRadius: 9,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid #FFFFFF",
    boxSizing: "border-box",
  },
  heroInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  heroNameRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroName: {
    fontSize: 16,
    fontWeight: 800,
    color: "#1A1A2E",
    flex: 1,
  },
  cpIdText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: 600,
    flexShrink: 0,
    marginLeft: 6,
  },
  heroSchoolRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  heroSchoolText: {
    fontSize: 12,
    fontWeight: 600,
    color: "#2563EB",
    flex: 1,
  },
  heroMetricsRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
    flexWrap: "wrap",
  },
  metricItem: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metricBold: {
    fontSize: 12,
    fontWeight: 800,
    color: "#D97706",
  },
  metricMuted: {
    fontSize: 11,
    color: "#64748B",
  },
  metricText: {
    fontSize: 11.5,
    fontWeight: 600,
    color: "#475569",
  },
  metricGreen: {
    fontSize: 11.5,
    fontWeight: 700,
    color: "#0E9F6E",
  },
  skillsRow: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  skillChipHero: {
    backgroundColor: "#F1F5F9",
    padding: "3px 8px",
    borderRadius: 6,
  },
  skillChipHeroText: {
    fontSize: 11,
    fontWeight: 600,
    color: "#475569",
  },
  heroReviewBox: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF7ED",
    border: "1px solid #FFEDD5",
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  heroReviewText: {
    fontSize: 11.5,
    fontStyle: "italic",
    color: "#475569",
    lineHeight: "16px",
  },
  heroReviewAuthor: {
    fontSize: 10.5,
    fontWeight: 700,
    color: "#1E293B",
    marginTop: 3,
  },
  heroActionRow: {
    display: "flex",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTop: "1px solid #F1F5F9",
  },
  heroBtnSecondary: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    border: "1px solid #E2E8F0",
    padding: "10px 0",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBtnSecondaryText: {
    fontSize: 12,
    fontWeight: 700,
    color: "#475569",
  },
  heroBtnPrimary: {
    flex: 2,
    backgroundColor: "#F26522",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "10px 0",
    borderRadius: 12,
    boxShadow: SHADOWS.small,
  },
  heroBtnPrimaryText: {
    fontSize: 12,
    fontWeight: 800,
    color: "#FFFFFF",
  },

  // 7. STANDARD CARD (#2 - #8)
  standardCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    border: "1px solid #E2E8F0",
    marginBottom: 10,
    boxShadow: SHADOWS.small,
  },
  stdTopRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stdAvatarWrapper: {
    position: "relative",
    marginRight: 10,
  },
  stdAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  stdAvatarText: {
    fontSize: 19,
    fontWeight: 800,
    color: "#FFFFFF",
  },
  rankBadge: {
    position: "absolute",
    top: -4,
    left: -4,
    backgroundColor: "#1E293B",
    padding: "1px 5px",
    borderRadius: 6,
  },
  rankBadgeText: {
    fontSize: 9,
    fontWeight: 900,
    color: "#FFFFFF",
  },
  stdInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  stdNameRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stdName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#1A1A2E",
    flex: 1,
  },
  stdScoreCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    flexShrink: 0,
    marginLeft: 8,
  },
  stdScoreNum: {
    fontSize: 15,
    fontWeight: 800,
    color: "#F26522",
  },
  stdScoreUnit: {
    fontSize: 9,
    color: "#94A3B8",
    marginTop: -2,
  },
  stdSchool: {
    fontSize: 11.5,
    fontWeight: 600,
    color: "#2563EB",
    marginTop: 2,
  },
  stdMetricsRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 5,
  },
  metricBoldSmall: {
    fontSize: 11,
    fontWeight: 700,
    color: "#D97706",
  },
  metricMutedSmall: {
    fontSize: 11,
    color: "#64748B",
  },
  metricDot: {
    color: "#CBD5E1",
  },
  stdFastTag: {
    fontSize: 11,
    color: "#0E9F6E",
    fontWeight: 700,
  },
  stdSkillsRow: {
    display: "flex",
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  skillChipStd: {
    backgroundColor: "#F1F5F9",
    padding: "2.5px 7px",
    borderRadius: 5,
  },
  skillChipStdText: {
    fontSize: 10.5,
    color: "#475569",
    fontWeight: 500,
  },
  stdFooterRow: {
    display: "flex",
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTop: "1px solid #F8FAFC",
  },
  stdBtnDetails: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    border: "1px solid #E2E8F0",
    padding: "7px 0",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
  },
  stdBtnDetailsText: {
    fontSize: 11,
    fontWeight: 600,
    color: "#475569",
  },
  stdBtnSelect: {
    flex: 1,
    backgroundColor: "#FFF7ED",
    border: "1px solid #FED7AA",
    padding: "7px 0",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  stdBtnSelectText: {
    fontSize: 11,
    fontWeight: 700,
    color: "#EA580C",
  },

  // 8. GUARANTEE FOOTER
  footerGuaranteeCard: {
    backgroundColor: "#EFF6FF",
    border: "1px solid #BFDBFE",
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
  },
  guaranteeHeaderRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  guaranteeTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#1E3A8A",
  },
  guaranteeItem: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  guaranteeDesc: {
    fontSize: 11,
    color: "#1E293B",
    flex: 1,
    lineHeight: "16px",
  },

  // 9. LOADING & EMPTY STATES
  loadingContainer: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#1A1A2E",
    marginTop: 12,
  },
  loadingSubtitle: {
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
  },
  emptyContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "40px 0",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#1A1A2E",
    marginTop: 10,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
    padding: "0 20px",
  },
  resetFilterBtn: {
    marginTop: 14,
    backgroundColor: "#F26522",
    padding: "8px 16px",
    borderRadius: 10,
  },
  resetFilterBtnText: {
    fontSize: 12,
    fontWeight: 700,
    color: "#FFFFFF",
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FFF7ED",
    border: "1.5px solid #FED7AA",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyAdviceCard: {
    backgroundColor: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 14,
    padding: 14,
    margin: "14px 16px 0",
    width: "90%",
  },
  emptyAdviceTitle: {
    fontSize: 12.5,
    fontWeight: 800,
    color: "#1E293B",
    marginBottom: 6,
  },
  emptyAdviceText: {
    fontSize: 11.5,
    color: "#64748B",
    lineHeight: "18px",
    marginBottom: 4,
  },

  // 10. MODAL STYLES (RN Modal → fixed overlay bottom sheet)
  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 300,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 24, // RN: Platform.OS === 'ios' ? 36 : 24 — Zalo chạy Android-like → 24
    boxShadow: SHADOWS.large,
    animation: "edc-fade-in-up 0.2s ease-out",
  },
  modalHeaderRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#1A1A2E",
  },
  modalCandidateBox: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    border: "1px solid #FED7AA",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  modalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    flexShrink: 0,
  },
  modalAvatarText: {
    fontSize: 18,
    fontWeight: 800,
    color: "#FFFFFF",
  },
  modalCandidateInfo: {
    flex: 1,
    minWidth: 0,
  },
  modalCandidateName: {
    fontSize: 14,
    fontWeight: 800,
    color: "#1A1A2E",
  },
  modalCandidateSchool: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 1,
  },
  modalCandidateScore: {
    fontSize: 11,
    fontWeight: 700,
    color: "#EA580C",
    marginTop: 2,
  },
  modalDetailsBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    border: "1px solid #E2E8F0",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 16,
  },
  modalDetailRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalDetailLabel: {
    fontSize: 12,
    color: "#64748B",
  },
  modalDetailFee: {
    fontSize: 14,
    fontWeight: 800,
    color: "#1A1A2E",
  },
  modalDetailValue: {
    fontSize: 12,
    fontWeight: 600,
    color: "#1A1A2E",
    textAlign: "right",
  },
  modalDetailEscrow: {
    fontSize: 11.5,
    color: "#2563EB",
    fontWeight: 600,
  },
  modalDetailEscrowBold: {
    fontSize: 11.5,
    fontWeight: 800,
    color: "#2563EB",
  },
  modalActionsRow: {
    display: "flex",
    flexDirection: "row",
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    border: "1px solid #E2E8F0",
    borderRadius: 12,
    padding: "12px 0",
    display: "flex",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  modalCancelBtnText: {
    fontSize: 12.5,
    fontWeight: 700,
    color: "#64748B",
  },
  modalConfirmBtn: {
    flex: 1.5,
    backgroundColor: "#F26522",
    borderRadius: 12,
    padding: "12px 0",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: SHADOWS.small,
  },
  modalConfirmBtnText: {
    fontSize: 12.5,
    fontWeight: 800,
    color: "#FFFFFF",
  },
};

export default CandidatesListScreen;
