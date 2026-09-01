// src/admin/pages/Receipts.jsx
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { Search, Printer, X, Receipt as ReceiptIcon, Trash2, PrinterCheck } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import schoolLogo from "../assets/logo.png";
import principalSignature from "../assets/signature-principal.png";

const SCHOOL_NAME_LINE1 = "DUGSIGA HOOSE / DHEXE &";
const SCHOOL_LOCATION = "Mogadishu - Somalia";
const SCHOOL_PHONES = "858516 / 0615860629 / 0617636461 / 0617536461";
const SCHOOL_EMAIL = "israpp@hotmail.com";

// 1 USD = 28 So Sh — isla xisaabinta ReceiptModal.jsx
const USD_TO_SOS_RATE = 28;

function formatDate(value) {
  if (!value) return "—";
  const d = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ---- Amount -> Words (English) ----
const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function threeDigitsToWords(n) {
  let str = "";
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + " Hundred ";
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + " ";
    n %= 10;
  }
  if (n > 0) {
    str += ONES[n] + " ";
  }
  return str.trim();
}

function integerToWords(num) {
  if (num === 0) return "Zero";
  const parts = [];
  const million = Math.floor(num / 1000000);
  const thousand = Math.floor((num % 1000000) / 1000);
  const rest = num % 1000;

  if (million) parts.push(`${threeDigitsToWords(million)} Million`);
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (rest) parts.push(threeDigitsToWords(rest));

  return parts.join(" ").trim();
}

function amountToWords(amount) {
  const num = Number(amount) || 0;
  const dollars = Math.floor(num);
  const cents = Math.round((num - dollars) * 100);

  let words = `${integerToWords(dollars)} Dollar${dollars === 1 ? "" : "s"}`;
  if (cents > 0) {
    words += ` and ${integerToWords(cents)} Cent${cents === 1 ? "" : "s"}`;
  }
  return words;
}

const cardStyle = {
  background: "#fff",
  borderRadius: 18,
  boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
  border: "1px solid rgba(17,24,39,0.05)",
};

