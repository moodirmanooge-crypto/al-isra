//src/pages/LoginForm.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Headphones,
  Crown,
  Settings,
  BarChart3,
  Users,
  GraduationCap,
  TrendingUp,
  Star,
  BookOpen,
  Award,
  Heart,
  MessageSquareText,
  CalendarCheck,
  Zap,
  CreditCard,
  Presentation,
  Receipt,
} from "lucide-react";

// ---- Naqshadaha (theme) gaarka ah ee role kasta — waxay ka soo hor
// jeedaan sawirrada la soo diray, 1-1 ah. Wax kama beddelin logic-ga
// login-ka — halkan waxaa lagu sameeyay kaliya muuqaalka (UI).
const ROLE_THEMES = {
  Admin: {
    accent: "#2563eb",
    accentDark: "#1d4ed8",
    panelFrom: "#0b1220",
    panelTo: "#1e3a8a",
    pageBg: "#eef3fb",
    badgeBg: "rgba(37,99,235,0.12)",
    Icon: Crown,
    portalTitle: "Admin Panel",
    portalTag: "Full Control, Better Management",
    heroLead: "Welcome to",
    heroAccent: "Admin Portal",
    heroDesc: "Manage your school system with ease and full control.",
    features: [
      { Icon: Settings, title: "Manage Users", sub: "Students, Teachers, Parents" },
      { Icon: BarChart3, title: "View Reports", sub: "Real-time Analytics" },
      { Icon: ShieldCheck, title: "System Settings", sub: "Secure & Flexible" },
      { Icon: Users, title: "Full Control", sub: "Everything in One Place" },
    ],
    signOff: "A Better Education\nA Brighter Future",
    topRightTitle: "Secure Access",
    topRightSub: "Only authorized personnel",
    cardTitlePlain: "Admin",
    cardTitleAccent: "Login",
    cardSub: "Enter your credentials to access the admin panel",
    usernameHint: "Enter your admin email or username",
    passwordHint: "Enter your password",
    showRememberMe: true,
    dividerLabel: "OR",
    bottomBoxes: [
      { Icon: ShieldCheck, title: "Secure & Encrypted", sub: "Your data is always protected" },
      { Icon: Headphones, title: "Need Help?", sub: "Contact System Support" },
    ],
  },
  Teacher: {
    accent: "#2563eb",
    accentDark: "#1d4ed8",
    panelFrom: "#0f2a5c",
    panelTo: "#2563eb",
    pageBg: "#eef3fb",
    badgeBg: "rgba(37,99,235,0.12)",
    Icon: Presentation,
    portalTitle: "Teacher Portal",
    portalTag: "Teach  •  Inspire  •  Build Futures",
    quote: "“ Good teachers create brighter tomorrows. ”",
    features: [
      { Icon: BookOpen, title: "Education", sub: "Guide every student's path" },
      { Icon: Star, title: "Knowledge", sub: "Share what you know" },
      { Icon: ShieldCheck, title: "Discipline", sub: "Build strong foundations" },
      { Icon: Award, title: "Success", sub: "Celebrate every milestone" },
    ],
    topRightTitle: "Welcome Back!",
    topRightSub: "Login to access your teacher dashboard",
    cardTitlePlain: "Teacher",
    cardTitleAccent: "Login",
    cardSub: "Enter your credentials to continue",
    usernameHint: "Enter your teacher username",
    passwordHint: "Enter your password",
    dividerLabel: "OR",
    bottomBoxes: [
      { Icon: ShieldCheck, title: "Secure Access", sub: "Your information is protected" },
      { Icon: BookOpen, title: "Better Education", sub: "A Brighter Future" },
    ],
  },
  Student: {
    accent: "#2563eb",
    accentDark: "#1d4ed8",
    panelFrom: "#0b1a3a",
    panelTo: "#2563eb",
    pageBg: "#eef3fb",
    badgeBg: "rgba(37,99,235,0.12)",
    Icon: GraduationCap,
    portalTitle: "Your Learning Journey Starts Here",
    quote: "“ Education Today  A Brighter Tomorrow ”",
    features: [
      { Icon: GraduationCap, title: "Learn", sub: "Grow your knowledge every day" },
      { Icon: TrendingUp, title: "Grow", sub: "Track your progress" },
      { Icon: Users, title: "Achieve", sub: "Reach your goals" },
      { Icon: Star, title: "Be the Future", sub: "Shape tomorrow" },
    ],
    signOff: "Good Students\nBuild Great Societies",
    cardTitlePlain: "Student",
    cardTitleAccent: "Login",
    cardSub: "Access your account to continue",
    usernameHint: "Enter your student ID",
    passwordHint: "Enter your password",
    dividerLabel: "OR",
    bottomBoxes: [
      { Icon: ShieldCheck, title: "Secure & Safe", sub: "Your information is protected" },
      { Icon: Users, title: "Student Portal", sub: "Learn • Connect • Succeed" },
    ],
  },
  Parent: {
    accent: "#2563eb",
    accentDark: "#1d4ed8",
    panelFrom: "#0f2a5c",
    panelTo: "#2563eb",
    pageBg: "#eef3fb",
    badgeBg: "rgba(37,99,235,0.12)",
    Icon: Users,
    quote: "“ Together for a Brighter Tomorrow ”",
    heroDesc: "Stay connected with your child's education.",
    features: [
      { Icon: TrendingUp, title: "Track Progress", sub: "" },
      { Icon: CalendarCheck, title: "View Attendance", sub: "" },
      { Icon: MessageSquareText, title: "Communicate Easily", sub: "" },
      { Icon: Heart, title: "Support Their Future", sub: "" },
    ],
    signOff: "A Stronger Tomorrow\nTogether ♥",
    topRightTitle: "Welcome Back!",
    topRightSub: "Login to your parent account",
    cardTitlePlain: "Parent",
    cardTitleAccent: "Login",
    cardSub: "Access your account to continue",
    usernameHint: "Enter student ID or your phone number",
    passwordHint: "Enter your password",
    dividerLabel: "Need Help?",
    bottomBoxes: [
      {
        Icon: Headphones,
        title: "Need Help?",
        sub: "For any support, please contact the school administration. We're here to help!",
        wide: true,
      },
    ],
  },
  Cashier: {
    accent: "#16a34a",
    accentDark: "#15803d",
    panelFrom: "#043321",
    panelTo: "#16a34a",
    pageBg: "#eefaf3",
    badgeBg: "rgba(22,163,74,0.12)",
    Icon: Receipt,
    portalTitle: "Cashier Portal",
    portalTag: "Fast  •  Secure  •  Accurate",
    heroDesc: "Handle Payments · Serve Better · Support Education",
    features: [
      { Icon: Zap, title: "Quick Transactions", sub: "" },
      { Icon: ShieldCheck, title: "Secure & Reliable", sub: "" },
      { Icon: BarChart3, title: "Easy to Use", sub: "" },
    ],
    signOff: "Every Payment Builds\na Brighter Future",
    topRightTitle: "Welcome Back!",
    topRightSub: "Login to your cashier account",
    cardTitlePlain: "Cashier",
    cardTitleAccent: "Login",
    cardSub: "Enter your credentials to continue",
    usernameHint: "Enter your cashier username",
    passwordHint: "Enter your password",
    dividerLabel: "OR",
    bottomBoxes: [
      { Icon: ShieldCheck, title: "Secure Login", sub: "Your data is protected" },
      { Icon: CreditCard, title: "Quick Access", sub: "Start working fast" },
      { Icon: Users, title: "Support School", sub: "Together we grow" },
    ],
  },
};

