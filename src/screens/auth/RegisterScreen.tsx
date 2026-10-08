/**
 * RegisterScreen — port CHÍNH XÁC mobile/src/screens/Auth/RegisterScreen.js (728 dòng).
 * Khung surfaceWarm + card trắng radius 20 như Login: back 44×44, brand row logo 40 + EduCareLink,
 * title "Bắt đầu hành trình", subtitle "Chọn vai trò của bạn...".
 * 2 role-card (radio tròn) — params role từ GuestHome preselect (useEffect theo prop role).
 * Fields đúng RN: Họ+Tên (row flex 1/1.5), username, email, phone, mật khẩu + eye toggle (điều khiển cả 2 ô),
 * worker: upload CCCD trước/sau + chân dung (+ chứng chỉ tuỳ chọn) — input file ẩn + preview (platform: expo-image-picker → <input type="file">).
 * useAuth().register(payload, files) — files key: id_card_front/id_card_back/selfie_photo/certificate_photo.
 * Parent → auto-login, RootNavigator tự chuyển nhánh; Worker → showAlert + nav.replace('Login') (theo đề bài).
 * Validation giống RN: bắt buộc, mật khẩu ≥6, khớp xác nhận, email/phone/ảnh theo role.
 */
import React, { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, showAlert, StatusBarSpacer, Screen } from "@/components/ui";
import { COLORS, SHADOWS, typo } from "@/theme";
import { useNav } from "@/navigation/router";
import { useAuth } from "@/context/AuthContext";

const ROLES = [
  {
    id: "parent",
    label: "Tôi là Phụ huynh",
    icon: "people",
    description: "Tìm kiếm người đồng hành uy tín cho con.",
    iconBg: COLORS.primaryLight,
    iconBgActive: COLORS.primary,
    iconColor: COLORS.primaryDeep,
    iconColorActive: "#ffffff",
    borderColorActive: COLORS.primary,
  },
  {
    id: "worker",
    label: "Tôi là CarePartner",
    icon: "school",
    description: "Hỗ trợ học tập và đồng hành cùng trẻ.",
    iconBg: COLORS.secondaryLight,
    iconBgActive: COLORS.secondary,
    iconColor: COLORS.secondaryDark,
    iconColorActive: "#ffffff",
    borderColorActive: COLORS.secondary,
  },
] as const;

type RoleId = (typeof ROLES)[number]["id"];

/* RN: ImagePicker (launchImageLibraryAsync / launchCameraAsync) → web: <input type="file"> ẩn + preview ảnh, lưu File vào state */
const ImagePickerField: React.FC<{
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
}> = ({ label, file, onChange }) => {
  const libRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onChange(f);
    e.target.value = ""; // cho phép chọn lại cùng 1 ảnh
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={typo("caption", { color: COLORS.onSurfaceVariant })}>{label}</div>
      <input ref={libRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFile} />
      {file ? (
        <Touchable
          onPress={() => libRef.current?.click()}
          activeOpacity={0.8}
          style={{ position: "relative", width: "100%" }}
        >
          <img
            src={preview ?? ""}
            alt={label}
            style={{ width: "100%", height: 140, borderRadius: 14, background: COLORS.background, objectFit: "cover", display: "block" }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              background: "rgba(0,0,0,0.6)",
              borderRadius: 8,
              padding: "5px 10px",
            }}
          >
            <Icon name="create-outline" size={16} color="#fff" />
            <span style={typo("caption", { color: COLORS.textOnPrimary })}>Đổi ảnh</span>
          </div>
        </Touchable>
      ) : (
        <div style={{ display: "flex", flexDirection: "row", gap: 12 }}>
          <Touchable
            onPress={() => libRef.current?.click()}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: COLORS.primaryLight,
              borderRadius: 14,
              padding: "14px 0",
              border: `1.5px dashed ${COLORS.primarySoft}`,
            }}
          >
            <Icon name="images-outline" size={20} color={COLORS.primary} />
            <span style={typo("buttonSmall", { color: COLORS.primary })}>Thư viện</span>
          </Touchable>
          <Touchable
            onPress={() => camRef.current?.click()}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: COLORS.primaryLight,
              borderRadius: 14,
              padding: "14px 0",
              border: `1.5px dashed ${COLORS.primarySoft}`,
            }}
          >
            <Icon name="camera-outline" size={20} color={COLORS.primary} />
            <span style={typo("buttonSmall", { color: COLORS.primary })}>Camera</span>
          </Touchable>
        </div>
      )}
    </div>
  );
};

