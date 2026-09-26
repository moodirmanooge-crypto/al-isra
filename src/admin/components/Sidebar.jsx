// Sidebar.jsx
import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { db } from "../../firebase/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  School,
  Wallet,
  UserPlus,
  MessageCircle,
  BarChart3,
  CalendarCheck,
  ClipboardList,
  CalendarDays,
  FileEdit,
  IdCard,
  Award,
  HelpCircle,
  Settings,
  Clock,
  Receipt,
  FileSpreadsheet,
  CalendarOff,
  Image as ImageIcon,
  Newspaper,
  ShieldPlus,
  ShieldCheck,
  ClipboardCheck,
  BookOpen,
  UploadCloud,
  LogOut,
  Mail,
  ArrowRight,
} from "lucide-react";

import logo from "../assets/logo.png";

const menus = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
  { name: "Admissions", icon: ClipboardCheck, path: "/admin/admissions" },
  { name: "Students", icon: GraduationCap, path: "/admin/students" },
  { name: "Teachers", icon: Users, path: "/admin/teachers" },
  { name: "Parents", icon: Users, path: "/admin/parents" },
  { name: "Classes", icon: School, path: "/admin/classes" },
  { name: "Shifts", icon: Clock, path: "/admin/shifts" },
  { name: "Attendance", icon: CalendarCheck, path: "/admin/attendance" },
  { name: "Holidays", icon: CalendarOff, path: "/admin/holidays" },
  { name: "Exams", icon: ClipboardList, path: "/admin/exams" },
  { name: "Timetable", icon: CalendarDays, path: "/admin/timetable" },
  { name: "Exam Timetable", icon: FileEdit, path: "/admin/exam-timetable" },
  { name: "Exam Cards", icon: IdCard, path: "/admin/exam-cards" },
  { name: "ID Cards", icon: IdCard, path: "/admin/id-cards" },
  { name: "Certificates", icon: Award, path: "/admin/certificates" },
  { name: "Upload Certificate", icon: UploadCloud, path: "/admin/upload-certificate" },
  { name: "Results by Class", icon: FileSpreadsheet, path: "/admin/results-by-class" },
  { name: "Gallery", icon: ImageIcon, path: "/admin/gallery" },
  { name: "News", icon: Newspaper, path: "/admin/news" },
  { name: "Library", icon: BookOpen, path: "/admin/library" },
  { name: "Add Cashier", icon: Wallet, path: "/admin/add-cashier" },
  { name: "Receipts", icon: Receipt, path: "/admin/receipts" },
  { name: "Messages", icon: MessageCircle, path: "/admin/messages" },
  { name: "Reports", icon: BarChart3, path: "/admin/reports" },
  { name: "Settings", icon: Settings, path: "/admin/settings" },
];

// Super-Admin-only menu items — never filtered by permissions, never
// shown to a sub-admin regardless of what was assigned to them.
const superAdminOnlyMenus = [
  { name: "Add Sub-Admin", icon: ShieldPlus, path: "/admin/add-sub-admin" },
  { name: "Manage Admins", icon: ShieldCheck, path: "/admin/manage-admins" },
];

const SUPPORT_WHATSAPP = "252615860629"; // international format, no + or leading 0
const SUPPORT_EMAIL = "alisraprimaryandsecondaryschool@gmail.com";