export default function LoginForm({ role }) {
  const navigate = useNavigate();
  const theme = ROLE_THEMES[role] || ROLE_THEMES.Admin;

  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem(`rememberedUsername_${role}`) || "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return !!localStorage.getItem(`rememberedUsername_${role}`);
    } catch {
      return false;
    }
  });

  // ---- Xannib: F12, right-click, iyo shortcut-yada developer tools ----
  useEffect(() => {
    function handleContextMenu(e) {
      e.preventDefault();
    }

    function handleKeyDown(e) {
      const key = (e.key || "").toLowerCase();

      // F12
      if (key === "f12") {
        e.preventDefault();
        return;
      }

      // Ctrl+Shift+I / J / C  (DevTools, Console, Inspect element)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (key === "i" || key === "j" || key === "c")
      ) {
        e.preventDefault();
        return;
      }

      // Ctrl+U (View source) iyo Ctrl+S (Save page)
      if ((e.ctrlKey || e.metaKey) && (key === "u" || key === "s")) {
        e.preventDefault();
        return;
      }
    }

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const login = async () => {
    if (!username.trim() || !password.trim()) {
      alert("Fill all fields");
      return;
    }

    setLoading(true);

    try {
      let collectionName = "";

      switch (role) {
        case "Admin":
          collectionName = "admin";
          break;
        case "Teacher":
          collectionName = "teachers";
          break;
        case "Cashier":
          collectionName = "cashier";
          break;
        case "Student":
          collectionName = "students";
          break;
        case "Parent":
          collectionName = "students";
          break;
        default:
          return;
      }

      const snapshot = await getDocs(collection(db, collectionName));

      let found = false;

      snapshot.forEach((item) => {
        const data = item.data();

        if (role === "Admin") {
          if (
            (data.email === username.trim() ||
              data.username === username.trim()) &&
            data.password === password.trim()
          ) {
            found = true;
            localStorage.setItem("adminId", item.id);
            localStorage.setItem("adminName", data.fullName || data.name || data.username || "Admin");
            // Sub-admins have role: "subadmin" and a `permissions` array
            // of sidebar paths (see AddSubAdmin.jsx). The original Super
            // Admin doc has no `role` field or role: "admin" — treat
            // anything else as a sub-admin so Sidebar.jsx knows whether
            // to filter its menu.
            localStorage.setItem("adminRole", data.role || "admin");
            localStorage.setItem(
              "adminPermissions",
              JSON.stringify(Array.isArray(data.permissions) ? data.permissions : [])
            );
          }
        }

        if (role === "Teacher") {
          if (
            (data.username === username.trim() ||
              data.teacherId === username.trim()) &&
            data.password === password.trim()
          ) {
            found = true;
            localStorage.setItem("teacherId", item.id);
            localStorage.setItem(
              "teacherName",
              data.fullName || data.name || data.username || "Teacher"
            );
          }
        }

        if (role === "Cashier") {
          if (
            data.username === username.trim() &&
            data.password === password.trim()
          ) {
            found = true;
            localStorage.setItem("cashierId", item.id);
            localStorage.setItem("cashierName", data.name || data.username || "Cashier");
            // Username-ka cashier-ka hadda login-gareeyay — waxaa
            // isticmaala cashier/Classes.jsx si loo duugo (stamp)
            // rasiid/payment kasta uu qabto, si Cashiers.jsx admin-ka
            // ugu soo bandhigo lacagaha uu qabtay.
            localStorage.setItem("cashierUsername", data.username);
          }
        }

        if (role === "Student") {
          if (
            (data.studentId === username.trim() ||
              item.id === username.trim()) &&
            data.parentPassword === password.trim()
          ) {
            found = true;
            localStorage.setItem("studentId", item.id);
            localStorage.setItem("studentName", data.fullName || data.name || "Student");
          }
        }

        if (role === "Parent") {
          if (
            (data.studentId === username.trim() ||
              data.parentPhone === username.trim()) &&
            data.parentPassword === password.trim()
          ) {
            found = true;
            localStorage.setItem("studentId", item.id);
            localStorage.setItem("parentName", data.parentName || "Parent");
          }
        }
      });

      if (!found) {
        alert(
          role === "Admin"
            ? "Check your email or password"
            : "Check user or password"
        );
        return;
      }

      // "Remember me" — waxaa la kaydiyaa oo kaliya username-ka (never
      // password-ka) si booqasho dambe uu si toos ah u soo buuxsamo.
      try {
        if (rememberMe) {
          localStorage.setItem(`rememberedUsername_${role}`, username.trim());
        } else {
          localStorage.removeItem(`rememberedUsername_${role}`);
        }
      } catch {
        // localStorage may be unavailable — non-critical, ignore.
      }

      if (role === "Admin") navigate("/admin/dashboard");
      if (role === "Teacher") navigate("/teacher/dashboard");
      if (role === "Cashier") navigate("/cashier/dashboard");
      if (role === "Student") navigate("/student/dashboard");
      if (role === "Parent") navigate("/parent/dashboard");
    } catch (error) {
      alert(
        role === "Admin"
          ? "Check your email or password"
          : "Check user or password"
      );
    } finally {
      setLoading(false);
    }
  };

  function handleKeyPress(e) {
    if (e.key === "Enter") login();
  }

  const HeroIcon = theme.Icon;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: theme.pageBg,
        padding: 20,
        fontFamily:
          "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif",
      }}
    >
      <style>{`
        .login-card { display:flex; width:100%; max-width:1000px; min-height:640px;
          border-radius:28px; overflow:hidden; box-shadow:0 30px 80px rgba(15,23,42,0.18);
          background:#fff; }
        .login-panel { flex:1 1 44%; position:relative; padding:44px 40px; color:#fff;
          display:flex; flex-direction:column; justify-content:space-between; overflow:hidden; }
        .login-right { flex:1 1 56%; padding:48px 52px; display:flex; flex-direction:column;
          justify-content:center; }
        .login-input-wrap { display:flex; align-items:center; gap:10px; border:1.5px solid #e2e8f0;
          border-radius:14px; padding:14px 16px; background:#f8fafc; margin-bottom:8px; }
        .login-input-wrap input { border:none; outline:none; background:transparent; flex:1;
          font-size:15px; color:#0f172a; }
        .login-btn { width:100%; border:none; border-radius:14px; padding:16px; color:#fff;
          font-size:16px; font-weight:700; cursor:pointer; display:flex; align-items:center;
          justify-content:center; gap:10px; }
        @media (max-width: 860px) {
          .login-card { flex-direction:column; min-height:0; }
          .login-panel { padding:32px 28px; }
          .login-right { padding:32px 28px; }
        }
      `}</style>

      <div className="login-card">
        {/* ---- Dhinaca bidix: naqshad + features ---- */}
        <div
          className="login-panel"
          style={{
            background: `linear-gradient(160deg, ${theme.panelFrom}, ${theme.panelTo})`,
          }}
        >
          {/* Decorative blurred circles */}
          <div
            style={{
              position: "absolute",
              top: -60,
              right: -60,
              width: 220,
              height: 220,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              filter: "blur(2px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -80,
              left: -60,
              width: 260,
              height: 260,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            {theme.portalTitle && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    minWidth: 46,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <HeroIcon size={24} color="#fff" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{theme.portalTitle}</div>
                  {theme.portalTag && (
                    <div style={{ fontSize: 12.5, opacity: 0.85 }}>{theme.portalTag}</div>
                  )}
                </div>
              </div>
            )}

            {theme.heroLead && (
              <div style={{ fontSize: 26, fontWeight: 400, lineHeight: 1.25 }}>
                {theme.heroLead}
                <br />
                <span style={{ fontWeight: 800, fontSize: 32 }}>{theme.heroAccent}</span>
              </div>
            )}

            {theme.quote && (
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  lineHeight: 1.35,
                  marginTop: theme.heroLead ? 14 : 0,
                  marginBottom: 6,
                }}
              >
                {theme.quote}
              </div>
            )}

            {theme.heroDesc && (
              <div style={{ fontSize: 14.5, opacity: 0.9, marginTop: 10, maxWidth: 320 }}>
                {theme.heroDesc}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 26 }}>
              {theme.features.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      minWidth: 34,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <f.Icon size={16} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>{f.title}</div>
                    {f.sub && <div style={{ fontSize: 12, opacity: 0.8 }}>{f.sub}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {theme.signOff && (
            <div
              style={{
                position: "relative",
                zIndex: 1,
                fontSize: 15,
                fontWeight: 700,
                lineHeight: 1.4,
                whiteSpace: "pre-line",
                marginTop: 24,
                borderTop: "1px solid rgba(255,255,255,0.2)",
                paddingTop: 18,
              }}
            >
              {theme.signOff}
            </div>
          )}
        </div>

        {/* ---- Dhinaca midig: form-ka login-ka ---- */}
        <div className="login-right">
          {theme.topRightTitle && (
            <div style={{ textAlign: "right", marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                {theme.topRightTitle}
              </div>
              {theme.topRightSub && (
                <div style={{ fontSize: 11.5, color: "#64748b" }}>{theme.topRightSub}</div>
              )}
              <div
                style={{
                  height: 2,
                  width: 34,
                  background: theme.accent,
                  marginLeft: "auto",
                  marginTop: 6,
                  borderRadius: 2,
                }}
              />
            </div>
          )}

          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div
              style={{
                width: 76,
                height: 76,
                borderRadius: "50%",
                background: theme.badgeBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <HeroIcon size={34} color={theme.accent} />
            </div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#0f172a" }}>
              {theme.cardTitlePlain} <span style={{ color: theme.accent }}>{theme.cardTitleAccent}</span>
            </h1>
            <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "#64748b" }}>{theme.cardSub}</p>
          </div>

          <div className="login-input-wrap">
            <User size={18} color="#64748b" />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={
                role === "Admin"
                  ? "Admin Email or Username"
                  : role === "Teacher"
                  ? "Teacher Username"
                  : role === "Cashier"
                  ? "Cashier Username"
                  : role === "Parent"
                  ? "Student ID / Parent Phone"
                  : "Student ID"
              }
            />
          </div>
          <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 16, paddingLeft: 4 }}>
            {theme.usernameHint}
          </div>

          <div className="login-input-wrap">
            <Lock size={18} color="#64748b" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
              title={showPassword ? "Qari Password-ka" : "Muuji Password-ka"}
            >
              {showPassword ? (
                <EyeOff size={18} color="#64748b" />
              ) : (
                <Eye size={18} color="#64748b" />
              )}
            </button>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 22,
              paddingLeft: 4,
            }}
          >
            {theme.showRememberMe ? (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12.5,
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: theme.accent, width: 15, height: 15 }}
                />
                Remember me
              </label>
            ) : (
              <span style={{ fontSize: 11.5, color: "#94a3b8" }}>{theme.passwordHint}</span>
            )}

            <span
              onClick={() =>
                alert(
                  "Fadlan la xiriir maamulka dugsiga si loo dib-u-dejiyo password-kaaga."
                )
              }
              style={{
                fontSize: 12.5,
                color: theme.accent,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Forgot Password?
            </span>
          </div>

          <button
            className="login-btn"
            onClick={login}
            disabled={loading}
            style={{
              background: `linear-gradient(90deg, ${theme.accent}, ${theme.accentDark})`,
              opacity: loading ? 0.75 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? (
              "LOGGING IN..."
            ) : (
              <>
                LOGIN
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.25)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ArrowRight size={14} />
                </span>
              </>
            )}
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "22px 0",
              color: "#94a3b8",
              fontSize: 12,
            }}
          >
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
            {theme.dividerLabel}
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              background: "#f8fafc",
              borderRadius: 14,
              padding: "14px 16px",
            }}
          >
            {theme.bottomBoxes.map((b, i) => (
              <div
                key={i}
                style={{
                  flex: b.wide ? "1 1 100%" : "1 1 45%",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    minWidth: 30,
                    borderRadius: 8,
                    background: theme.badgeBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <b.Icon size={15} color={theme.accent} />
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>
                    {b.title}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{b.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}