const RegisterScreen: React.FC<{ role?: string }> = ({ role }) => {
  const nav = useNav();
  const { register } = useAuth();

  const initialRole: RoleId = role === "worker" ? "worker" : "parent";
  const [selectedRole, setSelectedRole] = useState<RoleId>(initialRole);

  useEffect(() => {
    if (role) {
      setSelectedRole(role === "worker" ? "worker" : "parent");
    }
  }, [role]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [idCardFront, setIdCardFront] = useState<File | null>(null);
  const [idCardBack, setIdCardBack] = useState<File | null>(null);
  const [selfiePhoto, setSelfiePhoto] = useState<File | null>(null);
  const [certificatePhoto, setCertificatePhoto] = useState<File | null>(null);

  const [entered, setEntered] = useState(false); // RN fadeAnim 400ms
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleRegister = async () => {
    if (!firstName || !username || !password || !confirmPassword) {
      showAlert("Lỗi", "Vui lòng điền đầy đủ thông tin.");
      return;
    }
    if (password !== confirmPassword) {
      showAlert("Lỗi", "Mật khẩu xác nhận không khớp.");
      return;
    }
    if (password.length < 6) {
      showAlert("Lỗi", "Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    if (selectedRole === "parent") {
      if (!email.trim()) {
        showAlert("Lỗi", "Phụ huynh phải cung cấp email.");
        return;
      }
      if (!phone.trim()) {
        showAlert("Lỗi", "Phụ huynh phải cung cấp số điện thoại.");
        return;
      }
    }

    if (selectedRole === "worker") {
      if (!email.trim()) {
        showAlert("Lỗi", "Carepartner phải cung cấp email để liên hệ.");
        return;
      }
      if (!phone.trim()) {
        showAlert("Lỗi", "Carepartner phải cung cấp số điện thoại để liên hệ.");
        return;
      }
      if (!idCardFront) {
        showAlert("Lỗi", "Vui lòng chụp/chọn ảnh mặt trước CCCD.");
        return;
      }
      if (!idCardBack) {
        showAlert("Lỗi", "Vui lòng chụp/chọn ảnh mặt sau CCCD.");
        return;
      }
      if (!selfiePhoto) {
        showAlert("Lỗi", "Vui lòng chụp/chọn ảnh chân dung của bạn.");
        return;
      }
    }

    setIsLoading(true);
    try {
      const payload: Record<string, unknown> = {
        username: username.trim(),
        password,
        role: selectedRole,
        first_name: firstName,
        last_name: lastName,
        email: email.trim(),
        phone_number: phone.trim(),
      };
      const files: Record<string, File> = {};
      if (idCardFront) files.id_card_front = idCardFront;
      if (idCardBack) files.id_card_back = idCardBack;
      if (selfiePhoto) files.selfie_photo = selfiePhoto;
      if (certificatePhoto) files.certificate_photo = certificatePhoto;

      const result = await register(payload, Object.keys(files).length ? files : undefined);

      if ((result as { status?: string })?.status === "pending_approval") {
        showAlert(
          "Tài khoản đang chờ duyệt",
          "Đăng ký thành công! Tài khoản của bạn đang chờ Admin xét duyệt. Bạn sẽ được thông báo khi tài khoản được kích hoạt."
        );
        nav.replace("Login");
      }
    } catch (error: any) {
      const data = error?.response?.data;
      let msg: string;
      if (data && typeof data === "object") {
        // RN: Object.values(data).flat().join('\n') — tự viết flat vì lib target < es2019
        msg = (Object.values(data) as unknown[])
          .reduce<string[]>((acc, v) => acc.concat(Array.isArray(v) ? v.map((x) => String(x)) : [String(v)]), [])
          .join("\n");
      } else {
        msg = "Đăng ký thất bại. Tên tài khoản có thể đã tồn tại.";
      }
      showAlert("Đăng ký thất bại", msg);
    } finally {
      setIsLoading(false);
    }
  };

  const fadeStyle: React.CSSProperties = { opacity: entered ? 1 : 0, transition: "opacity 0.4s" };
  const inputWrapper: React.CSSProperties = {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 14,
    padding: "0 12px",
    height: 48,
  };
  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    ...typo("body", { color: COLORS.onSurface }),
    padding: 0,
  };
  const fieldLabel = typo("caption", { color: COLORS.onSurfaceVariant });

  return (
    <Screen bg={COLORS.surfaceWarm} scroll>
      <div style={{ padding: "0 20px 44px" }}>
        <StatusBarSpacer />
        <div style={{ height: 32 }} />

        <Touchable
          onPress={() => nav.goBack()}
          hitSlop={12}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            background: COLORS.surface,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 24,
            boxShadow: SHADOWS.small,
          }}
        >
          <Icon name="arrow-back" size={22} color={COLORS.onSurface} />
        </Touchable>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32, ...fadeStyle }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 24 }}>
            <img src="/static/images/logo.png" alt="EduCareLink" style={{ width: 40, height: 40, objectFit: "contain" }} />
            <span style={typo("h2", { color: COLORS.primaryDeep, fontWeight: 900, letterSpacing: -0.3 })}>EduCareLink</span>
          </div>
          <div style={typo("h1", { color: COLORS.onSurface, textAlign: "center", marginBottom: 8 })}>Bắt đầu hành trình</div>
          <div style={typo("body", { color: COLORS.onSurfaceVariant, textAlign: "center", maxWidth: 280 })}>
            Chọn vai trò của bạn để chúng tôi cá nhân hóa trải nghiệm.
          </div>
        </div>

        {/* Role group */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
          {ROLES.map((r) => {
            const isSelected = selectedRole === r.id;
            return (
              <Touchable
                key={r.id}
                onPress={() => setSelectedRole(r.id)}
                activeOpacity={0.85}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 16,
                  background: COLORS.surface,
                  border: `2px solid ${COLORS.outlineVariant}`,
                  borderRadius: 20,
                  padding: 16,
                  boxShadow: SHADOWS.small,
                  boxSizing: "border-box",
                  ...(isSelected
                    ? {
                        borderColor: r.borderColorActive,
                        background: r.id === "parent" ? COLORS.primaryLight : COLORS.secondaryLight,
                        boxShadow: SHADOWS.cardHover,
                      }
                    : {}),
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    background: isSelected ? r.iconBgActive : r.iconBg,
                    flexShrink: 0,
                  }}
                >
                  <Icon name={r.icon} size={28} color={isSelected ? r.iconColorActive : r.iconColor} />
                </div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={typo("h3", { color: isSelected ? r.borderColorActive : COLORS.onSurface })}>{r.label}</span>
                  <span style={typo("caption", { color: COLORS.onSurfaceVariant, fontWeight: 500, letterSpacing: 0.2 })}>
                    {r.description}
                  </span>
                </div>

                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    border: `2px solid ${COLORS.outlineVariant}`,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    flexShrink: 0,
                    ...(isSelected ? { borderColor: r.borderColorActive, background: r.borderColorActive } : {}),
                  }}
                >
                  {isSelected && <div style={{ width: 10, height: 10, borderRadius: 5, background: COLORS.surface }} />}
                </div>
              </Touchable>
            );
          })}
        </div>

        {/* Card form */}
        <div
          style={{
            ...fadeStyle,
            background: COLORS.surface,
            borderRadius: 20,
            padding: 24,
            border: `1px solid ${COLORS.outlineVariant}`,
            boxShadow: SHADOWS.small,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Họ và tên */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={fieldLabel}>Họ và tên</div>
            <div style={{ display: "flex", flexDirection: "row", gap: 12 }}>
              <div style={{ ...inputWrapper, flex: 1 }}>
                <input
                  style={inputStyle}
                  placeholder="Họ"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <div style={{ ...inputWrapper, flex: 1.5 }}>
                <input
                  style={inputStyle}
                  placeholder="Tên *"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Tên tài khoản */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={fieldLabel}>Tên tài khoản</div>
            <div style={inputWrapper}>
              <Icon name="person-outline" size={20} color={COLORS.outlineVariant} style={{ marginRight: 12 }} />
              <input
                style={inputStyle}
                placeholder="Chọn tên tài khoản"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
          </div>

          {/* Email */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={fieldLabel}>Email</div>
            <div style={inputWrapper}>
              <Icon name="mail-outline" size={20} color={COLORS.outlineVariant} style={{ marginRight: 12 }} />
              <input
                style={inputStyle}
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoCapitalize="none"
              />
            </div>
          </div>

          {/* Số điện thoại */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={fieldLabel}>Số điện thoại</div>
            <div style={inputWrapper}>
              <Icon name="call-outline" size={20} color={COLORS.outlineVariant} style={{ marginRight: 12 }} />
              <input
                style={inputStyle}
                placeholder="09xx xxx xxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
              />
            </div>
          </div>

          {/* Mật khẩu */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={fieldLabel}>Mật khẩu (tối thiểu 6 ký tự)</div>
            <div style={inputWrapper}>
              <Icon name="lock-closed-outline" size={20} color={COLORS.outlineVariant} style={{ marginRight: 12 }} />
              <input
                style={inputStyle}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPass ? "text" : "password"}
              />
              <Touchable onPress={() => setShowPass(!showPass)} hitSlop={12} style={{ padding: 8 }}>
                <Icon name={showPass ? "eye-outline" : "eye-off-outline"} size={20} color={COLORS.outlineVariant} />
              </Touchable>
            </div>
          </div>

          {/* Xác nhận mật khẩu */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={fieldLabel}>Xác nhận mật khẩu</div>
            <div style={inputWrapper}>
              <Icon name="lock-closed-outline" size={20} color={COLORS.outlineVariant} style={{ marginRight: 12 }} />
              <input
                style={inputStyle}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type={showPass ? "text" : "password"}
              />
            </div>
          </div>

          {/* Worker — Xác minh danh tính */}
          {selectedRole === "worker" && (
            <div
              style={{
                background: COLORS.surfaceContainerLow,
                borderRadius: 20,
                padding: 18,
                display: "flex",
                flexDirection: "column",
                gap: 14,
                border: `1px solid ${COLORS.outlineVariant}`,
              }}
            >
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="shield-checkmark" size={20} color={COLORS.primary} />
                <span style={typo("h4", { color: COLORS.onSurface })}>Xác minh danh tính</span>
              </div>
              <div style={typo("bodySmall", { color: COLORS.onSurfaceVariant, lineHeight: "20px" })}>
                Vui lòng cung cấp ảnh CCCD và ảnh chân dung để Admin xét duyệt tài khoản.
              </div>
              <ImagePickerField label="Mặt trước CCCD *" file={idCardFront} onChange={setIdCardFront} />
              <ImagePickerField label="Mặt sau CCCD *" file={idCardBack} onChange={setIdCardBack} />
              <ImagePickerField label="Ảnh chân dung *" file={selfiePhoto} onChange={setSelfiePhoto} />
              <ImagePickerField label="Bằng cấp/Chứng chỉ (tuỳ chọn)" file={certificatePhoto} onChange={setCertificatePhoto} />
            </div>
          )}

          {selectedRole === "worker" && (
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: 10,
                alignItems: "flex-start",
                background: COLORS.primaryLight,
                borderRadius: 14,
                padding: 16,
                border: `1px solid ${COLORS.primarySoft}`,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 4,
                  background: COLORS.primary,
                  borderRadius: 4,
                }}
              />
              <Icon name="information-circle" size={18} color={COLORS.primary} />
              <div style={{ flex: 1, ...typo("bodySmall", { color: COLORS.primaryDeep, lineHeight: "20px", marginLeft: 4 }) }}>
                Tài khoản Carepartner cần được Admin xét duyệt trước khi đăng nhập. Quá trình duyệt thường mất 1-2 ngày làm việc.
              </div>
            </div>
          )}

          {/* Nút tạo tài khoản */}
          <Touchable
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.8}
            style={{
              background: COLORS.primary,
              borderRadius: 14,
              height: 48,
              display: "flex",
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 4,
              boxShadow: SHADOWS.large,
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? (
              <Spinner size={20} color="#fff" />
            ) : (
              <>
                <span style={typo("h4", { color: COLORS.textOnPrimary })}>Tạo tài khoản</span>
                <Icon name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </Touchable>

          {/* Login row */}
          <div style={{ display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
            <span style={typo("body", { color: COLORS.onSurfaceVariant })}>Đã có tài khoản?</span>
            <Touchable onPress={() => nav.navigate("Login")} hitSlop={8}>
              <span style={typo("h4", { color: COLORS.primary })}> Đăng nhập</span>
            </Touchable>
          </div>
        </div>
      </div>
    </Screen>
  );
};

export default RegisterScreen;
