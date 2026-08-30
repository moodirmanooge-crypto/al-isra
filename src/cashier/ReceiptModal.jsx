//src/cashier/ReceiptModal.jsx
import { useEffect, useRef, useState } from "react";
import {
  doc,
  runTransaction,
  collection,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { theme } from "./theme.js";

const SCHOOL_NAME = "AL - ISRA PRIMARY & SECONDARY SCHOOL";

// Sanad-dugsiyeedka: bisha 1-8 waxay ka tirsan yihiin sanadkii hore
// (Jan-Aug), bisha 9-12 waxay ka tirsan yihiin sanadka cusub (Sep-Dec).
const academicYearLabel = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth() + 1; // 1-12
  if (m >= 9) return `${y}/${y + 1}`;
  return `${y - 1}/${y}`;
};

// Waxay si atomic ah u kordhisaa Firestore counter-ka rasiidka
// (counters/receiptCounter) oo soo celisaa lambarka cusub.
const getNextReceiptNumber = async () => {
  const counterRef = doc(db, "counters", "receiptCounter");

  const nextNumber = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    const current = counterDoc.exists() ? Number(counterDoc.data().value || 0) : 0;
    const next = current + 1;
    transaction.set(counterRef, { value: next }, { merge: true });
    return next;
  });

  return String(nextNumber).padStart(3, "0");
};

