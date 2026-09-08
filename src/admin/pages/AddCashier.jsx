import { useEffect, useMemo, useState } from "react";
import { db, storage } from "../../firebase/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

// Fiiro gaar ah: collection-ka "cashier" waxaa isla mar ahaantaan lagu
// kaydiyaa labo nooc oo xog ah — (1) accounts-ka cashier-ka (username,
// password, iwm), iyo (2) diiwaannada lacagta ardayda (studentId, iwm).
// Si loo kala saaro, waxaan halkan u isticmaaleynaa: doc-yada leh
// "username" iyo "password" oo labaduba jira waa cashier account.
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

// Bilood ka bilaabma maalinta 1aad ee bishan ilaa maanta.
function thisMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: start.toISOString().slice(0, 10), end: todayInputValue() };
}

// Bilood ka bilaabma 1/Jan ee sanadkan ilaa maanta.
function thisYearRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return { start: start.toISOString().slice(0, 10), end: todayInputValue() };
}

// N bilood oo dib u socda laga bilaabo maanta.
function lastNMonthsRange(n) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1);
  return { start: start.toISOString().slice(0, 10), end: todayInputValue() };
}

export default function AddCashier() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [loading, setLoading] = useState(false);

  // ---- Liiska Cashier-rada (hoos ka muuqda form-ka) ----
  const [cashiers, setCashiers] = useState([]);
  const [listLoading, setListLoading] = useState(true);
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
      setListLoading(true);
      const snap = await getDocs(collection(db, "cashier"));
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter(isCashierAccountDoc);
      setCashiers(list);
    } catch (err) {
      console.log(err);
    } finally {
      setListLoading(false);
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

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const saveCashier = async () => {
    if (
      fullName === "" ||
      username === "" ||
      password === "" ||
      phone === ""
    ) {
      alert("Please fill all required fields.");
      return;
    }

    try {
      setLoading(true);

      const cashierRef = doc(db, "cashier", username);

      const exists = await getDoc(cashierRef);

      if (exists.exists()) {
        alert("Username already exists.");
        setLoading(false);
        return;
      }

      let photoURL = "";
      if (photoFile) {
        const photoRef = ref(storage, `cashiers/${username}/${Date.now()}_${photoFile.name}`);
        await uploadBytes(photoRef, photoFile);
        photoURL = await getDownloadURL(photoRef);
      }

      await setDoc(cashierRef, {
        fullName,
        username,
        password,
        phone,
        email,
        photoURL,

        status: "Active",

        createdAt: serverTimestamp(),
      });

      alert("Cashier Added Successfully");

      setFullName("");
      setUsername("");
      setPassword("");
      setPhone("");
      setEmail("");
      setPhotoFile(null);
      setPhotoPreview(null);

      // Liiska hoose si toos ah u cusboonaysii — kuma baahna in bogga la refresh gareeyo.
      await fetchCashiers();
    } catch (error) {
      console.log(error);
      alert(error.message);
    }

    setLoading(false);
  };

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

  async function loadTransactions(cashierUsername, startDate, endDate) {
    try {
      setTxLoading(true);
      const snap = await getDocs(
        query(collection(db, "payments"), where("processedByUsername", "==", cashierUsername))
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
    <div
      style={{
        padding: 30,
        background: "#f5f7fb",
        minHeight: "100vh",
      }}
    >
      <h1
        style={{
          color: "#0b6b45",
          marginBottom: 25,
        }}
      >
        Add Cashier
      </h1>

      <div
        style={{
          maxWidth: 700,
          background: "#fff",
          padding: 30,
          borderRadius: 15,
          boxShadow: "0 10px 30px rgba(0,0,0,.08)",
          marginBottom: 34,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 24 }}>
          <label
            htmlFor="cashierPhoto"
            style={{
              width: 84,
              height: 84,
              minWidth: 84,
              borderRadius: "50%",
              background: photoPreview ? `url(${photoPreview}) center/cover` : "#f0f2f5",
              border: photoFile ? "2px solid #0b6b45" : "2px dashed #ccc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              overflow: "hidden",
              fontSize: 12,
              color: "#888",
              textAlign: "center",
            }}
          >
            {!photoPreview && "📷 Sawir"}
          </label>
          <input
            id="cashierPhoto"
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            style={{ display: "none" }}
          />
          <div style={{ color: "#888", fontSize: 13 }}>
            Sawirka Cashier-ka <br /> (ikhtiyaari)
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label>Full Name</label>

          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Cashier Full Name"
            style={input}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label>Username</label>

          <input
            value={username}
            onChange={(e) =>
              setUsername(
                e.target.value
                  .replace(/\s/g, "")
                  .toLowerCase()
              )
            }
            placeholder="cashier001"
            style={input}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label>Password</label>

          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            style={input}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label>Phone Number</label>

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="61xxxxxxx"
            style={input}
          />
        </div>

        <div style={{ marginBottom: 30 }}>
          <label>Email (Optional)</label>

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cashier@gmail.com"
            style={input}
          />
        </div>

        <button
          onClick={saveCashier}
          disabled={loading}
          style={{
            background: "#0b6b45",
            color: "#fff",
            border: "none",
            padding: "15px 35px",
            borderRadius: 10,
            fontSize: 17,
            cursor: "pointer",
          }}
        >
          {loading ? "Saving..." : "Save Cashier"}
        </button>
      </div>

      {/* ---- Liiska Cashier-rada oo dhan ---- */}
      <div
        style={{
          maxWidth: 1000,
          background: "#fff",
          padding: 30,
          borderRadius: 15,
          boxShadow: "0 10px 30px rgba(0,0,0,.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <h2 style={{ color: "#0b6b45", margin: 0, fontSize: 20 }}>
            Cashiers List{" "}
            <span style={{ color: "#888", fontWeight: 400, fontSize: 15 }}>
              ({filteredCashiers.length})
            </span>
          </h2>

          <input
            placeholder="Raadi magaca, username-ka ama telefoonka..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...input, marginTop: 0, maxWidth: 300 }}
          />
        </div>

        {listLoading ? (
          <p style={{ color: "#888" }}>Loading...</p>
        ) : filteredCashiers.length === 0 ? (
          <p style={{ color: "#888" }}>Wax cashier ah lama helin.</p>
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
                      width: 44,
                      height: 44,
                      minWidth: 44,
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
                    width: 44,
                    height: 44,
                    minWidth: 44,
                    borderRadius: "50%",
                    background: "#0b6b45",
                    display: photoUrl ? "none" : "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {(c.fullName || "?").slice(0, 2).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ color: "#1a1a1a", fontWeight: 600, fontSize: 14.5 }}>
                    {c.fullName || "—"}
                  </div>
                  <div style={{ color: "#888", fontSize: 12.5, marginTop: 2 }}>
                    @{c.username} · {formatDate(c.createdAt)}
                  </div>
                </div>

                <span style={tag}>{c.phone || "—"}</span>
                {c.email && <span style={tag}>{c.email}</span>}
                <span
                  style={{
                    ...tag,
                    color: c.status === "Active" ? "#0b6b45" : "#b91c1c",
                    borderColor: c.status === "Active" ? "#bfe3d0" : "#f3c1c1",
                    background: c.status === "Active" ? "#e9f9f1" : "#fdecec",
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
                    💰
                  </button>
                  <button onClick={() => openEdit(c)} title="Edit" style={iconBtnEdit}>
                    ✏️
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {editingCashier && (
        <div style={overlay} onClick={closeEdit}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h2 style={{ color: "#0b6b45", margin: 0, fontSize: 18 }}>
                Edit Cashier — {editingCashier.fullName}
              </h2>
              <button onClick={closeEdit} style={closeBtn}>
                ✕
              </button>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                <label
                  htmlFor="editCashierPhoto"
                  style={{
                    width: 64,
                    height: 64,
                    minWidth: 64,
                    borderRadius: "50%",
                    background: editPhotoPreview ? `url(${editPhotoPreview}) center/cover` : "#f0f2f5",
                    border: "2px dashed #ccc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    overflow: "hidden",
                    fontSize: 10,
                    color: "#888",
                    textAlign: "center",
                  }}
                >
                  {!editPhotoPreview && "📷"}
                </label>
                <input
                  id="editCashierPhoto"
                  type="file"
                  accept="image/*"
                  onChange={handleEditPhotoChange}
                  style={{ display: "none" }}
                />
                <div style={{ color: "#888", fontSize: 12.5 }}>Riix si aad sawir uga bedesho</div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label>Username</label>
                <input
                  value={editUsername}
                  onChange={(e) =>
                    setEditUsername(e.target.value.replace(/\s/g, "").toLowerCase())
                  }
                  style={input}
                />
              </div>
              <div>
                <label>Password</label>
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
                {savingEdit ? "Kaydinaya..." : "Kaydi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {txCashier && (
        <div style={overlay} onClick={closeTransactions}>
          <div style={{ ...modal, maxWidth: 920 }} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h2 style={{ color: "#0b6b45", margin: 0, fontSize: 18 }}>
                Lacagaha uu Qabtay — {txCashier.fullName}
              </h2>
              <button onClick={closeTransactions} style={closeBtn}>
                ✕
              </button>
            </div>

            <div style={{ padding: 24, overflowY: "auto" }}>
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
                  <label>Laga bilaabo</label>
                  <input
                    type="date"
                    value={txStartDate}
                    onChange={(e) => setTxStartDate(e.target.value)}
                    style={input}
                  />
                </div>
                <div style={{ flex: "1 1 160px" }}>
                  <label>Ilaa</label>
                  <input
                    type="date"
                    value={txEndDate}
                    onChange={(e) => setTxEndDate(e.target.value)}
                    style={input}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button onClick={applyTxFilter} style={{ ...saveBtn, height: 46 }}>
                    Raadi
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: "#e9f9f1",
                  border: "1px solid #bfe3d0",
                  borderRadius: 12,
                  padding: "14px 18px",
                  marginBottom: 18,
                }}
              >
                <div style={{ color: "#0b6b45", fontWeight: 800, fontSize: 20 }}>
                  ${txTotal.toLocaleString()}
                </div>
                <div style={{ color: "#888", fontSize: 12.5 }}>
                  Wadarta lacagta ({txRecords.length} transaction)
                </div>
              </div>

              {txLoading ? (
                <p style={{ color: "#888" }}>Loading...</p>
              ) : txRecords.length === 0 ? (
                <p style={{ color: "#888" }}>
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
                        <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                          <td style={td}>{formatDate(r.createdAt)}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{r.studentName || "—"}</td>
                          <td style={td}>{r.className || "—"}</td>
                          <td style={td}>{r.monthLabel || r.monthKey || "—"}</td>
                          <td style={{ ...td, color: "#0b6b45", fontWeight: 700 }}>
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
    </div>
  );
}

const input = {
  width: "100%",
  padding: 13,
  marginTop: 7,
  borderRadius: 8,
  border: "1px solid #ccc",
  fontSize: 16,
  boxSizing: "border-box",
};

const cashierRow = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "12px 16px",
  background: "#fafbfc",
  borderRadius: 12,
  border: "1px solid #eee",
  flexWrap: "wrap",
};

const tag = {
  display: "inline-flex",
  alignItems: "center",
  background: "#f0f2f5",
  color: "#444",
  fontSize: 12,
  padding: "6px 12px",
  borderRadius: 20,
  border: "1px solid #e2e5ea",
  whiteSpace: "nowrap",
};

const iconBtnEdit = {
  background: "#eef2ff",
  border: "1px solid #c7d2fe",
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  fontSize: 14,
};

const iconBtnTx = {
  background: "#e9f9f1",
  border: "1px solid #bfe3d0",
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  fontSize: 14,
};

const overlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 20,
};

const modal = {
  background: "#fff",
  borderRadius: 16,
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
  padding: "20px 24px",
  borderBottom: "1px solid #eee",
};

const closeBtn = {
  background: "#f0f2f5",
  border: "none",
  width: 32,
  height: 32,
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
};

const modalFooter = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  padding: "16px 24px",
  borderTop: "1px solid #eee",
};

const cancelBtn = {
  background: "#f0f2f5",
  border: "1px solid #ddd",
  color: "#333",
  padding: "12px 22px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
};

const saveBtn = {
  background: "#0b6b45",
  color: "#fff",
  border: "none",
  padding: "12px 22px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

const quickBtn = {
  background: "#eef2ff",
  border: "1px solid #c7d2fe",
  color: "#3730a3",
  padding: "8px 14px",
  borderRadius: 20,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 12.5,
};

const th = {
  textAlign: "left",
  padding: "10px 12px",
  color: "#888",
  fontSize: 11.5,
  fontWeight: 700,
  whiteSpace: "nowrap",
  borderBottom: "1px solid #eee",
};

const td = {
  padding: "10px 12px",
  color: "#1a1a1a",
  whiteSpace: "nowrap",
};