export default function Receipts() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null); // { type: "one"|"all", receipt? }
  const [deletingAll, setDeletingAll] = useState(false);
  const [printAllOpen, setPrintAllOpen] = useState(false);

  useEffect(() => {
    fetchReceipts();
  }, []);

  async function fetchReceipts() {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "receipts"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const at = a.createdAt?.seconds || 0;
        const bt = b.createdAt?.seconds || 0;
        if (bt !== at) return bt - at;
        return String(b.receiptNo).localeCompare(String(a.receiptNo));
      });
      setReceipts(list);
    } catch (err) {
      console.error("Khalad ayaa dhacay markii rasiidhada la soo qaadanayay:", err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter((r) => {
      return (
        String(r.receiptNo || "").toLowerCase().includes(q) ||
        String(r.studentName || "").toLowerCase().includes(q) ||
        String(r.studentId || "").toLowerCase().includes(q) ||
        String(r.className || "").toLowerCase().includes(q) ||
        String(r.monthLabel || "").toLowerCase().includes(q)
      );
    });
  }, [receipts, query]);

  const totalCollected = useMemo(
    () => filtered.reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0),
    [filtered]
  );

  function askDeleteOne(receipt) {
    setConfirmTarget({ type: "one", receipt });
  }

  function askDeleteAll() {
    if (filtered.length === 0) return;
    setConfirmTarget({ type: "all" });
  }

  async function confirmDelete() {
    if (!confirmTarget) return;

    if (confirmTarget.type === "one") {
      const receipt = confirmTarget.receipt;
      try {
        setDeletingId(receipt.id);
        await deleteDoc(doc(db, "receipts", receipt.id));
        setReceipts((prev) => prev.filter((r) => r.id !== receipt.id));
        if (selected?.id === receipt.id) setSelected(null);
        setConfirmTarget(null);
      } catch (err) {
        console.error("Khalad ayaa dhacay markii rasiidka la tirtirayay:", err);
        alert("Khalad ayaa dhacay: " + err.message);
      } finally {
        setDeletingId(null);
      }
    } else {
      try {
        setDeletingAll(true);
        const idsToDelete = filtered.map((r) => r.id);
        await Promise.all(idsToDelete.map((id) => deleteDoc(doc(db, "receipts", id))));
        setReceipts((prev) => prev.filter((r) => !idsToDelete.includes(r.id)));
        if (selected && idsToDelete.includes(selected.id)) setSelected(null);
        setConfirmTarget(null);
      } catch (err) {
        console.error("Khalad ayaa dhacay markii dhammaan rasiidhada la tirtirayay:", err);
        alert("Khalad ayaa dhacay: " + err.message);
      } finally {
        setDeletingAll(false);
      }
    }
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#F3F4F8",
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}
    >
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "22px 26px 0" }}>
          <Topbar />
        </div>

        <div style={{ padding: "26px 30px" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 14,
              marginBottom: 22,
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#111827" }}>
                Receipts
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "#6B7280" }}>
                Dhammaan rasiidhada lacagaha ee laga bixiyay AL-ISRA PRIMARY & SECONDARY SCHOOL
              </p>
            </div>

            <div
              style={{
                ...cardStyle,
                padding: "12px 20px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: "#E6F5EC",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ReceiptIcon size={19} color="#16a34a" />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>
                  {query ? "Natiijooyinka" : "Wadarta"} Rasiidhada
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
                  {filtered.length}
                </div>
              </div>
              <div style={{ width: 1, height: 30, background: "#F3F4F6" }} />
              <div>
                <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>Wadarta Lacagta</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#16a34a" }}>
                  ${totalCollected.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div
            style={{
              ...cardStyle,
              padding: "14px 18px",
              marginBottom: 20,
              display: "flex",
              gap: 14,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#F9FAFB",
                border: "1px solid #F3F4F6",
                borderRadius: 12,
                padding: "10px 14px",
                flex: 1,
                minWidth: 220,
              }}
            >
              <Search size={16} color="#9CA3AF" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Raadi lambarka rasiidka, magaca ardayga, ID-ga, fasalka, ama bisha..."
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  flex: 1,
                  fontSize: 13.5,
                  color: "#111827",
                }}
              />
              {query && (
                <X
                  size={16}
                  color="#9CA3AF"
                  style={{ cursor: "pointer" }}
                  onClick={() => setQuery("")}
                />
              )}
            </div>

            {filtered.length > 0 && (
              <>
                <button
                  onClick={() => setPrintAllOpen(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    border: "1px solid #93C5FD",
                    background: "#EFF6FF",
                    color: "#2563EB",
                    fontWeight: 700,
                    fontSize: 12.5,
                    padding: "10px 16px",
                    borderRadius: 10,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <PrinterCheck size={14} />
                  Daabac Dhammaan Rasiidhada
                </button>

                <button
                  onClick={askDeleteAll}
                  disabled={deletingAll}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    border: "1px solid #FCA5A5",
                    background: "#FEF2F2",
                    color: "#DC2626",
                    fontWeight: 700,
                    fontSize: 12.5,
                    padding: "10px 16px",
                    borderRadius: 10,
                    cursor: deletingAll ? "not-allowed" : "pointer",
                    opacity: deletingAll ? 0.7 : 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  <Trash2 size={14} />
                  {deletingAll ? "Tirtiraya..." : "Tirtir Dhammaan"}
                </button>
              </>
            )}
          </div>

          {/* Table */}
          <div style={{ ...cardStyle, padding: "20px 22px", overflowX: "auto" }}>
            {loading && (
              <p style={{ fontSize: 13, color: "#9CA3AF", padding: "20px 0", textAlign: "center" }}>
                Soo dejinaya rasiidhada...
              </p>
            )}

            {!loading && filtered.length === 0 && (
              <p style={{ fontSize: 13, color: "#9CA3AF", padding: "20px 0", textAlign: "center" }}>
                {query ? "Wax rasiid ah oo la mid ah lama helin." : "Rasiid lama helin weli."}
              </p>
            )}

            {!loading && filtered.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 700 }}>
                <thead>
                  <tr style={{ color: "#9CA3AF", textAlign: "left" }}>
                    <th style={{ fontWeight: 600, paddingBottom: 10 }}>No</th>
                    <th style={{ fontWeight: 600, paddingBottom: 10 }}>Student ID</th>
                    <th style={{ fontWeight: 600, paddingBottom: 10 }}>Student</th>
                    <th style={{ fontWeight: 600, paddingBottom: 10 }}>Class</th>
                    <th style={{ fontWeight: 600, paddingBottom: 10 }}>Month</th>
                    <th style={{ fontWeight: 600, paddingBottom: 10 }}>Date</th>
                    <th style={{ fontWeight: 600, paddingBottom: 10 }}>Amount</th>
                    <th style={{ fontWeight: 600, paddingBottom: 10 }}></th>
                    <th style={{ fontWeight: 600, paddingBottom: 10 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "10px 0", fontWeight: 700, color: "#111827" }}>
                        {r.receiptNo}
                      </td>
                      <td style={{ color: "#6B7280" }}>{r.studentId || "—"}</td>
                      <td style={{ color: "#111827", fontWeight: 600 }}>{r.studentName || "—"}</td>
                      <td style={{ color: "#6B7280" }}>{r.className || "—"}</td>
                      <td style={{ color: "#6B7280" }}>{r.monthLabel || "—"}</td>
                      <td style={{ color: "#6B7280" }}>{formatDate(r.paidAt || r.createdAt)}</td>
                      <td style={{ color: "#16a34a", fontWeight: 700 }}>
                        ${Number(r.paidAmount || 0).toLocaleString()}
                      </td>
                      <td>
                        <button
                          onClick={() => setSelected(r)}
                          style={{
                            border: "none",
                            background: "#E6F5EC",
                            color: "#16a34a",
                            fontWeight: 700,
                            fontSize: 12,
                            padding: "6px 12px",
                            borderRadius: 8,
                            cursor: "pointer",
                          }}
                        >
                          View
                        </button>
                      </td>
                      <td>
                        <button
                          onClick={() => askDeleteOne(r)}
                          disabled={deletingId === r.id}
                          style={{
                            border: "none",
                            background: "#FEF2F2",
                            color: "#DC2626",
                            fontWeight: 700,
                            fontSize: 12,
                            padding: "6px 10px",
                            borderRadius: 8,
                            cursor: deletingId === r.id ? "not-allowed" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <ReceiptViewModal
          receipt={selected}
          onClose={() => setSelected(null)}
          onDelete={() => askDeleteOne(selected)}
          deleting={deletingId === selected.id}
        />
      )}

      {printAllOpen && (
        <PrintAllModal receipts={filtered} onClose={() => setPrintAllOpen(false)} />
      )}

      {confirmTarget && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3000,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              width: 360,
              maxWidth: "90%",
              fontFamily: "'Inter','Segoe UI',sans-serif",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, color: "#111827" }}>Xaqiiji Tirtiridda</h3>
            <p style={{ fontSize: 13.5, color: "#6B7280", marginTop: 10, lineHeight: 1.6 }}>
              {confirmTarget.type === "one" ? (
                <>
                  Ma hubtaa inaad tirtirto rasiidka{" "}
                  <strong style={{ color: "#111827" }}>
                    {confirmTarget.receipt.receiptNo}
                  </strong>
                  ? Tallaabadan lama soo celin karo.
                </>
              ) : (
                <>
                  Ma hubtaa inaad tirtirto dhammaan{" "}
                  <strong style={{ color: "#111827" }}>{filtered.length}</strong> rasiid?
                  Tallaabadan lama soo celin karo.
                </>
              )}
            </p>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setConfirmTarget(null)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "1px solid #E5E7EB",
                  background: "#fff",
                  color: "#374151",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Jooji
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingId !== null || deletingAll}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "none",
                  background: "#DC2626",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: deletingId !== null || deletingAll ? "not-allowed" : "pointer",
                  opacity: deletingId !== null || deletingAll ? 0.7 : 1,
                }}
              >
                {deletingAll || deletingId ? "Tirtiraya..." : "Haa, Tirtir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Shaqada guud ee ku dhawaajinaysa lambar -> ereyo, isla midka
// ReceiptModal.jsx, si Amount-ka la muujiyo "Seventeen Dollars Only" iwm. ----
function ReceiptVoucherBody({ receipt, prefix }) {
  const paidDate = receipt.paidAt?.seconds
    ? new Date(receipt.paidAt.seconds * 1000)
    : receipt.createdAt?.seconds
    ? new Date(receipt.createdAt.seconds * 1000)
    : new Date();

  const usdAmount = Number(receipt.paidAmount) || 0;
  const sosAmount = Math.round(usdAmount * USD_TO_SOS_RATE);
  const amountWords = amountToWords(usdAmount);
  const isEvc = true;
  const p = prefix;

  return (
    <div className={`${p}-frame`}>
      <div className={`${p}-outer`}>
        <div className={`${p}-top`}>
          <img src={schoolLogo} alt="Logo" className={`${p}-logo`} />

          <div className={`${p}-school-block`}>
            <div className={`${p}-school-line1`}>{SCHOOL_NAME_LINE1}</div>
            <div className={`${p}-school-line2`}>
              SARE EE <span className={`${p}-school-emph`}>AL-ISRA</span>
            </div>
            <div className={`${p}-school-location`}>— {SCHOOL_LOCATION} —</div>
            <div className={`${p}-contact`}>
              ☎ {SCHOOL_PHONES} &nbsp;|&nbsp; ✉ {SCHOOL_EMAIL}
            </div>
          </div>

          <div className={`${p}-id-box`}>
            <div className={`${p}-id-label`}>STUDENT ID</div>
            <div className={`${p}-id-value`}>{receipt.studentId || ""}</div>
          </div>
        </div>

        <div className={`${p}-divider`} />

        <div className={`${p}-body`}>
          <div className={`${p}-voucher-row`}>
            <div className={`${p}-voucher-title`}>
              <span className={`${p}-slashes`}>///</span> RECEIPT VOUCHER
              <div className={`${p}-voucher-sub`}>(Warqadda Lacag Qaabashada)</div>
            </div>
            <div className={`${p}-no`}>
              No: <span className={`${p}-no-value`}>{receipt.receiptNo}</span>
            </div>
          </div>

          <div className={`${p}-field`}>
            <span className={`${p}-label`}>Date:</span>
            <span className={`${p}-value`}>{formatDate(paidDate)}</span>
          </div>

          <div className={`${p}-field-block`}>
            <div className={`${p}-field-top`}>
              <span className={`${p}-label`}>Received from:</span>
              <span className={`${p}-value ${p}-value-strong`}>{receipt.studentName || "—"}</span>
            </div>
            <div className={`${p}-field-caption`}>(Laga quaday)</div>
          </div>

          <div className={`${p}-amount-block`}>
            <div className={`${p}-amount-top`}>
              <span className={`${p}-label`}>Amount of So Sh.</span>
              <span className={`${p}-amount-box-sos`}>{sosAmount.toLocaleString()}</span>
              <span className={`${p}-usd-group`}>
                <span className={`${p}-usd-tag`}>US$</span>
                <span className={`${p}-amount-box-usd`}>{usdAmount}</span>
              </span>
            </div>
            <div className={`${p}-field-caption`}>(Lacag dhan)</div>
          </div>

          <div className={`${p}-field`}>
            <span className={`${p}-label`}>
              In words <em>(Eray ahaan)</em>:
            </span>
            <span className={`${p}-value`}>{amountWords} Only</span>
          </div>

          <div className={`${p}-being-row`}>
            <div className={`${p}-being-of`}>
              <span className={`${p}-label`}>
                Being of: <em>(Taasoo ah)</em>:
              </span>
              <span className={`${p}-value`}>Monthly Fee — {receipt.monthLabel || "—"}</span>
            </div>
            <div className={`${p}-side-fields`}>
              <div className={`${p}-field-inline`}>
                <span className={`${p}-label`}>Class:</span>
                <span className={`${p}-value`}>{receipt.className || "—"}</span>
              </div>
              <div className={`${p}-field-inline`}>
                <span className={`${p}-label`}>Tel.</span>
                <span className={`${p}-value`}>{receipt.studentPhone || "—"}</span>
              </div>
            </div>
          </div>

          <div className={`${p}-bottom-row`}>
            <div className={`${p}-payment-method`}>
              <span className={`${p}-method-tag`}>PAYMENT METHOD</span>
              <span className={`${p}-evc-label`}>EVC</span>
              <span className={`${p}-evc-box`}>{isEvc ? "✓" : ""}</span>
            </div>

            <img src={schoolLogo} alt="Stamp" className={`${p}-stamp`} />

            <div className={`${p}-signature`}>
              <div className={`${p}-sig-title`}>PRINCIPAL SIGNATURE</div>
              <img src={principalSignature} alt="Principal Signature" className={`${p}-sig-img`} />
              <div className={`${p}-sig-line`} />
            </div>
          </div>
        </div>

        <div className={`${p}-footer-note`}>
          <span className={`${p}-footer-icon`}>!</span> N.B. Not refundable.
        </div>
      </div>
    </div>
  );
}

// Isticmaalka style-ka guud ee sanduuqa rasiidka — isku mid u ah dhammaan
// class prefix-yada (rv- daawasho, mc- daabac-dhammaan) sida qiimaha loo
// gaarsiiyay via `prefix`. Waxaan ku daray hal template si loo yareeyo
// isku celcelin — style-ka waxaa lagu qoraa CSS custom properties.
function receiptVoucherCss(p, { fontScale = 1, compact = false } = {}) {
  const f = (px) => `${(px * fontScale).toFixed(2)}px`;
  return `
    .${p}-frame {
      border: ${compact ? 1.2 : 2}px solid #0b1f4d;
      padding: ${compact ? 3 : 6}px;
      height: 100%;
      box-sizing: border-box;
    }
    .${p}-outer {
      border: ${compact ? 1.8 : 3}px solid #0b1f4d;
      padding: ${compact ? "10px 12px" : "16px 18px"};
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
    }
    .${p}-top { display: flex; align-items: flex-start; gap: ${compact ? 8 : 14}px; }
    .${p}-logo { width: ${f(62)}; height: ${f(62)}; object-fit: contain; flex-shrink: 0; }
    .${p}-school-block { flex: 1; text-align: center; }
    .${p}-school-line1, .${p}-school-line2 {
      font-weight: 800; font-size: ${f(16)}; letter-spacing: 0.4px;
      color: #0b1f4d; text-transform: uppercase; line-height: 1.25;
    }
    .${p}-school-emph { font-size: ${f(22)}; font-weight: 900; }
    .${p}-school-location { font-style: italic; font-size: ${f(11)}; color: #1e3a8a; margin-top: 2px; }
    .${p}-contact { font-size: ${f(9)}; color: #0b1f4d; margin-top: 4px; }
    .${p}-id-box {
      width: ${f(118)}; border: 1.5px solid #0b1f4d; border-radius: 8px;
      overflow: hidden; flex-shrink: 0;
    }
    .${p}-id-label {
      background: #0b1f4d; color: #fff; font-size: ${f(9)}; font-weight: 800;
      text-align: center; padding: 4px 0; letter-spacing: 0.4px;
    }
    .${p}-id-value {
      text-align: center; font-size: ${f(11)}; font-weight: 700; padding: ${compact ? "6px 4px" : "10px 4px"};
      min-height: 14px; border-bottom: 1px dotted #0b1f4d; margin: 0 8px;
    }
    .${p}-divider { border-top: 1.5px solid #0b1f4d; margin: ${compact ? 6 : 12}px 0; }
    .${p}-body { display: flex; flex-direction: column; gap: ${compact ? 5 : 10}px; flex: 1; }
    .${p}-voucher-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .${p}-voucher-title {
      font-weight: 900; font-size: ${f(19)}; letter-spacing: 0.6px; color: #0b1f4d;
      text-align: center; flex: 1;
    }
    .${p}-slashes { color: #93a5d1; font-style: normal; margin-right: 6px; }
    .${p}-voucher-sub { font-size: ${f(10)}; font-style: italic; font-weight: 500; color: #1e3a8a; margin-top: 2px; }
    .${p}-no { font-size: ${f(13)}; font-weight: 700; color: #0b1f4d; white-space: nowrap; }
    .${p}-no-value { color: #dc2626; font-weight: 900; font-size: ${f(17)}; }
    .${p}-field { display: flex; align-items: baseline; gap: 8px; font-size: ${f(12)}; }
    .${p}-field em { font-size: ${f(10)}; font-style: italic; color: #475569; font-weight: 400; }
    .${p}-label { font-weight: 700; white-space: nowrap; color: #0b1f4d; }
    .${p}-value {
      flex: 1; border-bottom: 1px solid #64748b; padding-bottom: 2px; font-weight: 600; min-height: 12px;
    }
    .${p}-value-strong { font-weight: 800; font-size: ${f(13)}; }
    .${p}-field-block, .${p}-amount-block { display: flex; flex-direction: column; gap: 1px; }
    .${p}-field-top { display: flex; align-items: baseline; gap: 8px; font-size: ${f(12)}; }
    .${p}-field-caption { font-style: italic; font-size: ${f(9.5)}; color: #475569; margin-top: 1px; }
    .${p}-amount-top { display: flex; align-items: stretch; gap: 10px; }
    .${p}-amount-top .${p}-label { align-self: center; }
    .${p}-amount-box-sos {
      flex: 1; border: 1.5px solid #0b1f4d; border-radius: 8px; padding: ${compact ? "3px 8px" : "6px 12px"};
      font-weight: 800; font-size: ${f(13)}; text-align: right;
      display: flex; align-items: center; justify-content: flex-end;
    }
    .${p}-usd-group {
      display: flex; align-items: stretch; border: 1.5px solid #0b1f4d; border-radius: 8px;
      overflow: hidden; flex-shrink: 0;
    }
    .${p}-usd-tag {
      background: #0b1f4d; color: #fff; font-weight: 800; font-size: ${f(12)};
      padding: ${compact ? "3px 8px" : "6px 10px"}; display: flex; align-items: center;
    }
    .${p}-amount-box-usd {
      padding: ${compact ? "3px 8px" : "6px 12px"}; font-weight: 800; font-size: ${f(13)};
      min-width: ${f(44)}; text-align: right; display: flex; align-items: center; justify-content: flex-end;
    }
    .${p}-being-row { display: flex; gap: 14px; }
    .${p}-being-of { flex: 1; display: flex; align-items: baseline; gap: 8px; font-size: ${f(12)}; }
    .${p}-side-fields { display: flex; flex-direction: column; gap: 4px; min-width: ${compact ? 100 : 150}px; }
    .${p}-field-inline { display: flex; align-items: baseline; gap: 6px; font-size: ${f(11.5)}; }
    .${p}-bottom-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 4px; }
    .${p}-payment-method { display: flex; align-items: center; gap: 8px; }
    .${p}-method-tag {
      background: #0b1f4d; color: #fff; font-size: ${f(10.5)}; font-weight: 800;
      padding: 6px 10px; border-radius: 6px; white-space: nowrap;
    }
    .${p}-evc-label { font-weight: 700; font-size: ${f(12)}; color: #0b1f4d; }
    .${p}-evc-box {
      width: ${f(22)}; height: ${f(22)}; border: 1.5px solid #0b1f4d; border-radius: 4px;
      display: inline-flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: ${f(14)}; color: #16a34a;
    }
    .${p}-stamp { width: ${f(66)}; height: ${f(66)}; object-fit: contain; opacity: 0.85; flex-shrink: 0; }
    .${p}-signature { text-align: center; min-width: ${compact ? 90 : 140}px; }
    .${p}-sig-title { font-size: ${f(10)}; font-weight: 800; color: #0b1f4d; letter-spacing: 0.3px; }
    .${p}-sig-img { height: ${compact ? 20 : 34}px; object-fit: contain; margin-top: 2px; }
    .${p}-sig-line { border-bottom: 1px solid #64748b; height: ${compact ? 5 : 8}px; margin-top: 2px; }
    .${p}-footer-note {
      display: flex; align-items: center; gap: 8px; background: #0b1f4d; color: #fff;
      font-size: ${f(11)}; font-style: italic; font-weight: 600;
      padding: ${compact ? "5px 12px" : "7px 16px"};
      margin: ${compact ? 8 : 14}px ${compact ? -12 : -18}px ${compact ? -10 : -16}px;
    }
    .${p}-footer-icon {
      width: 15px; height: 15px; border-radius: 50%; background: #fff; color: #0b1f4d;
      display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 10px;
    }
  `;
}

// Modal-ka daawashada rasiidka — waa isla design-ka warqadda cusub
// (ReceiptModal.jsx), laakiin ka soo akhriya xog rasiid oo hore loo
// kaydiyay (halkii uu ka kordhin lahaa lambar cusub).
function ReceiptViewModal({ receipt, onClose, onDelete, deleting }) {
  return (
    <>
      <div className="rv-overlay">
        <div className="rv-actions no-print">
          <button onClick={onClose} className="rv-close-btn">
            Xir
          </button>
          <button onClick={onDelete} disabled={deleting} className="rv-delete-btn">
            <Trash2 size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
            {deleting ? "Tirtiraya..." : "Tirtir"}
          </button>
          <button onClick={() => window.print()} className="rv-print-btn">
            <Printer size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
            Print
          </button>
        </div>

        <div className="rv-paper">
          <ReceiptVoucherBody receipt={receipt} prefix="rv" />
        </div>
      </div>

      <style>{`
        .rv-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.55);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          gap: 14px;
        }
        .rv-actions { display: flex; gap: 10px; }
        .rv-close-btn, .rv-print-btn, .rv-delete-btn {
          border: none;
          border-radius: 10px;
          padding: 10px 18px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
        }
        .rv-close-btn {
          background: #ffffff;
          color: #6B7280;
          border: 1px solid #E5E7EB;
        }
        .rv-delete-btn {
          background: #DC2626;
          color: #ffffff;
        }
        .rv-print-btn {
          background: #16a34a;
          color: #ffffff;
        }
        .rv-paper {
          width: 640px;
          max-width: 94vw;
          background: #ffffff;
          font-family: 'Poppins', 'Segoe UI', Arial, sans-serif;
          color: #0b1f4d;
          box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        }

        ${receiptVoucherCss("rv")}

        @media print {
          body * { visibility: hidden; }
          .rv-paper, .rv-paper * { visibility: visible; }
          .rv-paper {
            position: absolute; top: 0; left: 0;
            box-shadow: none; width: 190mm;
          }
          .no-print { display: none !important; }
          @page { size: A5 landscape; margin: 4mm; }
        }
      `}</style>
    </>
  );
}

// ---- Daabacaadda dhammaan rasiidhada — 4 rasiid (2x2) A4 warqad
// kasta, si maamulku ugu daabaco kaydka rasiidhada dhammaantiis hal
// mar, halkii uu mid mid u daabici lahaa. ----
function PrintAllModal({ receipts, onClose }) {
  if (!receipts || receipts.length === 0) return null;

  return (
    <>
      {/* On-screen preview — a fixed overlay purely for reviewing before printing. */}
      <div className="pa-overlay no-print">
        <div className="pa-actions no-print">
          <button onClick={onClose} className="pa-close-btn">
            Xir
          </button>
          <button onClick={() => window.print()} className="pa-print-btn">
            <Printer size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
            Print Dhammaan ({receipts.length})
          </button>
        </div>

        <div className="pa-scroll">
          <div className="pa-grid">
            {receipts.map((r) => (
              <div className="pa-card" key={r.id}>
                <ReceiptVoucherBody receipt={r} prefix="mc" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Print-only target — intentionally rendered OUTSIDE the fixed overlay
          above. Chrome's print engine forces every "avoid-break" block
          inside a position:fixed ancestor onto its own page, which is why
          the grid was printing one receipt per A4 sheet instead of 4.
          This copy lives in normal document flow (no fixed/absolute
          ancestor), so the 2x2 / 4-per-page pagination works correctly. */}
      <div className="pa-print-only">
        <div className="pa-grid">
          {receipts.map((r) => (
            <div className="pa-card" key={`print-${r.id}`}>
              <ReceiptVoucherBody receipt={r} prefix="mc" />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .pa-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          flex-direction: column;
          align-items: center;
          z-index: 2500;
          padding: 20px 0;
        }
        .pa-actions {
          display: flex;
          gap: 10px;
          margin-bottom: 16px;
        }
        .pa-close-btn, .pa-print-btn {
          border: none;
          border-radius: 10px;
          padding: 10px 18px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
        }
        .pa-close-btn {
          background: #ffffff;
          color: #6B7280;
          border: 1px solid #E5E7EB;
        }
        .pa-print-btn {
          background: #2563EB;
          color: #ffffff;
        }
        .pa-scroll {
          width: 100%;
          max-width: 920px;
          max-height: 82vh;
          overflow-y: auto;
          background: #f1f5f9;
          border-radius: 16px;
          padding: 20px;
        }
        .pa-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
        }
        .pa-card {
          background: #fff;
          font-family: 'Poppins', 'Segoe UI', Arial, sans-serif;
          color: #0b1f4d;
          box-shadow: 0 4px 14px rgba(0,0,0,0.12);
          aspect-ratio: 4 / 2.55;
        }

        ${receiptVoucherCss("mc", { fontScale: 0.62, compact: true })}

        /* Hidden on screen — only revealed during print (see below). */
        .pa-print-only {
          display: none;
        }

        @media print {
          body * { visibility: hidden; }

          /* Hide the on-screen preview overlay entirely during print — we
             print from .pa-print-only instead, which has no fixed/absolute
             ancestor and therefore paginates correctly. */
          .pa-overlay { display: none !important; }

          .pa-print-only, .pa-print-only * { visibility: visible; }
          .pa-print-only {
            display: block !important;
            width: 100%;
          }
          .pa-print-only .pa-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 6mm !important;
          }
          .pa-print-only .pa-card {
            break-inside: avoid;
            page-break-inside: avoid;
            box-shadow: none !important;
          }
          .pa-print-only .pa-card:nth-child(4n) {
            page-break-after: always;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
      `}</style>
    </>
  );
}