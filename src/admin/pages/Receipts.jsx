import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { Search, Printer, X, Receipt as ReceiptIcon, Trash2 } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

import receiptBgTemplate from "../../assets/receipt.png";

const SCHOOL_NAME_LINE2 = "DUGSIGA HOOSE / DHEXE & SARE RISING STAR SCHOOL";
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
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);

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
                Dhammaan rasiidhada lacagaha ee laga bixiyay {SCHOOL_NAME_LINE2}
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
                placeholder="Raadi lambarka rasiidka, magaca ardayga, fasalka, ama bisha..."
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

function ReceiptViewModal({ receipt, onClose, onDelete, deleting }) {
  const [downloading, setDownloading] = useState(false);

  const paidDate = receipt.paidAt?.seconds
    ? new Date(receipt.paidAt.seconds * 1000)
    : receipt.createdAt?.seconds
    ? new Date(receipt.createdAt.seconds * 1000)
    : new Date();

  const totalPaidAmount = Number(receipt.paidAmount) || 0;
  const sosAmount = Math.round(totalPaidAmount * USD_TO_SOS_RATE);
  const amountWords = amountToWords(totalPaidAmount);

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const node = document.querySelector(".receipt-bg-wrapper");
      if (!node) return;

      const canvas = await html2canvas(node, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a5",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgRatio = canvas.width / canvas.height;
      let renderWidth = pageWidth;
      let renderHeight = renderWidth / imgRatio;

      if (renderHeight > pageHeight) {
        renderHeight = pageHeight;
        renderWidth = renderHeight * imgRatio;
      }

      const x = (pageWidth - renderWidth) / 2;
      const y = (pageHeight - renderHeight) / 2;

      pdf.addImage(imgData, "PNG", x, y, renderWidth, renderHeight);
      pdf.save(`Receipt-${receipt.receiptNo || "voucher"}.pdf`);
    } catch (err) {
      console.error("Khalad ayaa dhacay markii PDF-ka la sameynayay:", err);
      alert("Khalad ayaa dhacay markii PDF-ka la sameynayay.");
    } finally {
      setDownloading(false);
    }
  };

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
          <button onClick={handleDownloadPdf} disabled={downloading} className="rv-pdf-btn">
            {downloading ? "Diyaarinaya..." : "⬇️ PDF"}
          </button>
        </div>

        <div className="receipt-paper-container">
          <div className="receipt-bg-wrapper">
            <img src={receiptBgTemplate} alt="Receipt Background" className="receipt-bg-img" />

            <div className="receipt-overlay-data">
              <div className="r-no">{receipt.receiptNo}</div>
              <div className="r-date">{formatDate(paidDate)}</div>
              <div className="r-studentid">{receipt.studentId || ""}</div>
              <div className="r-receivedfrom">{receipt.studentName || ""}</div>
              <div className="r-amtsos">{sosAmount ? sosAmount.toLocaleString() : ""}</div>
              <div className="r-amtusd">{totalPaidAmount}</div>
              <div className="r-inwords">{amountWords} Only</div>
              <div className="r-beingof">{receipt.monthLabel || "Monthly Fee"}</div>
              <div className="r-class">{receipt.className || "—"}</div>
              <div className="r-tel">{receipt.studentPhone || receipt.parentPhone || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .rv-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.65);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          gap: 12px;
        }

        .rv-actions { display: flex; gap: 10px; }
        .rv-close-btn, .rv-print-btn, .rv-delete-btn, .rv-pdf-btn {
          border: none;
          border-radius: 10px;
          padding: 10px 18px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
        }
        .rv-close-btn { background: #ffffff; color: #374151; border: 1px solid #d1d5db; }
        .rv-delete-btn { background: #DC2626; color: #ffffff; }
        .rv-print-btn { background: #16a34a; color: #ffffff; }
        .rv-pdf-btn {
          background: #0b1f4d;
          color: #ffffff;
          opacity: ${downloading ? 0.7 : 1};
          cursor: ${downloading ? "not-allowed" : "pointer"};
        }

        .receipt-paper-container {
          width: 750px;
          max-width: 95vw;
          background: #ffffff;
          position: relative;
          box-shadow: 0 15px 35px rgba(0,0,0,0.3);
          border-radius: 4px;
          overflow: hidden;
        }

        .receipt-bg-wrapper {
          position: relative;
          width: 100%;
          line-height: 0;
        }

        .receipt-bg-img {
          width: 100%;
          height: auto;
          display: block;
        }

        .receipt-overlay-data {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 11px;
          font-weight: 700;
          color: #0b1f4d;
        }

        .r-no {
          position: absolute;
          top: 38.8%;
          right: 6.2%;
          font-size: 15px;
          color: #dc2626;
          font-weight: 900;
        }

        .r-date {
          position: absolute;
          top: 48.8%;
          left: 11.5%;
          font-size: 11px;
        }

        .r-studentid {
          position: absolute;
          top: 54.5%;
          left: 13.8%;
          font-size: 11px;
          font-weight: 800;
        }

        .r-receivedfrom {
          position: absolute;
          top: 60.5%;
          left: 17%;
          font-size: 12px;
          font-weight: 800;
        }

        .r-amtsos {
          position: absolute;
          top: 68.2%;
          right: 21.5%;
          font-size: 12px;
          font-weight: 800;
          text-align: right;
        }

        .r-amtusd {
          position: absolute;
          top: 68.2%;
          right: 5.5%;
          font-size: 12px;
          font-weight: 800;
          text-align: right;
        }

        .r-inwords {
          position: absolute;
          top: 76.5%;
          left: 18.5%;
          font-size: 11px;
          font-weight: 600;
        }

        .r-beingof {
          position: absolute;
          top: 82.2%;
          left: 15%;
          font-size: 11px;
          font-weight: 600;
        }

        .r-class {
          position: absolute;
          top: 80.5%;
          right: 17.5%;
          font-size: 11px;
        }

        .r-tel {
          position: absolute;
          top: 84.8%;
          right: 14.5%;
          font-size: 11px;
        }

        @media print {
  @page {
    size: A5 landscape;
    margin: 0;
  }

  html,
  body {
    width: 210mm !important;
    height: 148mm !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
  }

  body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body * {
    visibility: hidden !important;
  }

  .rv-overlay,
  .rv-overlay * {
    visibility: visible !important;
  }

  .rv-overlay {
    position: fixed !important;
    inset: 0 !important;

    width: 210mm !important;
    height: 148mm !important;

    margin: 0 !important;
    padding: 0 !important;

    background: transparent !important;
    display: block !important;
    overflow: hidden !important;
  }

  .receipt-paper-container {
    position: absolute !important;

    left: 0 !important;
    top: 0 !important;

    width: 210mm !important;
    height: 148mm !important;

    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;

    background: #ffffff !important;
    box-shadow: none !important;

    display: flex !important;
    align-items: center !important;
    justify-content: center !important;

    overflow: hidden !important;
  }

  .receipt-bg-wrapper {
    width: 202mm !important;
    max-width: 202mm !important;
    margin: 0 auto !important;
  }

  .receipt-bg-img {
    width: 100% !important;
    height: auto !important;
    display: block !important;
  }

  .no-print {
    display: none !important;
  }
}
      `}</style>
    </>
  );
}