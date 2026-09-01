//src/cashier/ReceiptModal.jsx
import { useEffect, useState } from "react";
import {
  doc,
  runTransaction,
  collection,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { theme } from "./theme.js";
import schoolLogo from "../assets/logo.png";
import principalSignature from "../admin/assets/signature-principal.png";

const SCHOOL_NAME_LINE1 = "DUGSIGA HOOSE / DHEXE &";
const SCHOOL_LOCATION = "Mogadishu - Somalia";
const SCHOOL_PHONES = "858516 / 0615860629 / 0617636461 / 0617536461";
const SCHOOL_EMAIL = "israpp@hotmail.com";

// 1 USD = 28 So Sh (Somali Shilling) — isticmaalka xisaabinta "Amount of So Sh."
const USD_TO_SOS_RATE = 28;

// Sanad-dugsiyeedka: bisha 1-8 waxay ka tirsan yihiin sanadkii hore
// (Jan-Aug), bisha 9-12 waxay ka tirsan yihiin sanadka cusub (Sep-Dec).
const academicYearLabel = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth() + 1; // 1-12
  if (m >= 9) return `${y}/${y + 1}`;
  return `${y - 1}/${y}`;
};

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

// Waxay ku beddeshaa qiimaha lacagta (tusaale 17 ama 17.50) ereyo Ingiriisi
// ah, tusaale ahaan "Seventeen Dollars" ama "Seventeen Dollars and Fifty Cents"
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
      studentPhone: payment.studentPhone || "",
      monthLabel: payment.monthLabel || "",
      paidAmount: payment.paidAmount ?? 0,
      paymentMethod: payment.paymentMethod || "",
      evcNumber: payment.evcNumber || "",
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

  // ✅ Auto-print-ka waa la joojiyay — wuxuu keenayay dialog-yo OS-ka
  // ah oo la xiriira printer-ka default-ka ah ee kombiyuutarka (tusaale
  // "HP Programmable Key is not installed"), oo aan la xiriirin
  // koodhka boggan. Hadda cashier-ku wuxuu isticmaalaa button-ka
  // "🖨️ Print" gacanta si uu u doorto printer-ka rabo marka uu
  // dhab ahaan diyaar u yahay inuu daabaco.
  if (!payment) return null;

  const paidDate = payment.createdAt?.seconds
    ? new Date(payment.createdAt.seconds * 1000)
    : new Date();

  const dateStr = paidDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const usdAmount = Number(payment.paidAmount) || 0;
  const sosAmount = Math.round(usdAmount * USD_TO_SOS_RATE);
  const amountWords = amountToWords(usdAmount);
  const isEvc = true;

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
            <div className="rc-frame">
              <div className="rc-outer">
                <div className="rc-top">
                  <img src={schoolLogo} alt="Logo" className="rc-logo" />

                  <div className="rc-school-block">
                    <div className="rc-school-line1">{SCHOOL_NAME_LINE1}</div>
                    <div className="rc-school-line2">
                      SARE EE <span className="rc-school-emph">AL-ISRA</span>
                    </div>
                    <div className="rc-school-location">— {SCHOOL_LOCATION} —</div>
                    <div className="rc-contact">
                      ☎ {SCHOOL_PHONES} &nbsp;|&nbsp; ✉ {SCHOOL_EMAIL}
                    </div>
                  </div>

                  <div className="rc-id-box">
                    <div className="rc-id-label">STUDENT ID</div>
                    <div className="rc-id-value">{payment.studentId || ""}</div>
                  </div>
                </div>

                <div className="rc-divider" />

                <div className="rc-body">
                  <div className="rc-voucher-row">
                    <div className="rc-voucher-title">
                      <span className="rc-slashes">///</span> RECEIPT VOUCHER
                      <div className="rc-voucher-sub">(Warqadda Lacag Qaabashada)</div>
                    </div>
                    <div className="rc-no">
                      No: <span className="rc-no-value">{receiptNo}</span>
                    </div>
                  </div>

                  <div className="rc-field">
                    <span className="rc-label">Date:</span>
                    <span className="rc-value">{dateStr}</span>
                  </div>

                  <div className="rc-field-block">
                    <div className="rc-field-top">
                      <span className="rc-label">Received from:</span>
                      <span className="rc-value rc-value-strong">{payment.studentName}</span>
                    </div>
                    <div className="rc-field-caption">(Laga quaday)</div>
                  </div>

                  <div className="rc-amount-block">
                    <div className="rc-amount-top">
                      <span className="rc-label">Amount of So Sh.</span>
                      <span className="rc-amount-box-sos">{sosAmount.toLocaleString()}</span>
                      <span className="rc-usd-group">
                        <span className="rc-usd-tag">US$</span>
                        <span className="rc-amount-box-usd">{usdAmount}</span>
                      </span>
                    </div>
                    <div className="rc-field-caption">(Lacag dhan)</div>
                  </div>

                  <div className="rc-field">
                    <span className="rc-label">
                      In words <em>(Eray ahaan)</em>:
                    </span>
                    <span className="rc-value">{amountWords} Only</span>
                  </div>

                  <div className="rc-being-row">
                    <div className="rc-being-of">
                      <span className="rc-label">
                        Being of: <em>(Taasoo ah)</em>:
                      </span>
                      <span className="rc-value">Monthly Fee — {payment.monthLabel}</span>
                    </div>
                    <div className="rc-side-fields">
                      <div className="rc-field-inline">
                        <span className="rc-label">Class:</span>
                        <span className="rc-value">{payment.className || "—"}</span>
                      </div>
                      <div className="rc-field-inline">
                        <span className="rc-label">Tel.</span>
                        <span className="rc-value">{payment.studentPhone || "—"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rc-bottom-row">
                    <div className="rc-payment-method">
                      <span className="rc-method-tag">PAYMENT METHOD</span>
                      <span className="rc-evc-label">EVC</span>
                      <span className={`rc-evc-box ${isEvc ? "rc-evc-checked" : ""}`}>
                        {isEvc ? "✓" : ""}
                      </span>
                    </div>

                    <img src={schoolLogo} alt="Stamp" className="rc-stamp" />

                    <div className="rc-signature">
                      <div className="rc-sig-title">PRINCIPAL SIGNATURE</div>
                      <img src={principalSignature} alt="Principal Signature" className="rc-sig-img" />
                      <div className="rc-sig-line" />
                    </div>
                  </div>
                </div>

                <div className="rc-footer-note">
                  <span className="rc-footer-icon">!</span> N.B. Not refundable.
                </div>
              </div>
            </div>
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
          width: 640px;
          max-width: 94vw;
          background: #ffffff;
          padding: 0;
          font-family: 'Poppins', 'Segoe UI', Arial, sans-serif;
          color: #0b1f4d;
          box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        }

        /* ---- Single continuous double-border frame, matching receipt.png ---- */
        .rc-frame {
          border: 2px solid #0b1f4d;
          padding: 6px;
        }

        .rc-outer {
          border: 3px solid #0b1f4d;
          padding: 16px 18px;
        }

        .rc-top {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }

        .rc-logo {
          width: 62px;
          height: 62px;
          object-fit: contain;
          flex-shrink: 0;
        }

        .rc-school-block {
          flex: 1;
          text-align: center;
        }

        .rc-school-line1 {
          font-weight: 800;
          font-size: 16px;
          letter-spacing: 0.4px;
          color: #0b1f4d;
          text-transform: uppercase;
        }

        .rc-school-line2 {
          font-weight: 800;
          font-size: 16px;
          letter-spacing: 0.4px;
          color: #0b1f4d;
          text-transform: uppercase;
        }

        .rc-school-emph {
          font-size: 22px;
          font-weight: 900;
        }

        .rc-school-location {
          font-style: italic;
          font-size: 11px;
          color: #1e3a8a;
          margin-top: 2px;
        }

        .rc-contact {
          font-size: 9px;
          color: #0b1f4d;
          margin-top: 4px;
        }

        .rc-id-box {
          width: 118px;
          border: 1.5px solid #0b1f4d;
          border-radius: 8px;
          overflow: hidden;
          flex-shrink: 0;
        }

        .rc-id-label {
          background: #0b1f4d;
          color: #fff;
          font-size: 9px;
          font-weight: 800;
          text-align: center;
          padding: 4px 0;
          letter-spacing: 0.4px;
        }

        .rc-id-value {
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          padding: 10px 4px;
          min-height: 14px;
          border-bottom: 1px dotted #0b1f4d;
          margin: 0 8px;
        }

        .rc-divider {
          border-top: 1.5px solid #0b1f4d;
          margin: 12px 0;
        }

        .rc-body {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .rc-voucher-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }

        .rc-voucher-title {
          font-weight: 900;
          font-size: 19px;
          letter-spacing: 0.6px;
          color: #0b1f4d;
          text-align: center;
          flex: 1;
        }

        .rc-slashes {
          color: #93a5d1;
          font-style: normal;
          margin-right: 6px;
        }

        .rc-voucher-sub {
          font-size: 10px;
          font-style: italic;
          font-weight: 500;
          color: #1e3a8a;
          margin-top: 2px;
        }

        .rc-no {
          font-size: 13px;
          font-weight: 700;
          color: #0b1f4d;
          white-space: nowrap;
        }

        .rc-no-value {
          color: #dc2626;
          font-weight: 900;
          font-size: 17px;
        }

        .rc-field {
          display: flex;
          align-items: baseline;
          gap: 8px;
          font-size: 12px;
          padding: 5px 0;
        }

        .rc-field em {
          font-size: 10px;
          font-style: italic;
          color: #475569;
          font-weight: 400;
        }

        .rc-label {
          font-weight: 700;
          white-space: nowrap;
          color: #0b1f4d;
        }

        .rc-value {
          flex: 1;
          border-bottom: 1px solid #64748b;
          padding-bottom: 2px;
          font-weight: 600;
          min-height: 14px;
        }

        .rc-value-strong {
          font-weight: 800;
          font-size: 13px;
        }

        .rc-field-block, .rc-amount-block {
          padding: 5px 0;
        }

        .rc-field-top {
          display: flex;
          align-items: baseline;
          gap: 8px;
          font-size: 12px;
        }

        .rc-field-caption {
          font-style: italic;
          font-size: 9.5px;
          color: #475569;
          margin-top: 2px;
        }

        .rc-amount-top {
          display: flex;
          align-items: stretch;
          gap: 10px;
        }

        .rc-amount-top .rc-label {
          align-self: center;
        }

        .rc-amount-box-sos {
          flex: 1;
          border: 1.5px solid #0b1f4d;
          border-radius: 8px;
          padding: 6px 12px;
          font-weight: 800;
          font-size: 13px;
          text-align: right;
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }

        .rc-usd-group {
          display: flex;
          align-items: stretch;
          border: 1.5px solid #0b1f4d;
          border-radius: 8px;
          overflow: hidden;
          flex-shrink: 0;
        }

        .rc-usd-tag {
          background: #0b1f4d;
          color: #fff;
          font-weight: 800;
          font-size: 12px;
          padding: 6px 10px;
          display: flex;
          align-items: center;
        }

        .rc-amount-box-usd {
          padding: 6px 12px;
          font-weight: 800;
          font-size: 13px;
          min-width: 44px;
          text-align: right;
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }

        .rc-being-row {
          display: flex;
          gap: 14px;
        }

        .rc-being-of {
          flex: 1;
          display: flex;
          align-items: baseline;
          gap: 8px;
          font-size: 12px;
        }

        .rc-side-fields {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 150px;
        }

        .rc-field-inline {
          display: flex;
          align-items: baseline;
          gap: 6px;
          font-size: 11.5px;
        }

        .rc-bottom-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 4px;
        }

        .rc-payment-method {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .rc-method-tag {
          background: #0b1f4d;
          color: #fff;
          font-size: 10.5px;
          font-weight: 800;
          padding: 6px 10px;
          border-radius: 6px;
          white-space: nowrap;
        }

        .rc-evc-label {
          font-weight: 700;
          font-size: 12px;
          color: #0b1f4d;
        }

        .rc-evc-box {
          width: 22px;
          height: 22px;
          border: 1.5px solid #0b1f4d;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 14px;
          color: #16a34a;
        }

        .rc-stamp {
          width: 66px;
          height: 66px;
          object-fit: contain;
          opacity: 0.85;
          flex-shrink: 0;
        }

        .rc-signature {
          text-align: center;
          min-width: 140px;
        }

        .rc-sig-title {
          font-size: 10px;
          font-weight: 800;
          color: #0b1f4d;
          letter-spacing: 0.3px;
        }

        .rc-sig-img {
          height: 34px;
          object-fit: contain;
          margin-top: 2px;
        }

        .rc-sig-line {
          border-bottom: 1px solid #64748b;
          height: 8px;
          margin-top: 2px;
        }

        .rc-footer-note {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #0b1f4d;
          color: #fff;
          font-size: 11px;
          font-style: italic;
          font-weight: 600;
          padding: 7px 16px;
          margin: 14px -18px -16px;
        }

        .rc-footer-icon {
          width: 15px;
          height: 15px;
          border-radius: 50%;
          background: #fff;
          color: #0b1f4d;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 10px;
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
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            box-shadow: none;
            width: 190mm;
            max-height: 138mm;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .rc-frame {
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A5 landscape;
            margin: 4mm;
          }
        }
      `}</style>
    </>
  );
}