import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import {
  Search,
  Wallet,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
  User,
  AtSign,
  Phone,
  Lock,
  Mail,
  CheckCircle2,
} from "lucide-react";

export default function Cashiers() {
  const [cashiers, setCashiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selectedCashier, setSelectedCashier] = useState(null);
  const [editData, setEditData] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCashiers();
  }, []);

  const loadCashiers = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, "cashier"));

      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setCashiers(data);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteCashier = async (id) => {
    if (!window.confirm("Delete this cashier?")) return;
    await deleteDoc(doc(db, "cashier", id));
    setCashiers((prev) => prev.filter((c) => c.id !== id));
  };

  const filtered = cashiers.filter((item) => {
    const txt = search.toLowerCase();

    return (
      item.fullName?.toLowerCase().includes(txt) ||
      item.username?.toLowerCase().includes(txt) ||
      item.phone?.toLowerCase().includes(txt) ||
      item.password?.toLowerCase().includes(txt)
    );
  });

  // ---- Fur modal-ka wax-ka-bedelka cashier-ka ----
  function openEdit(cashier) {
    setSelectedCashier(cashier);
    setEditData({
      fullName: cashier.fullName || "",
      username: cashier.username || "",
      phone: cashier.phone || "",
      password: cashier.password || "",
      email: cashier.email || "",
      status: cashier.status || "Active",
    });
  }

  function closeEdit() {
    setSelectedCashier(null);
    setEditData(null);
  }

  function handleChange(field, value) {
    setEditData({ ...editData, [field]: value });
  }

  async function saveEdit() {
    if (!editData.fullName.trim() || !editData.username.trim()) {
      alert("Fadlan buuxi Magaca iyo Username-ka");
      return;
    }

    try {
      setSaving(true);
      await updateDoc(doc(db, "cashier", selectedCashier.id), {
        fullName: editData.fullName,
        username: editData.username,
        phone: editData.phone,
        password: editData.password,
        email: editData.email,
        status: editData.status,
      });

      setCashiers((prev) =>
        prev.map((c) =>
          c.id === selectedCashier.id ? { ...c, ...editData } : c
        )
      );

      alert("Cashier-ka waa la cusboonaysiiyay");
      closeEdit();
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "#0b0a1c", minHeight: "100vh", padding: "30px" }}>
      <h1 style={{ color: "#fff", marginBottom: 22, fontSize: 26, fontWeight: 800 }}>
        Cashiers
      </h1>

      <div style={searchWrap}>
        <Search size={16} color="#8b87ad" />
        <input
          type="text"
          placeholder="Search cashier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInput}
        />
      </div>

      <div style={listCard}>
        {loading ? (
          <p style={{ color: "#8b87ad" }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: "#8b87ad" }}>Wax cashier ah lama helin.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((item) => (
              <div key={item.id} style={cashierRow}>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    minWidth: 46,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  {(item.fullName || "?").slice(0, 2).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 14.5 }}>
                    {item.fullName || "—"}
                  </div>
                  <div style={{ color: "#8b87ad", fontSize: 12.5, marginTop: 2 }}>
                    @{item.username || "—"}
                  </div>
                </div>

                <span style={tag}>{item.phone || "—"}</span>
                <span style={tag}>••••{item.password ? item.password.slice(-2) : ""}</span>
                <span
                  style={{
                    ...tag,
                    color: item.status === "Active" ? "#4ade80" : "#f87171",
                    borderColor:
                      item.status === "Active"
                        ? "rgba(34,197,94,0.35)"
                        : "rgba(239,68,68,0.35)",
                    background:
                      item.status === "Active"
                        ? "rgba(34,197,94,0.1)"
                        : "rgba(239,68,68,0.1)",
                  }}
                >
                  {item.status || "—"}
                </span>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openEdit(item)} style={iconBtnEdit}>
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => deleteCashier(item.id)} style={iconBtnDelete}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <h3 style={{ marginTop: 20, color: "#8b87ad", fontWeight: 500, fontSize: 14 }}>
        Total Cashiers : {filtered.length}
      </h3>

      {/* ---- Modal-ka wax-ka-bedelka cashier-ka ---- */}
      {editData && (
        <div style={overlay}>
          <div style={modal}>
            <div style={modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Wallet size={20} color="#8b6cf5" />
                <h2 style={{ color: "#fff", margin: 0, fontSize: 19 }}>
                  Wax ka bedel: {selectedCashier.fullName}
                </h2>
              </div>
              <button onClick={closeEdit} style={closeBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={modalBody}>
              <div style={grid}>
                <Field icon={User} label="Full Name">
                  <input
                    style={input}
                    value={editData.fullName}
                    onChange={(e) => handleChange("fullName", e.target.value)}
                  />
                </Field>

                <Field icon={AtSign} label="Username">
                  <input
                    style={input}
                    value={editData.username}
                    onChange={(e) => handleChange("username", e.target.value)}
                  />
                </Field>

                <Field icon={Phone} label="Phone">
                  <input
                    style={input}
                    value={editData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                  />
                </Field>

                <Field icon={Lock} label="Password">
                  <input
                    style={input}
                    value={editData.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                  />
                </Field>

                <Field icon={Mail} label="Email">
                  <input
                    style={input}
                    value={editData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                  />
                </Field>

                <Field icon={CheckCircle2} label="Status">
                  <select
                    style={input}
                    value={editData.status}
                    onChange={(e) => handleChange("status", e.target.value)}
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </Field>
              </div>
            </div>

            <div style={modalFooter}>
              <button onClick={closeEdit} style={cancelBtn}>
                Iska daa
              </button>
              <button onClick={saveEdit} disabled={saving} style={saveBtn}>
                {saving ? (
                  <>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                    Kaydinaya...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Kaydi Isbedelka
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input::placeholder { color: #6b6890; }
        select option { background: #1e1a4a; color: #ffffff; }
      `}</style>
    </div>
  );
}

function Field({ icon: Icon, label: labelText, children }) {
  return (
    <div>
      <label style={label}>
        <Icon size={15} color="#8b6cf5" />
        {labelText}
      </label>
      {children}
    </div>
  );
}

const searchWrap = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: 350,
  padding: "0 14px",
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.3)",
  background: "rgba(255,255,255,0.02)",
  marginBottom: 20,
};

const searchInput = {
  flex: 1,
  padding: "12px 0",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#e5e3f7",
  fontSize: 14,
};

const listCard = {
  background: "linear-gradient(160deg,#1c1840,#211c48)",
  borderRadius: 16,
  padding: 22,
  border: "1px solid rgba(255,255,255,0.05)",
};

const cashierRow = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "12px 16px",
  background: "rgba(255,255,255,0.02)",
  borderRadius: 12,
  border: "1px solid rgba(139,108,245,0.12)",
  flexWrap: "wrap",
};

const tag = {
  background: "rgba(139,108,245,0.12)",
  color: "#c4b5fd",
  fontSize: 12,
  padding: "6px 12px",
  borderRadius: 20,
  border: "1px solid rgba(139,108,245,0.25)",
  whiteSpace: "nowrap",
};

const iconBtnEdit = {
  background: "rgba(139,108,245,0.12)",
  border: "1px solid rgba(139,108,245,0.3)",
  color: "#8b6cf5",
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const iconBtnDelete = {
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.3)",
  color: "#f87171",
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const overlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.65)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 20,
};

const modal = {
  background: "linear-gradient(160deg,#151233,#181341)",
  border: "1px solid rgba(139,108,245,0.3)",
  borderRadius: 20,
  width: "100%",
  maxWidth: 680,
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
};

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "22px 26px",
  borderBottom: "1px solid rgba(139,108,245,0.2)",
};

const closeBtn = {
  background: "rgba(255,255,255,0.05)",
  border: "none",
  color: "#fff",
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const modalBody = {
  padding: "24px 26px",
  overflowY: "auto",
};

const modalFooter = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  padding: "18px 26px",
  borderTop: "1px solid rgba(139,108,245,0.2)",
};

const cancelBtn = {
  background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(139,108,245,0.3)",
  color: "#fff",
  padding: "12px 22px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
};

const saveBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  padding: "12px 22px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

const label = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  fontSize: 13.5,
  fontWeight: 600,
  color: "#fff",
  marginBottom: 8,
};

const input = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.3)",
  boxSizing: "border-box",
  fontSize: 14,
  color: "#e5e3f7",
  background: "rgba(255,255,255,0.02)",
  outline: "none",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "20px 24px",
};