import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, Mail, Calendar, Menu, ChevronDown, Camera, Moon, Sun } from "lucide-react";
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../firebase/firebase";

import avatar from "../assets/avatar.png";

export default function Topbar() {
  const navigate = useNavigate();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [photoUrl, setPhotoUrl] = useState("");
  const [adminName, setAdminName] = useState("Admin User");
  const [adminRoleLabel, setAdminRoleLabel] = useState("Super Admin");
  const [uploading, setUploading] = useState(false);
  const [avatarHover, setAvatarHover] = useState(false);
  const fileInputRef = useRef(null);
  const searchRef = useRef(null);

  // Light / dark theme — stored per browser, applied as data-ai-theme on
  // <html>. The CSS variables it drives are defined in the <style> below,
  // so every page that renders this Topbar gets them.
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("aiTheme") || "light";
    } catch (e) {
      return "light";
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-ai-theme", theme);
    try {
      localStorage.setItem("aiTheme", theme);
    } catch (e) {
      /* ignore */
    }
  }, [theme]);

  // Ctrl+K / Cmd+K focuses the search box
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Every admin (Super Admin or sub-admin) has their own Firestore doc id,
  // stored at login time in localStorage.adminId (see LoginForm.jsx). Using
  // that here — instead of a hard-coded "admin" doc id — is what makes each
  // admin's photo/name their own instead of one shared record everyone
  // reads and overwrites.
  const adminId = localStorage.getItem("adminId") || "";
  const adminRole = localStorage.getItem("adminRole") || "admin";

  useEffect(() => {
    const msgQ = query(collection(db, "messages"), where("read", "==", false));
    const unsubMsg = onSnapshot(
      msgQ,
      (snap) => setUnreadMessages(snap.docs.length),
      (err) => console.log(err)
    );

    const notifQ = query(collection(db, "notifications"), where("read", "==", false));
    const unsubNotif = onSnapshot(
      notifQ,
      (snap) => setUnreadNotifications(snap.docs.length),
      (err) => console.log(err)
    );

    return () => {
      unsubMsg();
      unsubNotif();
    };
  }, []);

  // Load THIS admin's own saved profile photo + name (admin/{adminId}) on
  // mount — never the shared "admin/admin" doc, so each admin only ever
  // sees their own photo here.
  useEffect(() => {
    async function loadAdminPhoto() {
      if (!adminId) return;
      try {
        const snap = await getDoc(doc(db, "admin", adminId));
        if (snap.exists()) {
          const data = snap.data();
          if (data.photoUrl) setPhotoUrl(data.photoUrl);
          if (data.fullName || data.username) {
            setAdminName(data.fullName || data.username);
          }
          setAdminRoleLabel(
            (data.role || adminRole) === "subadmin" ? "Sub-Admin" : "Super Admin"
          );
        }
      } catch (err) {
        console.log(err);
      }
    }
    loadAdminPhoto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId]);

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file || !adminId) return;

    try {
      setUploading(true);
      // Path is namespaced by adminId too, so each admin's uploaded files
      // never collide with another admin's in Storage.
      const storageRef = ref(storage, `adminPhotos/${adminId}-${Date.now()}-${file.name}`);
      await uploadBytes(storageRef, file);
      const url = (await getDownloadURL(storageRef)).trim();

      await updateDoc(doc(db, "admin", adminId), { photoUrl: url });
      setPhotoUrl(url);
    } catch (err) {
      console.error("Khalad sawirka admin-ka la soo shubayay:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 14,
      }}
    >
      {/* LEFT — (mobile) menu toggle + search */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 260 }}>
        <div
          className="ai-menu-btn"
          onClick={() => window.dispatchEvent(new Event("ai-toggle-sidebar"))}
          title="Menu"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
            color: "#fff",
            flexShrink: 0,
            boxShadow: "0 6px 14px rgba(37,99,235,0.3)",
          }}
        >
          <Menu size={20} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flex: 1,
            maxWidth: 830,
            height: 50,
            borderRadius: 14,
            background: "var(--ai-input)",
            border: "1px solid var(--ai-border)",
            boxShadow: "var(--ai-shadow)",
            padding: "0 12px 0 18px",
          }}
        >
          <Search size={19} color="var(--ai-muted)" />
          <input
            ref={searchRef}
            placeholder="Search students, teachers, classes, exams..."
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--ai-text)",
              fontSize: 14.5,
            }}
          />
          <kbd
            className="ai-kbd"
            style={{
              fontSize: 11.5,
              fontFamily: "inherit",
              color: "var(--ai-muted)",
              background: "var(--ai-hover)",
              border: "1px solid var(--ai-border)",
              borderRadius: 8,
              padding: "4px 8px",
              flexShrink: 0,
            }}
          >
            {isMac ? "⌘ K" : "Ctrl K"}
          </kbd>
        </div>
      </div>

      {/* RIGHT */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <IconButton onClick={() => navigate("/admin/messages")} badge={unreadNotifications} badgeColor="#EF4444">
          <Bell size={20} color="var(--ai-text)" />
        </IconButton>

        <IconButton onClick={() => navigate("/admin/messages")} badge={unreadMessages} badgeColor="#EF4444">
          <Mail size={20} color="var(--ai-text)" />
        </IconButton>

        <IconButton onClick={() => navigate("/admin/reports")}>
          <Calendar size={20} color="var(--ai-text)" />
        </IconButton>

        <IconButton
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun size={20} color="#facc15" /> : <Moon size={20} color="var(--ai-text)" />}
        </IconButton>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            cursor: "pointer",
            marginLeft: 6,
          }}
        >
          <div
            onClick={() => fileInputRef.current?.click()}
            onMouseEnter={() => setAvatarHover(true)}
            onMouseLeave={() => setAvatarHover(false)}
            style={{
              position: "relative",
              width: 48,
              height: 48,
              flexShrink: 0,
              cursor: "pointer",
            }}
            title="Beddel sawirka profile-ka"
          >
            <img
              src={photoUrl || avatar}
              alt="Admin"
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                objectFit: "cover",
                opacity: uploading ? 0.5 : 1,
                border: "2px solid var(--ai-card)",
                boxShadow: "0 4px 12px rgba(15,23,42,0.15)",
              }}
            />
            {/* camera overlay on hover / while uploading */}
            {(avatarHover || uploading) && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "rgba(15,23,42,0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Camera size={16} color="#fff" />
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              style={{ display: "none" }}
            />
          </div>
          <div className="ai-admin-name" style={{ lineHeight: 1.3 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ai-text)" }}>{adminName}</div>
            <div style={{ fontSize: 12.5, color: "var(--ai-muted)" }}>{adminRoleLabel}</div>
          </div>
          <ChevronDown size={18} color="var(--ai-text)" />
        </div>
      </div>

      <style>{`
        :root {
          --ai-bg: #F4F7FC;
          --ai-card: #ffffff;
          --ai-text: #0f172a;
          --ai-muted: #64748b;
          --ai-soft: #94a3b8;
          --ai-border: rgba(15,23,42,0.07);
          --ai-input: #ffffff;
          --ai-hover: #f1f5f9;
          --ai-shadow: 0 6px 22px rgba(15,23,42,0.06);
          --ai-side: #ffffff;
          --ai-side-text: #1e293b;
        }
        :root[data-ai-theme="dark"] {
          --ai-bg: #0b1220;
          --ai-card: #111a2e;
          --ai-text: #e5e7eb;
          --ai-muted: #9ca3af;
          --ai-soft: #6b7280;
          --ai-border: rgba(255,255,255,0.07);
          --ai-input: #0f172a;
          --ai-hover: #1e293b;
          --ai-shadow: 0 6px 22px rgba(0,0,0,0.35);
          --ai-side: #0f172a;
          --ai-side-text: #e2e8f0;
        }
        :root[data-ai-theme="dark"] select option { background: #111a2e; color: #e5e7eb; }
        .ai-menu-btn { display: none; }
        .ai-icon-btn { transition: transform .15s ease; }
        .ai-icon-btn:hover { transform: translateY(-2px); }
        @media (max-width: 1000px) {
          .ai-menu-btn { display: flex; }
        }
        @media (max-width: 900px) {
          .ai-kbd { display: none; }
        }
        @media (max-width: 640px) {
          .ai-admin-name { display: none; }
        }
      `}</style>
    </div>
  );
}

function IconButton({ children, onClick, badge, badgeColor = "#EF4444", title }) {
  return (
    <div
      className="ai-icon-btn"
      onClick={onClick}
      title={title}
      style={{
        width: 50,
        height: 50,
        borderRadius: "50%",
        background: "var(--ai-card)",
        border: "1px solid var(--ai-border)",
        boxShadow: "var(--ai-shadow)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      {children}
      {badge > 0 && (
        <span
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            minWidth: 19,
            height: 19,
            borderRadius: 999,
            background: badgeColor,
            color: "#fff",
            fontSize: 10,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontWeight: 800,
            border: "2px solid var(--ai-card)",
            padding: "0 4px",
          }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </div>
  );
}