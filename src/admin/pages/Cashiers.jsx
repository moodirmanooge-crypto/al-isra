import { useEffect, useMemo, useState } from "react";
import { db, storage } from "../../firebase/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import {
  Users,
  Pencil,
  X,
  Save,
  Loader2,
  Receipt,
  Search,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Camera,
} from "lucide-react";

// Fiiro gaar ah: collection-ka "cashier" waxaa isla mar ahaantaan lagu
// kaydiyaa labo nooc oo xog ah — (1) accounts-ka cashier-ka (username,
// password, iwm — laga sameeyay AddCashier.jsx), iyo (2) diiwaannada
// lacagta ardayda (studentId, monthlyFee, iwm — laga sameeyay AddStudent.jsx
// /BulkRegistration.jsx/ImportStudent.jsx). Si loo kala saaro, waxaan
// halkan u isticmaaleynaa: doc-yada leh "username" iyo "password" oo labaduba
// jira waa cashier account, kuwa kale (leh studentId) waa xogta ardayda.
function isCashierAccountDoc(data) {
  return !!(data && data.username && data.password && !data.studentId);
}

function formatDate(ts) {
  if (!ts) return "—";
  let d;
  if (typeof ts?.toDate === "function") d = ts.toDate();
  else if (ts?.seconds) d = new Date(ts.seconds * 1000);
  else d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
}

function toDateInputValue(ts) {
  if (!ts) return "";
  let d;
  if (typeof ts?.toDate === "function") d = ts.toDate();
  else if (ts?.seconds) d = new Date(ts.seconds * 1000);
  else d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function getCashierPhotoUrl(cashier) {
  const raw = cashier?.photoURL || "";
  return typeof raw === "string" ? raw.trim() : "";
}

function thisMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: start.toISOString().slice(0, 10), end: todayInputValue() };
}

function thisYearRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return { start: start.toISOString().slice(0, 10), end: todayInputValue() };
}

function lastNMonthsRange(n) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1);
  return { start: start.toISOString().slice(0, 10), end: todayInputValue() };
}