export default function Sidebar() {
  const navigate = useNavigate();

  // A sub-admin's session carries adminRole: "subadmin" and an
  // adminPermissions JSON array of allowed paths (set at login in
  // LoginForm.jsx from their `admin/{email}` doc). The original Super
  // Admin account has no role field (or role: "admin") and always sees
  // every menu item, unfiltered.
  const adminRole = localStorage.getItem("adminRole") || "admin";
  const isSubAdmin = adminRole === "subadmin";

  let permissions = [];
  if (isSubAdmin) {
    try {
      permissions = JSON.parse(localStorage.getItem("adminPermissions") || "[]");
    } catch (e) {
      permissions = [];
    }
  }

  // Sub-admins only ever see the menu items they were explicitly handed
  // — everything else is left out of the list entirely, not just
  // disabled, per how this sidebar was scoped.
  const visibleMenus = isSubAdmin
    ? menus.filter((m) => permissions.includes(m.path))
    : menus;

  // Live count of pending admissions — shown as a notification badge
  // next to the "Admissions" menu item so admins immediately see how
  // many new applications are waiting to be reviewed.
  const [pendingAdmissions, setPendingAdmissions] = useState(0);

  useEffect(() => {
    const q = query(
      collection(db, "Admissions"),
      where("status", "==", "Pending")
    );
    const unsub = onSnapshot(
      q,
      (snap) => setPendingAdmissions(snap.size),
      (err) => console.log(err)
    );
    return () => unsub();
  }, []);

  // Collapsed (icons-only) state — used on small screens. Toggled by the
  // Menu button in the Topbar (custom event), remembered per browser.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem("aiSidebarCollapsed");
      if (saved !== null) return saved === "1";
    } catch (e) {
      /* ignore */
    }
    return typeof window !== "undefined" && window.innerWidth < 768;
  });

  useEffect(() => {
    try {
      localStorage.setItem("aiSidebarCollapsed", collapsed ? "1" : "0");
    } catch (e) {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    const toggle = () => setCollapsed((c) => !c);
    window.addEventListener("ai-toggle-sidebar", toggle);
    return () => window.removeEventListener("ai-toggle-sidebar", toggle);
  }, []);

  // Clears the admin session (role + permissions + anything else an
  // admin login may have stored under these keys) and sends the admin
  // straight to the system's home page — not back to the admin login
  // screen, per how this button is meant to behave.
  function handleLogout() {
    localStorage.removeItem("adminRole");
    localStorage.removeItem("adminPermissions");
    navigate("/");
  }

  const renderItem = (item, activeBg, activeShadow, badge = 0) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.path}
        to={item.path}
        title={collapsed ? item.name : undefined}
        className="ai-nav"
        style={({ isActive }) => ({
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 16,
          padding: collapsed ? "13px 0" : "12px 20px",
          marginBottom: 4,
          textDecoration: "none",
          color: isActive ? "#fff" : "var(--ai-side-text)",
          borderRadius: 12,
          transition: "all .2s ease",
          fontWeight: isActive ? 700 : 500,
          fontSize: 15.5,
          background: isActive ? activeBg : undefined,
          boxShadow: isActive ? activeShadow : "none",
        })}
      >
        <Icon size={20} style={{ flexShrink: 0 }} />
        {!collapsed && (
          <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.name}
          </span>
        )}
        {badge > 0 &&
          (collapsed ? (
            <span
              style={{
                position: "absolute",
                top: 6,
                right: 14,
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#ef4444",
                border: "2px solid var(--ai-side)",
              }}
            />
          ) : (
            <span
              style={{
                minWidth: 20,
                height: 20,
                padding: "0 6px",
                borderRadius: 999,
                background: "#ef4444",
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {badge}
            </span>
          ))}
      </NavLink>
    );
  };

  return (
    <aside
      style={{
        width: collapsed ? 84 : 290,
        height: "100vh",
        position: "sticky",
        top: 0,
        flexShrink: 0,
        background: "var(--ai-side)",
        color: "var(--ai-side-text)",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--ai-border)",
        boxShadow: "4px 0 24px rgba(15,23,42,0.04)",
        transition: "width .25s ease",
        zIndex: 20,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: collapsed ? "20px 0 14px" : "18px 22px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 14,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: collapsed ? 52 : 68,
            height: collapsed ? 52 : 68,
            borderRadius: "50%",
            background: "#ffffff",
            border: "1px solid rgba(15,23,42,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            overflow: "hidden",
            boxShadow: "0 6px 16px rgba(15,23,42,0.1)",
          }}
        >
          <img src={logo} alt="" style={{ width: "88%", height: "88%", objectFit: "contain" }} />
        </div>

        {!collapsed && (
          <div style={{ minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                color: "var(--ai-text)",
                lineHeight: 1.2,
                letterSpacing: "0.01em",
                whiteSpace: "nowrap",
              }}
            >
              AL - ISRA SCHOOL
            </h2>
            <small style={{ color: "var(--ai-muted)", fontSize: 13, whiteSpace: "nowrap" }}>
              School Management System
            </small>
          </div>
        )}
      </div>

      {/* Menu */}
      <div
        className="ai-side-scroll"
        style={{ padding: collapsed ? "6px 12px" : "6px 18px", overflowY: "auto", flex: 1, minHeight: 0 }}
      >
        {visibleMenus.map((item) =>
          renderItem(
            item,
            "linear-gradient(90deg,#1ea7ff,#2563eb)",
            "0 8px 18px rgba(37,99,235,0.3)",
            item.path === "/admin/admissions" ? pendingAdmissions : 0
          )
        )}

        {!isSubAdmin && (
          <>
            {collapsed ? (
              <div style={{ height: 1, background: "var(--ai-border)", margin: "12px 6px" }} />
            ) : (
              <div
                style={{
                  margin: "14px 4px 8px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--ai-soft)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  borderTop: "1px solid var(--ai-border)",
                  paddingTop: 14,
                }}
              >
                Super Admin
              </div>
            )}
            {superAdminOnlyMenus.map((item) =>
              renderItem(item, "linear-gradient(90deg,#f59e0b,#d97706)", "0 8px 18px rgba(245,158,11,0.3)")
            )}
          </>
        )}
      </div>

      {/* Help card + Log Out */}
      <div style={{ padding: collapsed ? "10px 12px 16px" : "12px 18px 16px", flexShrink: 0 }}>
        {collapsed ? (
          <a
            href={`https://wa.me/${SUPPORT_WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Contact Support"
            style={{
              height: 46,
              borderRadius: 14,
              background: "linear-gradient(135deg,#e0edff,#eef4ff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 8,
            }}
          >
            <HelpCircle size={21} color="#2563eb" />
          </a>
        ) : (
          <div
            style={{
              background: "linear-gradient(135deg,#e3eeff,#f0f6ff)",
              border: "1px solid rgba(37,99,235,0.12)",
              borderRadius: 16,
              padding: "14px 14px",
              marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 34, lineHeight: 1 }}>🎓</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, color: "#1e3a8a" }}>Good Education</div>
                <div style={{ fontWeight: 800, fontSize: 13.5, color: "#1e3a8a" }}>Brighter Future</div>
              </div>
              <a
                href={`https://wa.me/${SUPPORT_WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Contact Support"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#1ea7ff,#2563eb)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 6px 14px rgba(37,99,235,0.3)",
                }}
              >
                <ArrowRight size={17} />
              </a>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <a
                href={`https://wa.me/${SUPPORT_WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 10,
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  textDecoration: "none",
                }}
              >
                <HelpCircle size={14} />
                Contact Support
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                title="Email Support"
                style={{
                  width: 38,
                  borderRadius: 10,
                  border: "1px solid rgba(37,99,235,0.3)",
                  background: "#fff",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textDecoration: "none",
                  flexShrink: 0,
                }}
              >
                <Mail size={15} />
              </a>
            </div>
          </div>
        )}

        {/* Log Out — clears the admin session and sends the admin to the
            system's home page. */}
        <button
          onClick={handleLogout}
          title="Log Out"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "11px 0",
            borderRadius: 12,
            border: "1px solid rgba(220,38,38,0.25)",
            background: "rgba(220,38,38,0.06)",
            color: "#DC2626",
            fontWeight: 700,
            fontSize: 13.5,
            cursor: "pointer",
          }}
        >
          <LogOut size={17} />
          {!collapsed && "Log Out"}
        </button>
      </div>

      <style>{`
        .ai-nav:hover { background: var(--ai-hover); }
        .ai-side-scroll::-webkit-scrollbar { width: 5px; }
        .ai-side-scroll::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.25); border-radius: 10px; }
        .ai-side-scroll { scrollbar-width: thin; scrollbar-color: rgba(100,116,139,0.25) transparent; }
      `}</style>
    </aside>
  );
}