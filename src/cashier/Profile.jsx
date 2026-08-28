//src/cashier/Profile.jsx
import { useEffect, useState, useRef } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { theme } from "./theme.js";

// LoginForm.jsx kaydiya localStorage.setItem("cashierId", item.id)
// halkaas oo item.id uu yahay doc ID-ga collection-ka "cashier"
// (isla username-ka, tusaale "guul1").
function getCurrentCashierId() {
  return localStorage.getItem("cashierId");
}

export default function Profile() {
  const [cashierId, setCashierId] = useState(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [photoURL, setPhotoURL] = useState(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // {type: "ok"|"error", text}
  const fileInputRef = useRef(null);

  useEffect(() => {
    const id = getCurrentCashierId();
    if (!id) {
      setLoading(false);
      setMessage({ type: "error", text: "Lama helin user-ka hadda soo galay." });
      return;
    }
    setCashierId(id);
    loadProfile(id);
  }, []);

  async function loadProfile(id) {
    try {
      setLoading(true);
      const ref = doc(db, "cashier", id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setFullName(data.fullName || data.name || "");
        setUsername(data.username || id);
        setPhotoURL(data.photoURL || null);
      }
    } catch (err) {
      console.error("Khalad ayaa dhacay markii profile-ka la soo qaadanayay:", err);
      setMessage({ type: "error", text: "Khalad ayaa dhacay markii xogta la soo qaadanayay." });
    } finally {
      setLoading(false);
    }
  }

  // Sawirka: waxaan u beddelaynaa base64 (data URL) oo kaydineyna
  // Firestore document-ka cashier-ka (field: photoURL). Ma isticmaaleyno
  // Firebase Storage si loo yareeyo dejinta dheeraadka ah.
  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Fadlan dooro sawir sax ah (jpg, png, iwm)." });
      return;
    }
    // Xaddid cabbirka (~1.5MB) si aan Firestore document-ka (1MB/field
    // limit) uusan u buuxsamin.
    if (file.size > 1.5 * 1024 * 1024) {
      setMessage({ type: "error", text: "Sawirku waa inuu ka yaraado 1.5MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      try {
        setSaving(true);
        const ref = doc(db, "cashier", cashierId);
        await updateDoc(ref, { photoURL: dataUrl });
        setPhotoURL(dataUrl);
        setMessage({ type: "ok", text: "Sawirka waa la cusboonaysiiyay." });
      } catch (err) {
        console.error(err);
        setMessage({ type: "error", text: "Khalad ayaa dhacay markii sawirka la kaydinayay." });
      } finally {
        setSaving(false);
      }
    };
    reader.readAsDataURL(file);
  }

  // Password: waxaan hubineynaa in currentPassword uu sax yahay
  // (isbarbardhig la doc-ka Firestore) kahor intaan la beddelin.
  // Username-ka (doc ID-ga) MARNA looma beddeli karo halkan.
  async function handlePasswordSave(e) {
    e.preventDefault();
    setMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: "error", text: "Fadlan buuxi dhammaan meelaha password-ka." });
      return;
    }
    if (newPassword.length < 4) {
      setMessage({ type: "error", text: "Password-ka cusub waa inuu ka koobnaadaa ugu yaraan 4 xaraf." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Password-ka cusub iyo xaqiijintiisu iskuma mid aha." });
      return;
    }

    try {
      setSaving(true);
      const ref = doc(db, "cashier", cashierId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setMessage({ type: "error", text: "Xogta cashier-ka lama helin." });
        return;
      }
      const data = snap.data();
      if (String(data.password) !== String(currentPassword)) {
        setMessage({ type: "error", text: "Password-ka hadda ma saxna." });
        return;
      }

      await updateDoc(ref, { password: newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({ type: "ok", text: "Password-ka waa la beddelay si guul leh." });
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Khalad ayaa dhacay markii password-ka la beddelayay." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p style={{ fontSize: 13, color: theme.colors.inkMuted }}>Soo dejinaya...</p>;
  }

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={styles.title}>Cashier Profile</h1>
        <p style={styles.subtitle}>Your account details</p>
      </header>

      {/* Profile card: photo + fullName + username (read-only) */}
      <div style={styles.card}>
        <div style={styles.avatarWrap}>
          {photoURL ? (
            <img src={photoURL} alt="Profile" style={styles.avatarImg} />
          ) : (
            <div style={styles.avatar}>👤</div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={styles.photoBtn}
            disabled={saving}
          >
            Beddel Sawirka
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            style={{ display: "none" }}
          />
        </div>
        <div>
          <div style={styles.name}>{fullName || "Cashier User"}</div>
          <div style={styles.role}>Finance Desk Staff</div>
          <div style={styles.usernameRow}>
            <span style={styles.usernameLabel}>Username:</span>{" "}
            <span style={styles.usernameValue}>{username}</span>
          </div>
        </div>
      </div>

      {/* Password change form */}
      <div style={{ ...styles.card, marginTop: 20, flexDirection: "column", alignItems: "stretch" }}>
        <h3 style={styles.sectionTitle}>Beddel Password-ka</h3>

        {message && (
          <div
            style={{
              ...styles.messageBox,
              background: message.type === "ok" ? "#E6F5EC" : "#FEE2E2",
              color: message.type === "ok" ? "#16a34a" : "#DC2626",
            }}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handlePasswordSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={styles.label}>Password-ka Hadda</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={styles.input}
              placeholder="Password-ka hadda"
            />
          </div>
          <div>
            <label style={styles.label}>Password-ka Cusub</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={styles.input}
              placeholder="Password-ka cusub"
            />
          </div>
          <div>
            <label style={styles.label}>Xaqiiji Password-ka Cusub</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={styles.input}
              placeholder="Ku celi password-ka cusub"
            />
          </div>

          <button type="submit" disabled={saving} style={styles.saveBtn}>
            {saving ? "Kaydinaya..." : "Kaydi Password-ka"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  title: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 26,
    color: theme.colors.ink,
    margin: 0,
  },
  subtitle: {
    color: theme.colors.inkMuted,
    fontSize: 14,
    marginTop: 6,
  },
  card: {
    background: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 28,
    boxShadow: theme.shadow.card,
    border: `1px solid ${theme.colors.border}`,
    display: "flex",
    alignItems: "center",
    gap: 18,
    maxWidth: 420,
  },
  avatarWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: `${theme.colors.mint}1A`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 26,
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    objectFit: "cover",
    border: `1px solid ${theme.colors.border}`,
  },
  photoBtn: {
    fontSize: 11,
    fontWeight: 700,
    color: theme.colors.mint,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
  },
  name: {
    fontWeight: 700,
    color: theme.colors.ink,
    fontSize: 16,
  },
  role: {
    color: theme.colors.inkMuted,
    fontSize: 13.5,
    marginTop: 2,
  },
  usernameRow: {
    marginTop: 8,
    fontSize: 12.5,
  },
  usernameLabel: {
    color: theme.colors.inkMuted,
  },
  usernameValue: {
    fontWeight: 700,
    color: theme.colors.ink,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: theme.colors.ink,
    margin: "0 0 16px",
  },
  label: {
    display: "block",
    fontSize: 12.5,
    fontWeight: 600,
    color: theme.colors.inkMuted,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${theme.colors.border}`,
    fontSize: 13.5,
    outline: "none",
    boxSizing: "border-box",
  },
  saveBtn: {
    background: theme.colors.mint,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 18px",
    fontWeight: 700,
    fontSize: 13.5,
    cursor: "pointer",
    alignSelf: "flex-start",
  },
  messageBox: {
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 12.5,
    fontWeight: 600,
    marginBottom: 14,
  },
};