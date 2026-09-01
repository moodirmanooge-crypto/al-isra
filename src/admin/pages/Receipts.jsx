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

function calculateMonthRange(receipt) {
  const startMonthStr = receipt.monthLabel || "";
  const totalAmount = (Number(receipt.paidAmount) || 0) + (Number(receipt.creditAmount) || 0) || Number(receipt.totalPaid) || Number(receipt.paidAmount) || 0;
  const monthlyFee = Number(receipt.monthlyFee) || 19;
  
  const monthCount = Math.max(1, Math.round(totalAmount / monthlyFee));

  if (!startMonthStr && !receipt.paidAt && !receipt.createdAt) {
    return "Monthly Fee";
  }

  let startDate = new Date();
  if (receipt.paidAt?.seconds) {
    startDate = new Date(receipt.paidAt.seconds * 1000);
  } else if (receipt.createdAt?.seconds) {
    startDate = new Date(receipt.createdAt.seconds * 1000);
  }

  if (startMonthStr) {
    const parsedDate = new Date(Date.parse(startMonthStr));
    if (!isNaN(parsedDate.getTime())) {
      startDate = parsedDate;
    }
  }

  if (monthCount <= 1) {
    return `Monthly Fee — ${startMonthStr || startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
  }

  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + monthCount - 1, 1);
  
  const startFormatted = startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const endFormatted = endDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return `Monthly Fee — ${startFormatted} to ${endFormatted} (${monthCount} Months)`;
}

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
  const [confirmTarget, setConfirmTarget] = useState(null);
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
    () => filtered.reduce((sum, r) => sum + (Number(r.paidAmount) || 0) + (Number(r.creditAmount) || 0), 0),
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
                  {filtered.map((r) => {
                    const totalPaidAmount = (Number(r.paidAmount) || 0) + (Number(r.creditAmount) || 0);
                    return (
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
                          ${totalPaidAmount.toLocaleString()}
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
                    );
                  })}
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

// ---- Receipt Voucher Component ----
function ReceiptVoucherBody({ receipt, prefix }) {
  const paidDate = receipt.paidAt?.seconds
    ? new Date(receipt.paidAt.seconds * 1000)
    : receipt.createdAt?.seconds
    ? new Date(receipt.createdAt.seconds * 1000)
    : new Date();

  const usdAmount = (Number(receipt.paidAmount) || 0) + (Number(receipt.creditAmount) || 0) || Number(receipt.totalPaid) || Number(receipt.paidAmount) || 0;
  const amountWords = amountToWords(usdAmount);
  const monthRangeText = calculateMonthRange(receipt);
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
            <div className={`${p}-field-caption`}>(Laga qaday)</div>
          </div>

          <div className={`${p}-amount-block`}>
            <div className={`${p}-amount-top`}>
              <span className={`${p}-label`}>Amount of So Sh.</span>
              <span className={`${p}-amount-box-sos`}>{usdAmount.toLocaleString()}</span>
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
              <span className={`${p}-value`}>{monthRangeText}</span>
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

function receiptVoucherCss(p) {
  return `
    .${p}-frame {
      border: 2px solid #0b1f4d;
      padding: 4px;
      height: 100%;
      box-sizing: border-box;
      background: #fff;
    }
    .${p}-outer {
      border: 2px solid #0b1f4d;
      padding: 10px 14px;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .${p}-top { display: flex; align-items: flex-start; gap: 12px; }
    .${p}-logo { width: 52px; height: 52px; object-fit: contain; flex-shrink: 0; }
    .${p}-school-block { flex: 1; text-align: center; }
    .${p}-school-line1, .${p}-school-line2 {
      font-weight: 800; font-size: 13.5px; letter-spacing: 0.3px;
      color: #0b1f4d; text-transform: uppercase; line-height: 1.2;
    }
    .${p}-school-emph { font-size: 18px; font-weight: 900; }
    .${p}-school-location { font-style: italic; font-size: 10.5px; color: #1e3a8a; margin-top: 1px; }
    .${p}-contact { font-size: 9px; color: #0b1f4d; margin-top: 2px; }
    .${p}-id-box {
      width: 110px; border: 1.5px solid #0b1f4d; border-radius: 6px;
      overflow: hidden; flex-shrink: 0;
    }
    .${p}-id-label {
      background: #0b1f4d; color: #fff; font-size: 8.5px; font-weight: 800;
      text-align: center; padding: 2px 0; letter-spacing: 0.3px;
    }
    .${p}-id-value {
      text-align: center; font-size: 11px; font-weight: 700; padding: 4px 2px;
      min-height: 14px; border-bottom: 1px dotted #0b1f4d; margin: 0 4px;
    }
    .${p}-divider { border-top: 1.5px solid #0b1f4d; margin: 5px 0; }
    .${p}-body { display: flex; flex-direction: column; gap: 5px; flex: 1; justify-content: space-around; }
    .${p}-voucher-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
    .${p}-voucher-title {
      font-weight: 900; font-size: 16px; letter-spacing: 0.4px; color: #0b1f4d;
      text-align: center; flex: 1;
    }
    .${p}-slashes { color: #93a5d1; font-style: normal; margin-right: 4px; }
    .${p}-voucher-sub { font-size: 9.5px; font-style: italic; font-weight: 500; color: #1e3a8a; margin-top: 1px; }
    .${p}-no { font-size: 11.5px; font-weight: 700; color: #0b1f4d; white-space: nowrap; }
    .${p}-no-value { color: #dc2626; font-weight: 900; font-size: 15px; }
    .${p}-field { display: flex; align-items: baseline; gap: 6px; font-size: 11px; }
    .${p}-field em { font-size: 9px; font-style: italic; color: #475569; font-weight: 400; }
    .${p}-label { font-weight: 700; white-space: nowrap; color: #0b1f4d; }
    .${p}-value {
      flex: 1; border-bottom: 1px solid #64748b; padding-bottom: 1px; font-weight: 600; min-height: 12px;
    }
    .${p}-value-strong { font-weight: 800; font-size: 12px; }
    .${p}-field-block, .${p}-amount-block { display: flex; flex-direction: column; gap: 1px; }
    .${p}-field-top { display: flex; align-items: baseline; gap: 6px; font-size: 11px; }
    .${p}-field-caption { font-style: italic; font-size: 8.5px; color: #475569; margin-top: 1px; }
    .${p}-amount-top { display: flex; align-items: stretch; gap: 8px; }
    .${p}-amount-top .${p}-label { align-self: center; }
    .${p}-amount-box-sos {
      flex: 1; border: 1.5px solid #0b1f4d; border-radius: 6px; padding: 2px 8px;
      font-weight: 800; font-size: 11.5px; text-align: right;
      display: flex; align-items: center; justify-content: flex-end;
    }
    .${p}-usd-group {
      display: flex; align-items: stretch; border: 1.5px solid #0b1f4d; border-radius: 6px;
      overflow: hidden; flex-shrink: 0;
    }
    .${p}-usd-tag {
      background: #0b1f4d; color: #fff; font-weight: 800; font-size: 10px;
      padding: 2px 6px; display: flex; align-items: center;
    }
    .${p}-amount-box-usd {
      padding: 2px 8px; font-weight: 800; font-size: 11.5px;
      min-width: 40px; text-align: right; display: flex; align-items: center; justify-content: flex-end;
    }
    .${p}-being-row { display: flex; gap: 12px; }
    .${p}-being-of { flex: 1; display: flex; align-items: baseline; gap: 6px; font-size: 11px; }
    .${p}-side-fields { display: flex; flex-direction: column; gap: 2px; min-width: 120px; }
    .${p}-field-inline { display: flex; align-items: baseline; gap: 4px; font-size: 10.5px; }
    .${p}-bottom-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; }
    .${p}-payment-method { display: flex; align-items: center; gap: 6px; }
    .${p}-method-tag {
      background: #0b1f4d; color: #fff; font-size: 9px; font-weight: 800;
      padding: 4px 6px; border-radius: 4px; white-space: nowrap;
    }
    .${p}-evc-label { font-weight: 700; font-size: 10.5px; color: #0b1f4d; }
    .${p}-evc-box {
      width: 18px; height: 18px; border: 1.5px solid #0b1f4d; border-radius: 3px;
      display: inline-flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 11px; color: #16a34a;
    }
    .${p}-stamp { width: 52px; height: 52px; object-fit: contain; opacity: 0.85; flex-shrink: 0; }
    .${p}-signature { text-align: center; min-width: 120px; }
    .${p}-sig-title { font-size: 8.5px; font-weight: 800; color: #0b1f4d; letter-spacing: 0.2px; }
    .${p}-sig-img { height: 24px; object-fit: contain; margin-top: 1px; }
    .${p}-sig-line { border-bottom: 1.5px solid #0b1f4d; margin-top: 1px; }
    .${p}-footer-note {
      background: #0b1f4d; color: #fff; font-size: 8.5px; font-weight: 800;
      padding: 3px 8px; border-radius: 4px; display: flex; align-items: center;
      gap: 5px; margin-top: 4px;
    }
    .${p}-footer-icon {
      width: 11px; height: 11px; background: #fff; color: #0b1f4d;
      border-radius: 50%; display: inline-flex; align-items: center;
      justify-content: center; font-weight: 900; font-size: 8px;
    }
  `;
}

// ---- Modal: Single Receipt ----
function ReceiptViewModal({ receipt, onClose, onDelete, deleting }) {
  function handlePrint() {
    const printWin = window.open("", "_blank");
    if (!printWin) return alert("Fadlan u ogolaaw browser-ka inuu furo pop-up.");

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt_${receipt.receiptNo}</title>
          <style>
            @page {
              size: A5 landscape;
              margin: 0;
            }
            html, body {
              width: 210mm;
              height: 148mm;
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              padding: 6mm;
              font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
              -webkit-print-color-adjust: exact;
            }
            #print-root {
              width: 100%;
              height: 100%;
            }
            ${receiptVoucherCss("rvp")}
          </style>
        </head>
        <body>
          <div id="print-root"></div>
        </body>
      </html>
    `);

    printWin.document.close();

    const container = printWin.document.getElementById("print-root");
    container.innerHTML = `
      <div class="rvp-frame">
        <div class="rvp-outer">
          <div class="rvp-top">
            <img src="${schoolLogo}" alt="Logo" class="rvp-logo" />
            <div class="rvp-school-block">
              <div class="rvp-school-line1">${SCHOOL_NAME_LINE1}</div>
              <div class="rvp-school-line2">SARE EE <span class="rvp-school-emph">AL-ISRA</span></div>
              <div class="rvp-school-location">— ${SCHOOL_LOCATION} —</div>
              <div class="rvp-contact">☎ ${SCHOOL_PHONES} &nbsp;|&nbsp; ✉ ${SCHOOL_EMAIL}</div>
            </div>
            <div class="rvp-id-box">
              <div class="rvp-id-label">STUDENT ID</div>
              <div class="rvp-id-value">${receipt.studentId || ""}</div>
            </div>
          </div>
          <div class="rvp-divider"></div>
          <div class="rvp-body">
            <div class="rvp-voucher-row">
              <div class="rvp-voucher-title"><span class="rvp-slashes">///</span> RECEIPT VOUCHER <div class="rvp-voucher-sub">(Warqadda Lacag Qaabashada)</div></div>
              <div class="rvp-no">No: <span class="rvp-no-value">${receipt.receiptNo}</span></div>
            </div>
            <div class="rvp-field"><span class="rvp-label">Date:</span><span class="rvp-value">${formatDate(receipt.paidAt || receipt.createdAt)}</span></div>
            <div class="rvp-field-block">
              <div class="rvp-field-top"><span class="rvp-label">Received from:</span><span class="rvp-value rvp-value-strong">${receipt.studentName || "—"}</span></div>
              <div class="rvp-field-caption">(Laga qaday)</div>
            </div>
            <div class="rvp-amount-block">
              <div class="rvp-amount-top">
                <span class="rvp-label">Amount of So Sh.</span>
                <span class="rvp-amount-box-sos">${((Number(receipt.paidAmount) || 0) + (Number(receipt.creditAmount) || 0)).toLocaleString()}</span>
                <span class="rvp-usd-group"><span class="rvp-usd-tag">US$</span><span class="rvp-amount-box-usd">${(Number(receipt.paidAmount) || 0) + (Number(receipt.creditAmount) || 0)}</span></span>
              </div>
              <div class="rvp-field-caption">(Lacag dhan)</div>
            </div>
            <div class="rvp-field"><span class="rvp-label">In words <em>(Eray ahaan)</em>:</span><span class="rvp-value">${amountToWords((Number(receipt.paidAmount) || 0) + (Number(receipt.creditAmount) || 0))} Only</span></div>
            <div class="rvp-being-row">
              <div class="rvp-being-of"><span class="rvp-label">Being of: <em>(Taasoo ah)</em>:</span><span class="rvp-value">${calculateMonthRange(receipt)}</span></div>
              <div class="rvp-side-fields">
                <div class="rvp-field-inline"><span class="rvp-label">Class:</span><span class="rvp-value">${receipt.className || "—"}</span></div>
                <div class="rvp-field-inline"><span class="rvp-label">Tel.</span><span class="rvp-value">${receipt.studentPhone || "—"}</span></div>
              </div>
            </div>
            <div class="rvp-bottom-row">
              <div class="rvp-payment-method"><span class="rvp-method-tag">PAYMENT METHOD</span><span class="rvp-evc-label">EVC</span><span class="rvp-evc-box">✓</span></div>
              <img src="${schoolLogo}" alt="Stamp" class="rvp-stamp" />
              <div class="rvp-signature">
                <div class="rvp-sig-title">PRINCIPAL SIGNATURE</div>
                <img src="${principalSignature}" alt="Signature" class="rvp-sig-img" />
                <div class="rvp-sig-line"></div>
              </div>
            </div>
          </div>
          <div class="rvp-footer-note"><span class="rvp-footer-icon">!</span> N.B. Not refundable.</div>
        </div>
      </div>
    `;

    setTimeout(() => {
      printWin.focus();
      printWin.print();
    }, 500);
  }

  return (
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
        zIndex: 2000,
        padding: 20,
      }}
    >
      <style>{receiptVoucherCss("rvm")}</style>

      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          width: 780,
          maxWidth: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "16px 22px",
            borderBottom: "1px solid #F3F4F6",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111827" }}>
            Receipt #{receipt.receiptNo}
          </h2>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handlePrint}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#16a34a",
                color: "#fff",
                border: "none",
                fontWeight: 700,
                fontSize: 12.5,
                padding: "8px 16px",
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              <Printer size={15} /> Daabac Rasiidka
            </button>
            <button
              onClick={onDelete}
              disabled={deleting}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#FEF2F2",
                color: "#DC2626",
                border: "1px solid #FCA5A5",
                fontWeight: 700,
                fontSize: 12.5,
                padding: "8px 14px",
                borderRadius: 10,
                cursor: deleting ? "not-allowed" : "pointer",
                opacity: deleting ? 0.7 : 1,
              }}
            >
              <Trash2 size={14} /> Tirtir
            </button>
            <button
              onClick={onClose}
              style={{
                background: "#F3F4F6",
                color: "#374151",
                border: "none",
                fontWeight: 700,
                fontSize: 12.5,
                padding: "8px 14px",
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              Xir
            </button>
          </div>
        </div>

        <div style={{ padding: 24, flex: 1, height: "148mm" }}>
          <ReceiptVoucherBody receipt={receipt} prefix="rvm" />
        </div>
      </div>
    </div>
  );
}

// ---- Modal: Print All Receipts ----
function PrintAllModal({ receipts, onClose }) {
  function handlePrintAll() {
    const printWin = window.open("", "_blank");
    if (!printWin) return alert("Fadlan u ogolaaw browser-ka inuu furo pop-up.");

    const itemsHtml = receipts
      .map((receipt) => {
        const usdAmount = (Number(receipt.paidAmount) || 0) + (Number(receipt.creditAmount) || 0) || Number(receipt.totalPaid) || Number(receipt.paidAmount) || 0;
        return `
        <div class="page-break">
          <div class="rvp-frame">
            <div class="rvp-outer">
              <div class="rvp-top">
                <img src="${schoolLogo}" alt="Logo" class="rvp-logo" />
                <div class="rvp-school-block">
                  <div class="rvp-school-line1">${SCHOOL_NAME_LINE1}</div>
                  <div class="rvp-school-line2">SARE EE <span class="rvp-school-emph">AL-ISRA</span></div>
                  <div class="rvp-school-location">— ${SCHOOL_LOCATION} —</div>
                  <div class="rvp-contact">☎ ${SCHOOL_PHONES} &nbsp;|&nbsp; ✉ ${SCHOOL_EMAIL}</div>
                </div>
                <div class="rvp-id-box">
                  <div class="rvp-id-label">STUDENT ID</div>
                  <div class="rvp-id-value">${receipt.studentId || ""}</div>
                </div>
              </div>
              <div class="rvp-divider"></div>
              <div class="rvp-body">
                <div class="rvp-voucher-row">
                  <div class="rvp-voucher-title"><span class="rvp-slashes">///</span> RECEIPT VOUCHER <div class="rvp-voucher-sub">(Warqadda Lacag Qaabashada)</div></div>
                  <div class="rvp-no">No: <span class="rvp-no-value">${receipt.receiptNo}</span></div>
                </div>
                <div class="rvp-field"><span class="rvp-label">Date:</span><span class="rvp-value">${formatDate(receipt.paidAt || receipt.createdAt)}</span></div>
                <div class="rvp-field-block">
                  <div class="rvp-field-top"><span class="rvp-label">Received from:</span><span class="rvp-value rvp-value-strong">${receipt.studentName || "—"}</span></div>
                  <div class="rvp-field-caption">(Laga qaday)</div>
                </div>
                <div class="rvp-amount-block">
                  <div class="rvp-amount-top">
                    <span class="rvp-label">Amount of So Sh.</span>
                    <span class="rvp-amount-box-sos">${usdAmount.toLocaleString()}</span>
                    <span class="rvp-usd-group"><span class="rvp-usd-tag">US$</span><span class="rvp-amount-box-usd">${usdAmount}</span></span>
                  </div>
                  <div class="rvp-field-caption">(Lacag dhan)</div>
                </div>
                <div class="rvp-field"><span class="rvp-label">In words <em>(Eray ahaan)</em>:</span><span class="rvp-value">${amountToWords(usdAmount)} Only</span></div>
                <div class="rvp-being-row">
                  <div class="rvp-being-of"><span class="rvp-label">Being of: <em>(Taasoo ah)</em>:</span><span class="rvp-value">${calculateMonthRange(receipt)}</span></div>
                  <div class="rvp-side-fields">
                    <div class="rvp-field-inline"><span class="rvp-label">Class:</span><span class="rvp-value">${receipt.className || "—"}</span></div>
                    <div class="rvp-field-inline"><span class="rvp-label">Tel.</span><span class="rvp-value">${receipt.studentPhone || "—"}</span></div>
                  </div>
                </div>
                <div class="rvp-bottom-row">
                  <div class="rvp-payment-method"><span class="rvp-method-tag">PAYMENT METHOD</span><span class="rvp-evc-label">EVC</span><span class="rvp-evc-box">✓</span></div>
                  <img src="${schoolLogo}" alt="Stamp" class="rvp-stamp" />
                  <div class="rvp-signature">
                    <div class="rvp-sig-title">PRINCIPAL SIGNATURE</div>
                    <img src="${principalSignature}" alt="Signature" class="rvp-sig-img" />
                    <div class="rvp-sig-line"></div>
                  </div>
                </div>
              </div>
              <div class="rvp-footer-note"><span class="rvp-footer-icon">!</span> N.B. Not refundable.</div>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>All_Receipts</title>
          <style>
            @page {
              size: A5 landscape;
              margin: 0;
            }
            html, body {
              width: 210mm;
              height: 148mm;
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
              -webkit-print-color-adjust: exact;
            }
            .page-break {
              page-break-after: always;
              height: 148mm;
              box-sizing: border-box;
              padding: 6mm;
            }
            ${receiptVoucherCss("rvp")}
          </style>
        </head>
        <body>
          ${itemsHtml}
        </body>
      </html>
    `);

    printWin.document.close();

    setTimeout(() => {
      printWin.focus();
      printWin.print();
    }, 600);
  }

  return (
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
        zIndex: 2000,
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          width: 500,
          maxWidth: "100%",
          padding: 24,
          fontFamily: "'Inter','Segoe UI',sans-serif",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>
          Daabac Dhammaan Rasiidhada
        </h2>
        <p style={{ fontSize: 13.5, color: "#6B7280", marginTop: 8, lineHeight: 1.5 }}>
          Waxaad rabtaa inaad daabacdo <strong style={{ color: "#111827" }}>{receipts.length}</strong> rasiid. 
          Rasiid kasta wuxuu ku daabacmi doonaa bog u gaar ah oo xaashida A5 ah (Landscape).
        </p>

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button
            onClick={onClose}
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
            onClick={handlePrintAll}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 10,
              border: "none",
              background: "#2563EB",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Printer size={16} /> Biloow Daabacaadda
          </button>
        </div>
      </div>
    </div>
  );
}