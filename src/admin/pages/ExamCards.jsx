import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { db } from "../../firebase/firebase";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { IdCard, Printer, Search, Trash2, X } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
// ✅ Sawirka asalka ah ee Exam Card-ka (template-ka dhabta ah, sida uu
// maamulku VS Code ku arkay src/admin/assets/examcard.png) — kani WUXUU
// AH design-ka, ma ahan mid dib loo sameeyay. Xogta ardayga oo kaliya
// ayaa lagu daabacaa (overlay) dul sawirkan.
import examCardBg from "../assets/examcard.png";

const SCHOOL_NAME_EN = "AL - ISRA PRIMARY & SECONDARY SCHOOL";
const SCHOOL_NAME_AR = "مدرسة ريسن استار الأساسية والثانوية";

const CLASS_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];
function classRank(c) {
  const i = CLASS_ORDER.indexOf(String(c || "").toUpperCase());
  return i === -1 ? 999 : i;
}

// ✅ "label" (badge-ka gaaban ee liiska boggan) iyo "printLabel" (qoraalka
// buuxa ee lagu daabacaya card-ka daabacan, halkii "Final Exam" ee
// template-ka lagu shuban) — labaduba waxay ka yimaadaan isla nooca
// (card.examType) ee ExamTimetable.jsx maamulku ka doortay.
const EXAM_TYPES = [
  { key: "monthly1", label: "Monthly 1", printLabel: "Monthly Exam Test 1" },
  { key: "midterm", label: "Mid Term", printLabel: "Midterm Exam" },
  { key: "monthly2", label: "Monthly 2", printLabel: "Monthly Test 2" },
  { key: "final", label: "Final", printLabel: "Final Exam" },
];
function examPrintLabel(examType) {
  return EXAM_TYPES.find((t) => t.key === examType)?.printLabel || "Final Exam";
}

function pad4(n) {
  return String(n).padStart(4, "0");
}

function formatDate(ts) {
  if (!ts?.seconds) return new Date().toLocaleDateString("en-GB");
  return new Date(ts.seconds * 1000).toLocaleDateString("en-GB");
}

// Sawirka template-ka (864x1536 px) — booskiisa oo dhan waa la cabbiray
// pixel-by-pixel si xogta la daabaco ay si sax ah ugu dhacdo goobaha
// bannaan ee sawirka (photo box, STUDENT ID box, Date/Name/Class/Amount
// underlines). Dhammaan waa boqolkiiba (%) card-ka si uu u sii shaqeeyo
// cabbir kastoo card-ku noqdo.
const CARD_RATIO = 1536 / 864; // dherer/ballaadh — dhawr card oo la mid ah

const PHOTO_BOX = { left: "4.75%", top: "40.3%", width: "26.0%", height: "19.7%" };
const ID_VALUE_BOX = { left: "4.75%", top: "65.0%", width: "26.0%" }; // center y ~66.1%
const DATE_LINE = { left: "71.2%", right: "7.6%", top: "45.2%" };
const NAME_LINE = { left: "47.9%", right: "7.1%", top: "62.9%" };
const CLASS_LINE = { left: "17.1%", right: "63.5%", top: "72.5%" };
const AMOUNT_LINE = { left: "70.1%", right: "7.6%", top: "72.5%" };
// Goobta "Final Exam" ee ku shubran sawirka template-ka (baked-in text) —
// waa la daboolayaa midab la mid ah dharka background-ka cream-ka ah
// (244,239,233), kadibna nooca dhabta ah ee imtixaanka ayaa lagu
// daabacayaa meeshaas isla goobtaas.
const EXAM_TYPE_MASK = { left: "30.1%", top: "34.4%", width: "39.4%", height: "4.8%" };
const MASK_COLOR = "rgb(244,239,233)";