export default function Cashiers() {
  const [cashiers, setCashiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [editingCashier, setEditingCashier] = useState(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editPhotoFile, setEditPhotoFile] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [txCashier, setTxCashier] = useState(null);
  const [txStartDate, setTxStartDate] = useState("");
  const [txEndDate, setTxEndDate] = useState("");
  const [txLoading, setTxLoading] = useState(false);
  const [txRecords, setTxRecords] = useState([]);

  useEffect(() => {
    fetchCashiers();
  }, []);

  async function fetchCashiers() {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "cashier"));
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter(isCashierAccountDoc);
      setCashiers(list);
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay marka cashier-rada la soo qaadanayay: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredCashiers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cashiers;
    return cashiers.filter(
      (c) =>
        (c.fullName || "").toLowerCase().includes(q) ||
        (c.username || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q)
    );
  }, [cashiers, search]);

  function openEdit(cashier) {
    setEditingCashier(cashier);
    setEditUsername(cashier.username || "");
    setEditPassword(cashier.password || "");
    setEditPhotoFile(null);
    setEditPhotoPreview(getCashierPhotoUrl(cashier) || null);
  }

  function closeEdit() {
    setEditingCashier(null);
    setEditUsername("");
    setEditPassword("");
    setEditPhotoFile(null);
    setEditPhotoPreview(null);
  }

  function handleEditPhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setEditPhotoFile(file);
    setEditPhotoPreview(URL.createObjectURL(file));
  }

  async function saveEdit() {
    if (!editingCashier) return;
    const newUsername = editUsername.trim().replace(/\s/g, "").toLowerCase();
    const newPassword = editPassword;

    if (!newUsername) {
      alert("Fadlan geli Username sax ah.");
      return;
    }
    if (!newPassword) {
      alert("Fadlan geli Password sax ah.");
      return;
    }

    const oldUsername = editingCashier.username;
    const usernameChanged = newUsername !== oldUsername;

    try {
      setSavingEdit(true);

      let photoURL = editingCashier.photoURL || "";
      if (editPhotoFile) {
        const photoRef = ref(
          storage,
          `cashiers/${newUsername}/${Date.now()}_${editPhotoFile.name}`
        );
        await uploadBytes(photoRef, editPhotoFile);
        photoURL = await getDownloadURL(photoRef);
      }

      if (usernameChanged) {
        // Username-ku waa doc ID-ga — Firestore lama "rename" gareyn karo
        // toos ahaan, waa in doc cusub la sameeyaa oo kii hore la tirtiraa.
        const existing = await getDoc(doc(db, "cashier", newUsername));
        if (existing.exists()) {
          alert(`Username-ka "${newUsername}" horeyba u jiray. Fadlan mid kale isticmaal.`);
          setSavingEdit(false);
          return;
        }

        const { id, ...oldData } = editingCashier;
        await setDoc(doc(db, "cashier", newUsername), {
          ...oldData,
          username: newUsername,
          password: newPassword,
          photoURL,
          updatedAt: serverTimestamp(),
        });
        await deleteDoc(doc(db, "cashier", oldUsername));

        setCashiers((prev) =>
          prev.map((c) =>
            c.id === oldUsername
              ? {
                  ...c,
                  id: newUsername,
                  username: newUsername,
                  password: newPassword,
                  photoURL,
                }
              : c
          )
        );
      } else {
        await updateDoc(doc(db, "cashier", oldUsername), {
          password: newPassword,
          photoURL,
          updatedAt: serverTimestamp(),
        });
        setCashiers((prev) =>
          prev.map((c) =>
            c.id === oldUsername ? { ...c, password: newPassword, photoURL } : c
          )
        );
      }

      alert("Xogta Cashier-ka waa la cusboonaysiiyay.");
      closeEdit();
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay: " + err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function openTransactions(cashier) {
    setTxCashier(cashier);
    const startDefault = toDateInputValue(cashier.createdAt) || "";
    setTxStartDate(startDefault);
    setTxEndDate(todayInputValue());
    await loadTransactions(cashier.username, startDefault, todayInputValue());
  }

  function closeTransactions() {
    setTxCashier(null);
    setTxRecords([]);
  }

  async function loadTransactions(username, startDate, endDate) {
    try {
      setTxLoading(true);
      const snap = await getDocs(
        query(collection(db, "payments"), where("processedByUsername", "==", username))
      );

      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => {
          const createdDate = toDateInputValue(r.createdAt);
          if (!createdDate) return false;
          if (startDate && createdDate < startDate) return false;
          if (endDate && createdDate > endDate) return false;
          return true;
        })
        .sort((a, b) => {
          const at = a.createdAt?.seconds || 0;
          const bt = b.createdAt?.seconds || 0;
          return bt - at;
        });

      setTxRecords(list);
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay marka lacagaha la soo qaadanayay: " + err.message);
    } finally {
      setTxLoading(false);
    }
  }

  function applyTxFilter() {
    if (!txCashier) return;
    loadTransactions(txCashier.username, txStartDate, txEndDate);
  }

  function applyQuickRange(range) {
    if (!txCashier) return;
    setTxStartDate(range.start);
    setTxEndDate(range.end);
    loadTransactions(txCashier.username, range.start, range.end);
  }

  const txTotal = useMemo(
    () => txRecords.reduce((sum, r) => sum + Number(r.paidAmount || 0), 0),
    [txRecords]
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="Cashiers" />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <h1 style={{ color: "#fff", marginBottom: 22, fontSize: 26, fontWeight: 800 }}>
            Cashiers
          </h1>

          <div style={{ display: "flex", gap: 15, marginBottom: 25, flexWrap: "wrap" }}>
            <div style={searchWrap}>
              <Search size={16} color="#8b87ad" />
              <input
                placeholder="Raadi magaca, username-ka ama telefoonka..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={searchInput}
              />
            </div>
          </div>

          <div style={listCard}>
            <h3 style={{ color: "#fff", margin: "0 0 16px", fontSize: 17 }}>
              Cashiers List{" "}
              <span style={{ color: "#8b87ad", fontWeight: 400, fontSize: 14 }}>
                ({filteredCashiers.length})
              </span>
            </h3>

            {loading ? (
              <p style={{ color: "#8b87ad" }}>Loading...</p>
            ) : filteredCashiers.length === 0 ? (
              <p style={{ color: "#8b87ad" }}>Wax cashier ah lama helin.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredCashiers.map((c) => {
                  const photoUrl = getCashierPhotoUrl(c);
                  return (
                  <div key={c.id} style={cashierRow}>
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={c.fullName || "Cashier"}
                        style={{
                          width: 46,
                          height: 46,
                          minWidth: 46,
                          borderRadius: "50%",
                          objectFit: "cover",
                          display: "block",
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.nextSibling.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        minWidth: 46,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                        display: photoUrl ? "none" : "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                    >
                      {(c.fullName || "?").slice(0, 2).toUpperCase()}
                    </div>

                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ color: "#fff", fontWeight: 600, fontSize: 14.5 }}>
                        {c.fullName || "—"}
                      </div>
                      <div style={{ color: "#8b87ad", fontSize: 12.5, marginTop: 2 }}>
                        @{c.username} · {formatDate(c.createdAt)}
                      </div>
                    </div>

                    <span style={tag}>
                      <Phone size={12} style={{ marginRight: 5 }} />
                      {c.phone || "—"}
                    </span>
                    {c.email && (
                      <span style={tag}>
                        <Mail size={12} style={{ marginRight: 5 }} />
                        {c.email}
                      </span>
                    )}
                    <span
                      style={{
                        ...tag,
                        color: c.status === "Active" ? "#4ade80" : "#f87171",
                        borderColor:
                          c.status === "Active"
                            ? "rgba(74,222,128,0.3)"
                            : "rgba(239,68,68,0.3)",
                        background:
                          c.status === "Active"
                            ? "rgba(74,222,128,0.1)"
                            : "rgba(239,68,68,0.1)",
                      }}
                    >
                      {c.status || "Active"}
                    </span>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => openTransactions(c)}
                        title="Fiiri Lacagaha uu Qabtay"
                        style={iconBtnTx}
                      >
                        <Receipt size={15} />
                      </button>
                      <button onClick={() => openEdit(c)} title="Edit" style={iconBtnEdit}>
                        <Pencil size={15} />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {editingCashier && (
        <div style={overlay} onClick={closeEdit}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Users size={20} color="#8b6cf5" />
                <h2 style={{ color: "#fff", margin: 0, fontSize: 18 }}>
                  Edit Cashier — {editingCashier.fullName}
                </h2>
              </div>
              <button onClick={closeEdit} style={closeBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={modalBody}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                <label
                  htmlFor="editCashierPhoto"
                  style={{
                    width: 64,
                    height: 64,
                    minWidth: 64,
                    borderRadius: "50%",
                    background: editPhotoPreview
                      ? `url(${editPhotoPreview}) center/cover`
                      : "rgba(139,108,245,0.08)",
                    border: "2px dashed rgba(139,108,245,0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    overflow: "hidden",
                  }}
                >
                  {!editPhotoPreview && <Camera color="#8b6cf5" size={22} />}
                </label>
                <input
                  id="editCashierPhoto"
                  type="file"
                  accept="image/*"
                  onChange={handleEditPhotoChange}
                  style={{ display: "none" }}
                />
                <div style={{ color: "#8b87ad", fontSize: 12.5 }}>
                  Riix si aad sawir uga bedesho
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={label}>Username</label>
                <input
                  value={editUsername}
                  onChange={(e) =>
                    setEditUsername(e.target.value.replace(/\s/g, "").toLowerCase())
                  }
                  style={input}
                />
              </div>
              <div>
                <label style={label}>Password</label>
                <input
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  style={input}
                />
              </div>
            </div>

            <div style={modalFooter}>
              <button onClick={closeEdit} style={cancelBtn}>
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                style={{
                  ...saveBtn,
                  opacity: savingEdit ? 0.7 : 1,
                  cursor: savingEdit ? "not-allowed" : "pointer",
                }}
              >
                {savingEdit ? (
                  <>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                    Kaydinaya...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Kaydi
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {txCashier && (
        <div style={overlay} onClick={closeTransactions}>
          <div style={{ ...modal, maxWidth: 920 }} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Receipt size={20} color="#8b6cf5" />
                <h2 style={{ color: "#fff", margin: 0, fontSize: 18 }}>
                  Lacagaha uu Qabtay — {txCashier.fullName}
                </h2>
              </div>
              <button onClick={closeTransactions} style={closeBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={modalBody}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                <button onClick={() => applyQuickRange(thisMonthRange())} style={quickBtn}>
                  Bishan
                </button>
                <button onClick={() => applyQuickRange(thisYearRange())} style={quickBtn}>
                  Sanadkan
                </button>
                <button onClick={() => applyQuickRange(lastNMonthsRange(3))} style={quickBtn}>
                  3 Bilood
                </button>
                <button onClick={() => applyQuickRange(lastNMonthsRange(6))} style={quickBtn}>
                  6 Bilood
                </button>
                <button
                  onClick={() =>
                    applyQuickRange({
                      start: toDateInputValue(txCashier.createdAt) || "",
                      end: todayInputValue(),
                    })
                  }
                  style={quickBtn}
                >
                  Tan iyo bilowgii
                </button>
              </div>

              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
                <div style={{ flex: "1 1 160px" }}>
                  <label style={label}>
                    <Calendar size={13} style={{ marginRight: 5 }} />
                    Laga bilaabo
                  </label>
                  <input
                    type="date"
                    value={txStartDate}
                    onChange={(e) => setTxStartDate(e.target.value)}
                    style={input}
                  />
                </div>
                <div style={{ flex: "1 1 160px" }}>
                  <label style={label}>
                    <Calendar size={13} style={{ marginRight: 5 }} />
                    Ilaa
                  </label>
                  <input
                    type="date"
                    value={txEndDate}
                    onChange={(e) => setTxEndDate(e.target.value)}
                    style={input}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button onClick={applyTxFilter} style={{ ...saveBtn, height: 46 }}>
                    <Search size={15} />
                    Raadi
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "rgba(74,222,128,0.08)",
                  border: "1px solid rgba(74,222,128,0.25)",
                  borderRadius: 12,
                  padding: "14px 18px",
                  marginBottom: 18,
                }}
              >
                <DollarSign size={20} color="#4ade80" />
                <div>
                  <div style={{ color: "#4ade80", fontWeight: 800, fontSize: 20 }}>
                    ${txTotal.toLocaleString()}
                  </div>
                  <div style={{ color: "#8b87ad", fontSize: 12.5 }}>
                    Wadarta lacagta ({txRecords.length} transaction)
                  </div>
                </div>
              </div>

              {txLoading ? (
                <p style={{ color: "#8b87ad" }}>Loading...</p>
              ) : txRecords.length === 0 ? (
                <p style={{ color: "#8b87ad" }}>
                  Wax transaction ah lama helin xilligan la doortay.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={th}>Taariikhda</th>
                        <th style={th}>Ardayga</th>
                        <th style={th}>Class</th>
                        <th style={th}>Bisha</th>
                        <th style={th}>Lacagta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txRecords.map((r) => (
                        <tr key={r.id} style={{ borderTop: "1px solid rgba(139,108,245,0.12)" }}>
                          <td style={td}>{formatDate(r.createdAt)}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{r.studentName || "—"}</td>
                          <td style={td}>{r.className || "—"}</td>
                          <td style={td}>{r.monthLabel || r.monthKey || "—"}</td>
                          <td style={{ ...td, color: "#4ade80", fontWeight: 700 }}>
                            ${Number(r.paidAmount || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
      `}</style>
    </div>
  );
}

const searchWrap = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: 340,
  padding: "0 14px",
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.3)",
  background: "rgba(255,255,255,0.02)",
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
  marginTop: 6,
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
  display: "inline-flex",
  alignItems: "center",
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

const iconBtnTx = {
  background: "rgba(74,222,128,0.12)",
  border: "1px solid rgba(74,222,128,0.3)",
  color: "#4ade80",
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
  maxWidth: 520,
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
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

const quickBtn = {
  background: "rgba(139,108,245,0.12)",
  border: "1px solid rgba(139,108,245,0.3)",
  color: "#c4b5fd",
  padding: "8px 14px",
  borderRadius: 20,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 12.5,
};

const label = {
  display: "flex",
  alignItems: "center",
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

const th = {
  textAlign: "left",
  padding: "10px 12px",
  color: "#8b87ad",
  fontSize: 11.5,
  fontWeight: 700,
  whiteSpace: "nowrap",
  borderBottom: "1px solid rgba(139,108,245,0.2)",
};

const td = {
  padding: "10px 12px",
  color: "#e5e3f7",
  whiteSpace: "nowrap",
};