// Waxay ku kaydisaa rasiidka collection-ka "receipts" si maamulku ugu
// daawan karo dhammaan rasiidhada laga sameeyay dashboard-ka.
// NOTE: "receivedBy" (saxiixa) laguma kaydiyo Firestore — waa gacan-qoraal
// oo lagu buuxiyo warqadda daabacan kadib, marna lama soo aqrin database-ka.
const saveReceiptRecord = async (receiptNo, payment, paidDate) => {
  try {
    const receiptRef = doc(collection(db, "receipts"), receiptNo);
    await setDoc(receiptRef, {
      receiptNo,
      studentId: payment.studentId || null,
      studentName: payment.studentName || "",
      className: payment.className || "",
      monthLabel: payment.monthLabel || "",
      paidAmount: payment.paidAmount ?? 0,
      academicYear: academicYearLabel(paidDate),
      paidAt: paidDate,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Khalad ayaa dhacay markii rasiidka la kaydinayay:", err);
  }
};

export default function ReceiptModal({ payment, onClose }) {
  const [receiptNo, setReceiptNo] = useState(null);
  const [loading, setLoading] = useState(true);
  const printedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const prepareReceipt = async () => {
      try {
        const no = await getNextReceiptNumber();
        if (cancelled) return;
        setReceiptNo(no);

        const paidDate = payment.createdAt?.seconds
          ? new Date(payment.createdAt.seconds * 1000)
          : new Date();
        await saveReceiptRecord(no, payment, paidDate);
      } catch (err) {
        console.log(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    prepareReceipt();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loading && receiptNo && !printedRef.current) {
      printedRef.current = true;
      const t = setTimeout(() => {
        window.print();
      }, 200);
      return () => clearTimeout(t);
    }
  }, [loading, receiptNo]);

  if (!payment) return null;

  const paidDate = payment.createdAt?.seconds
    ? new Date(payment.createdAt.seconds * 1000)
    : new Date();

  const dateStr = paidDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <>
      <div className="receipt-overlay">
        <div className="receipt-modal-actions no-print">
          <button onClick={onClose} className="receipt-close-btn">
            Xir
          </button>
          <button onClick={() => window.print()} className="receipt-print-btn">
            🖨️ Print
          </button>
        </div>

        <div className="receipt-paper">
          {loading ? (
            <p style={{ textAlign: "center", padding: 20, fontSize: 12 }}>
              Diyaarinaya rasiidka...
            </p>
          ) : (
            <>
              <div className="receipt-header">
                <div className="receipt-school">{SCHOOL_NAME}</div>
                <div className="receipt-sub">SCHOOL FEES RECEIPT</div>
                <div className="receipt-no">No. {receiptNo}</div>
              </div>

              <div className="receipt-line" />

              <div className="receipt-field">
                <span className="receipt-label">Received from</span>
                <span className="receipt-value">{payment.studentName}</span>
              </div>
              <div className="receipt-field">
                <span className="receipt-label">Class</span>
                <span className="receipt-value">{payment.className || "—"}</span>
              </div>
              <div className="receipt-field">
                <span className="receipt-label">Month</span>
                <span className="receipt-value">{payment.monthLabel}</span>
              </div>
              <div className="receipt-field">
                <span className="receipt-label">Academic Year</span>
                <span className="receipt-value">{academicYearLabel(paidDate)}</span>
              </div>
              <div className="receipt-field">
                <span className="receipt-label">Date</span>
                <span className="receipt-value">{dateStr}</span>
              </div>
              <div className="receipt-field">
                <span className="receipt-label">Amount</span>
                <span className="receipt-value receipt-blank" />
              </div>

              <div className="receipt-line" />

              {/* Received by / Signature: intentionally left BLANK.
                  This is filled in and signed by hand on the printed
                  paper receipt — it is never read from or written to
                  Firestore. */}
              <div className="receipt-signature-block">
                <span className="receipt-label">Received by</span>
                <span className="receipt-signature-line" />
              </div>

              <div className="receipt-footer">Mahadsanid!</div>
            </>
          )}
        </div>
      </div>

      <style>{`
        .receipt-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.55);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          gap: 14px;
        }

        .receipt-modal-actions {
          display: flex;
          gap: 10px;
        }

        .receipt-close-btn, .receipt-print-btn {
          border: none;
          border-radius: 10px;
          padding: 10px 18px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
        }

        .receipt-close-btn {
          background: #ffffff;
          color: ${theme.colors.inkMuted};
          border: 1px solid ${theme.colors.border};
        }

        .receipt-print-btn {
          background: ${theme.colors.mint};
          color: #ffffff;
        }

        .receipt-paper {
          width: 340px;
          background: #FBF6E9;
          padding: 22px 20px;
          font-family: 'Georgia', 'Times New Roman', serif;
          color: #111827;
          box-shadow: 0 10px 30px rgba(0,0,0,0.25);
          border: 3px double #7a1f1f;
        }

        .receipt-header {
          text-align: center;
          margin-bottom: 12px;
          position: relative;
        }

        .receipt-school {
          font-weight: 800;
          font-size: 15px;
          letter-spacing: 0.3px;
          color: #14532d;
          text-transform: uppercase;
        }

        .receipt-sub {
          font-size: 13px;
          font-weight: 700;
          color: #111827;
          margin-top: 4px;
        }

        .receipt-no {
          font-size: 11.5px;
          color: #111827;
          margin-top: 4px;
          font-weight: 700;
        }

        .receipt-line {
          border-top: 1px dashed #9CA3AF;
          margin: 10px 0;
        }

        .receipt-field {
          display: flex;
          align-items: baseline;
          gap: 6px;
          font-size: 12.5px;
          margin-bottom: 8px;
        }

        .receipt-label {
          color: #374151;
          white-space: nowrap;
        }

        .receipt-value {
          flex: 1;
          border-bottom: 1px solid #9CA3AF;
          padding-bottom: 1px;
          font-weight: 600;
          min-height: 14px;
        }

        .receipt-strong {
          font-weight: 800;
        }

        .receipt-blank {
          min-height: 14px;
        }

        .receipt-signature-block {
          display: flex;
          align-items: baseline;
          gap: 6px;
          margin-top: 20px;
          font-size: 12.5px;
        }

        .receipt-signature-line {
          flex: 1;
          border-bottom: 1px solid #9CA3AF;
          min-height: 18px;
        }

        .receipt-footer {
          text-align: center;
          font-size: 12px;
          margin-top: 14px;
          font-weight: 700;
        }

        @media print {
          body * {
            visibility: hidden;
          }
          .receipt-paper, .receipt-paper * {
            visibility: visible;
          }
          .receipt-paper {
            position: absolute;
            top: 0;
            left: 0;
            box-shadow: none;
            width: 80mm;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>
    </>
  );
}