function ExamCardStyles() {
  return (
    <style>{`
      .ec-layout { display: flex; min-height: 100vh; background: #0b0a1c; }
      .ec-content { flex: 1; min-width: 0; }
      .ec-page-chunk {
        display: grid;
        grid-template-columns: repeat(2, minmax(220px, 1fr));
        gap: 20px;
        margin-bottom: 24px;
      }
      .ec-card-wrap { position: relative; }
      .ec-card-actions {
        position: absolute;
        top: -12px;
        right: -12px;
        display: flex;
        gap: 6px;
        z-index: 5;
      }
      .ec-icon-btn {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(0,0,0,0.35);
      }
      .ec-card {
        position: relative;
        width: 100%;
        aspect-ratio: 864 / 1536;
        background-image: url(${examCardBg});
        background-size: 100% 100%;
        background-repeat: no-repeat;
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 6px 18px rgba(0,0,0,0.4);
        font-family: Georgia, 'Times New Roman', serif;
      }
      .ec-photo-box {
        position: absolute;
        overflow: hidden;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .ec-photo-box img { width: 100%; height: 100%; object-fit: cover; }

      /* ---- Print: 4 card oo warqad A4 ah ----
         Ardayda waxaa loo kala qaybiyaa kooxo 4-4 ah (JS-ka), kooxdiiba
         waa "bog" — grid 2x2 gudaheeda, kadibna page-break marka bog kastaa
         dhammaado, mid dambe mooyaane. */
      @media print {
        @page { size: A4 portrait; margin: 10mm; }
        body * { visibility: hidden; }
        .ec-print-area, .ec-print-area * { visibility: visible; }
        .ec-print-area { position: absolute; top: 0; left: 0; width: 100%; }
        .ec-print-area, .ec-print-area * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        /* ✅ FIX #2: CSS Grid does not paginate/print reliably in Chrome
           (it's a known limitation — grid tracks can silently collapse
           to a single column when printing, which is exactly what was
           happening here). Switched to Flexbox with fixed-width
           wrapping items instead, which Chrome's print engine handles
           correctly: 76mm cards + 5mm gap = 157mm per row, so exactly
           2 cards wrap per row (top row, then bottom row) inside the
           190mm-wide printable area, every time. */
        /* ✅ FIX #3: cards were sized only to fill the HEIGHT budget
           (76mm × 135mm), leaving unused space on both sides of the
           page width. Now sized to fill the full printable area
           (190mm × 277mm) exactly, edge to edge, with one uniform 6mm
           gap in both directions — so the top row spans the full page
           width, the bottom row matches it exactly, and the gap
           between every card (left-right and top-bottom) is the same. */
        .ec-page-chunk {
          display: flex !important;
          flex-wrap: wrap;
          gap: 6mm;
          width: 190mm;
          height: 277mm;
          margin: 0 auto;
          page-break-after: always;
        }
        .ec-page-chunk:last-child { page-break-after: auto; }
        .ec-card-wrap {
          break-inside: avoid;
          page-break-inside: avoid;
          flex: 0 0 92mm;
          width: 92mm;
          height: 135mm;
        }
        .ec-card {
          width: 92mm !important;
          height: 135mm !important;
          aspect-ratio: unset !important;
          box-shadow: none !important;
        }
        .ec-hide-print { display: none !important; }
        .ec-card-actions { display: none !important; }
      }
      @media (max-width: 900px) {
        .ec-page-pad { padding: 16px !important; }
        .ec-page-chunk { grid-template-columns: 1fr; }
        .ec-toolbar { flex-direction: column; align-items: stretch !important; }
      }
    `}</style>
  );
}

// ---- Qoraal is-yaraynaya font-kiisa ilaa uu ku fillaado goobta la siiyay
// (halkii magaca dheer loo goyn lahaa "..."). Isticmaalka ugu weyn:
// magaca ardayga ee card-ka — magacyo dhaadheer sida "Abdimalik Aweys
// Hassan Mohamed" hadda way muuqan doonaan si buuxda, iyagoo font-kooda
// si otomaatig ah loo yareeyo, halkii lagu gooyn lahaa "...". ----
function FitText({ text, maxFontPx, minFontPx, style }) {
  const boxRef = useRef(null);
  const spanRef = useRef(null);
  const [fontPx, setFontPx] = useState(maxFontPx);

  useLayoutEffect(() => {
    setFontPx(maxFontPx);
  }, [text, maxFontPx]);

  useEffect(() => {
    const box = boxRef.current;
    const span = spanRef.current;
    if (!box || !span) return;
    let size = maxFontPx;
    span.style.fontSize = `${size}px`;
    let guard = 0;
    while (span.scrollWidth > box.clientWidth && size > minFontPx && guard < 60) {
      size -= 0.4;
      span.style.fontSize = `${size}px`;
      guard += 1;
    }
    setFontPx(size);
  }, [text, maxFontPx, minFontPx]);

  return (
    <div ref={boxRef} style={{ ...style, overflow: "hidden", display: "flex" }}>
      <span ref={spanRef} style={{ whiteSpace: "nowrap", fontSize: fontPx, fontWeight: 700 }}>
        {text}
      </span>
    </div>
  );
}

function ExamCard({ card, onDelete, onPrintSingle, isPrintHidden }) {
  return (
    <div className={`ec-card-wrap${isPrintHidden ? " ec-hide-print" : ""}`}>
      <div className="ec-card-actions">
        <button
          className="ec-icon-btn"
          onClick={() => onPrintSingle(card)}
          title="Daabac Card-kan Kaliya"
          style={{ background: "#22C55E", color: "#fff" }}
        >
          <Printer size={14} />
        </button>
        <button
          className="ec-icon-btn"
          onClick={() => onDelete(card)}
          title="Tirtir Card-kan"
          style={{ background: "#ef4444", color: "#fff" }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="ec-card">
        {/* Sawirka ardayga — la soo aqriyay xogta students collection-ka */}
        <div
          className="ec-photo-box"
          style={{
            left: PHOTO_BOX.left,
            top: PHOTO_BOX.top,
            width: PHOTO_BOX.width,
            height: PHOTO_BOX.height,
          }}
        >
          {card.studentPhoto ? (
            <img src={card.studentPhoto} alt="" />
          ) : null}
        </div>

        {/* Student ID — sanduuqa cad ee ka hooseeya "STUDENT ID" pill-ka */}
        <div
          style={{
            position: "absolute",
            left: ID_VALUE_BOX.left,
            top: ID_VALUE_BOX.top,
            width: ID_VALUE_BOX.width,
            transform: "translateY(-50%)",
            textAlign: "center",
            fontWeight: 800,
            fontSize: "clamp(10px, 2.6cqw, 15px)",
            color: "#0f2a4a",
          }}
        >
          {card.studentId}
        </div>

        {/* Goobta "Final Exam" ee sawirka lagu shubay — waa la daboolayaa
            midabka background-ka, kadibna nooca dhabta ah ee imtixaanka
            ayaa lagu daabacayaa isla goobtaas. */}
        <div
          style={{
            position: "absolute",
            left: EXAM_TYPE_MASK.left,
            top: EXAM_TYPE_MASK.top,
            width: EXAM_TYPE_MASK.width,
            height: EXAM_TYPE_MASK.height,
            background: MASK_COLOR,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: EXAM_TYPE_MASK.left,
            top: EXAM_TYPE_MASK.top,
            width: EXAM_TYPE_MASK.width,
            height: EXAM_TYPE_MASK.height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "clamp(13px, 4.2cqw, 24px)",
            color: "#0f5132",
            whiteSpace: "nowrap",
          }}
        >
          {examPrintLabel(card.examType)}
        </div>

        {/* Date */}
        <div
          style={{
            position: "absolute",
            left: DATE_LINE.left,
            right: DATE_LINE.right,
            top: DATE_LINE.top,
            transform: "translateY(-100%)",
            textAlign: "center",
            fontWeight: 700,
            fontSize: "clamp(9px, 2cqw, 13px)",
            color: "#0f2a4a",
          }}
        >
          {formatDate(card.createdAt)}
        </div>

        {/* Name — is-yaraysa font-kiisa si magaca oo dhan uu u muuqdo,
            marnaba lama gooyo "..." */}
        <FitText
          text={card.studentName}
          maxFontPx={16}
          minFontPx={7}
          style={{
            position: "absolute",
            left: NAME_LINE.left,
            right: NAME_LINE.right,
            top: NAME_LINE.top,
            transform: "translateY(-100%)",
            justifyContent: "center",
            color: "#0f2a4a",
          }}
        />

        {/* Class */}
        <div
          style={{
            position: "absolute",
            left: CLASS_LINE.left,
            right: CLASS_LINE.right,
            top: CLASS_LINE.top,
            transform: "translateY(-100%)",
            textAlign: "center",
            fontWeight: 700,
            fontSize: "clamp(9px, 2cqw, 13px)",
            color: "#0f2a4a",
          }}
        >
          {card.className}
        </div>

        {/* Amount — lacagtii cashierku ka qaaday ExamPayments.jsx */}
        <div
          style={{
            position: "absolute",
            left: AMOUNT_LINE.left,
            right: AMOUNT_LINE.right,
            top: AMOUNT_LINE.top,
            transform: "translateY(-100%)",
            textAlign: "center",
            fontWeight: 700,
            fontSize: "clamp(9px, 2cqw, 13px)",
            color: "#0f2a4a",
          }}
        >
          ${card.amountPaid ?? 0}
        </div>
      </div>
    </div>
  );
}

export default function ExamCards() {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null); // { type: "one"|"all", card? }
  const [printOnlyId, setPrintOnlyId] = useState(null); // card.id la doonayo in kaliya la daabaco

  useEffect(() => {
    load();
  }, []);

  // ---- Marka daabacaadda dhamaato (ama la joojiyo), dib u soo celi
  // muuqaalka grid-ka oo dhammaan card-yada laga arki karo mar kale. ----
  useEffect(() => {
    function handleAfterPrint() {
      setPrintOnlyId(null);
    }
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  // ---- Kaliya soo aqri examCards collection-ka — waxaa ka buuxiya
  // Cashierka marka uu arday lacagta imtixaanka ka qaado (ExamPayments
  // page-ka). Admin-ku halkan wuxuu daawadaa oo daabici karaa, isla markaana
  // wuu tirtiri karaa card mid mid ama dhammaan fasalka. ----
  async function load() {
    try {
      setLoading(true);
      // ✅ Xogta card-ka lafteeda (studentId, studentName, className,
      // amountPaid, examType, cardNo) waxay ka timaadaa examCards
      // collection-ka — laakiin sawirka ardayga (studentPhoto) waxaan
      // kaliya ka soo aqrinaynaa students collection-ka toos ah, si
      // sawirku mar walba u ahaado kii ugu dambeeyay ee ardaygu leeyahay,
      // ma ahan nuqul hore oo laga yaabo inuu banaan yahay.
      const [cardsSnap, studentsSnap] = await Promise.all([
        getDocs(collection(db, "examCards")),
        getDocs(collection(db, "students")),
      ]);

      const photoByStudentId = {};
      studentsSnap.docs.forEach((d) => {
        const s = d.data();
        if (s.studentId) photoByStudentId[s.studentId] = s.studentPhoto || "";
      });

      const data = cardsSnap.docs.map((d) => {
        const card = { id: d.id, ...d.data() };
        return { ...card, studentPhoto: photoByStudentId[card.studentId] || "" };
      });
      setCards(data);
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay marka Exam Cards la soo qaadanayay: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const classes = useMemo(() => {
    const set = new Set(cards.map((c) => c.className).filter(Boolean));
    return [...set].sort((a, b) => classRank(a) - classRank(b));
  }, [cards]);

  const cardsForClass = useMemo(() => {
    if (!selectedClass) return [];
    return cards
      .filter((c) => String(c.className).toUpperCase() === String(selectedClass).toUpperCase())
      .filter((c) => {
        const t = search.toLowerCase();
        return (
          !t ||
          (c.studentName || "").toLowerCase().includes(t) ||
          String(c.studentId).toLowerCase().includes(t)
        );
      })
      .sort((a, b) => (a.studentName || "").localeCompare(b.studentName || ""));
  }, [cards, selectedClass, search]);

  // ---- U kala qaybi cardsForClass kooxo 4-4 ah — kooxdiiba waa hal
  // "bog" A4 ah (grid 2x2). Marka hal card oo kaliya la doonayo in la
  // daabaco (printOnlyId), waxaan kaliya soo celinaynaa hal kooxo oo
  // ka kooban keliya cardkaas — haddii kale, kooxaha kale (oo dhammaan
  // cardadooda la qariyay) way sii samayn lahaayeen page-break bannaan
  // oo aan waxba ku qorayn. ----
  const cardChunks = useMemo(() => {
    if (printOnlyId) {
      const target = cardsForClass.find((c) => c.id === printOnlyId);
      return target ? [[target]] : [];
    }
    const chunks = [];
    for (let i = 0; i < cardsForClass.length; i += 4) {
      chunks.push(cardsForClass.slice(i, i + 4));
    }
    return chunks;
  }, [cardsForClass, printOnlyId]);

  function handlePrint() {
    window.print();
  }

  // ---- Kaliya card-kan la doortay ayaa la muujinayaa (kuwa kale si
  // caadi ah waa la qariyaa daabacaadda), kadibna daabacaadda ayaa
  // toos loo furayaa — hal card, hal warqad. ----
  function printSingleCard(card) {
    setPrintOnlyId(card.id);
    requestAnimationFrame(() => {
      window.print();
    });
  }

  function askDeleteOne(card) {
    setConfirmTarget({ type: "one", card });
  }

  function askDeleteAll() {
    if (cardsForClass.length === 0) return;
    setConfirmTarget({ type: "all" });
  }

  async function confirmDelete() {
    if (!confirmTarget) return;
    try {
      setDeleting(true);

      if (confirmTarget.type === "one") {
        await deleteDoc(doc(db, "examCards", confirmTarget.card.id));
        setCards((prev) => prev.filter((c) => c.id !== confirmTarget.card.id));
      } else {
        const idsToDelete = cardsForClass.map((c) => c.id);
        await Promise.all(idsToDelete.map((id) => deleteDoc(doc(db, "examCards", id))));
        setCards((prev) => prev.filter((c) => !idsToDelete.includes(c.id)));
      }

      setConfirmTarget(null);
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay marka la tirtirayay: " + err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="ec-layout">
      <ExamCardStyles />
      <Sidebar />

      <div className="ec-content">
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar />
        </div>

        <div className="ec-page-pad" style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div
              style={{
                width: 55,
                height: 55,
                borderRadius: 15,
                background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IdCard color="#fff" size={26} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, color: "#fff" }}>Exam Cards</h1>
              <div style={{ color: "#8b87ad", fontSize: 14 }}>
                Exam Cards ardayda cashierku u sameeyay marka lacagta imtixaanka la bixiyay
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ color: "#8b87ad", textAlign: "center", padding: 60 }}>
              Xogta ayaa la soo qaadayaa...
            </div>
          ) : cards.length === 0 ? (
            <div style={{ color: "#8b87ad", textAlign: "center", padding: 60 }}>
              Weli Exam Card lama sameyn. Marka cashierku uu ka qaado lacagta imtixaanka
              ardayda, kaararka halkan ayay ku soo muuqan doonaan.
            </div>
          ) : !selectedClass ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 16,
              }}
            >
              {classes.map((cls) => {
                const count = cards.filter(
                  (c) => String(c.className).toUpperCase() === cls.toUpperCase()
                ).length;
                return (
                  <button
                    key={cls}
                    onClick={() => setSelectedClass(cls)}
                    style={{
                      background: "linear-gradient(160deg,#151233,#181341)",
                      border: "1px solid rgba(139,108,245,0.25)",
                      borderRadius: 18,
                      padding: "20px",
                      textAlign: "left",
                      cursor: "pointer",
                      color: "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 16 }}>Fasalka: {cls}</div>
                    <div style={{ color: "#8b87ad", fontSize: 12.5, marginTop: 4 }}>
                      {count} card oo la sameeyay
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <div
                className="ec-toolbar"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 18,
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => setSelectedClass(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#8B5CF6",
                    fontWeight: 700,
                    fontSize: 13.5,
                    cursor: "pointer",
                  }}
                >
                  ← Dhamaan Fasallada
                </button>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ position: "relative" }}>
                    <Search
                      size={14}
                      color="#8b87ad"
                      style={{ position: "absolute", left: 10, top: 10 }}
                    />
                    <input
                      placeholder="Raadi arday..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(139,108,245,0.3)",
                        color: "#e5e3f7",
                        borderRadius: 10,
                        padding: "9px 12px 9px 30px",
                        fontSize: 13,
                        width: 180,
                      }}
                    />
                  </div>

                  <button
                    onClick={handlePrint}
                    disabled={cardsForClass.length === 0}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 18px",
                      borderRadius: 12,
                      border: "none",
                      background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <Printer size={15} />
                    Daabac Dhammaan
                  </button>

                  <button
                    onClick={askDeleteAll}
                    disabled={cardsForClass.length === 0}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 18px",
                      borderRadius: 12,
                      border: "1px solid rgba(239,68,68,0.4)",
                      background: "rgba(239,68,68,0.12)",
                      color: "#f87171",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={15} />
                    Tirtir Dhammaan
                  </button>
                </div>
              </div>

              <div style={{ color: "#c4b8f7", fontSize: 13, marginBottom: 16 }}>
                Fasalka <strong style={{ color: "#fff" }}>{selectedClass}</strong> —{" "}
                {cardsForClass.length} card
              </div>

              {cardsForClass.length === 0 ? (
                <div style={{ color: "#8b87ad", padding: 30, textAlign: "center" }}>
                  Cardad lama helin fasalkan/raadintan.
                </div>
              ) : (
                <div className={`ec-print-area${printOnlyId ? " ec-single-print" : ""}`}>
                  {cardChunks.map((chunk, chunkIdx) => (
                    <div className="ec-page-chunk" key={chunkIdx}>
                      {chunk.map((c) => (
                        <ExamCard
                          key={c.id}
                          card={c}
                          onDelete={askDeleteOne}
                          onPrintSingle={printSingleCard}
                          isPrintHidden={!!printOnlyId && printOnlyId !== c.id}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---- Popup xaqiijinta tirtiridda ---- */}
      {confirmTarget && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "linear-gradient(160deg,#151233,#181341)",
              border: "1px solid rgba(139,108,245,0.3)",
              borderRadius: 18,
              padding: 26,
              width: 380,
              maxWidth: "90%",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ color: "#fff", margin: 0, fontSize: 17 }}>Xaqiiji Tirtiridda</h3>
              <button
                onClick={() => setConfirmTarget(null)}
                style={{ background: "transparent", border: "none", color: "#8b87ad", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: "#c4b8f7", fontSize: 14, lineHeight: 1.5 }}>
              {confirmTarget.type === "one" ? (
                <>
                  Ma hubtaa inaad tirtirayso Exam Card-ka{" "}
                  <strong style={{ color: "#fff" }}>{confirmTarget.card.studentName}</strong>?
                  Tallaabadan lama soo celin karo.
                </>
              ) : (
                <>
                  Ma hubtaa inaad tirtirto <strong style={{ color: "#fff" }}>{cardsForClass.length}</strong>{" "}
                  Exam Card ee fasalka <strong style={{ color: "#fff" }}>{selectedClass}</strong>?
                  Tallaabadan lama soo celin karo.
                </>
              )}
            </p>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setConfirmTarget(null)}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 10,
                  border: "1px solid rgba(139,108,245,0.3)",
                  background: "transparent",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Jooji
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 10,
                  border: "none",
                  background: "#ef4444",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: deleting ? "not-allowed" : "pointer",
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? "Tirtiraya..." : "Haa, Tirtir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}