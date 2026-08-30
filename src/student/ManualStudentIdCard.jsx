// src/student/ManualStudentIdCard.jsx
// Renders a MANUALLY-created Student ID card (front + back) using the exact
// printed template design as the background, with the teacher-entered data
// (name, grade, ID No, issue date, expire date) and uploaded photo overlaid
// on top at the correct positions.
//
// FIX (this pass): the printed template (ID_Front.png) changed to the new
// "AL - ISRA" design — a plain rounded-SQUARE photo box (not the old
// "shield with a pointed bottom" shape) and four separate labeled boxes
// ("Full Name" box, "GRADE" pill, and stacked "ID No:#" / "Issue Date:" /
// "Expire Date:" value boxes). Every position below was re-measured
// pixel-by-pixel from the actual 1024×1536 ID_Front.png (scanning for the
// green/gray box outlines), replacing the old template's coordinates:
//   - Photo box: now a rounded square (border-radius ~9%), no shield
//     clip-path needed — PHOTO_CLIP is gone, PHOTO_BOX moved slightly.
//   - Full Name now sits inside its own wide labeled box (~8.3% inset on
//     each side) instead of floating free above the GRADE line.
//   - GRADE value box narrowed to where the small pill actually is
//     (50.1%–70.0% of card width).
//   - ID No / Issue Date / Expire Date value boxes all share the same
//     left/right bounds (39.45%–91.3%) — previously anchored to the old
//     template's different box positions.
//
// FIX (earlier pass): studentPhoto can now be a real Firebase Storage URL
// (fetched straight from the student's own `students/{id}` record), not
// only a base64 data URL from a manual upload. The front-photo <img> had
// crossOrigin="anonymous" hardcoded on it — harmless for base64 data URLs,
// but for a real cross-origin Storage URL it forces the browser into
// CORS mode, and since the Storage bucket doesn't send CORS headers for
// this origin, the request fails and the photo shows as broken. A plain
// <img> (no crossOrigin) displays a cross-origin URL fine without any
// CORS headers required — same as opening the URL directly in a tab — so
// the attribute is removed. (Only affects display.)
//
// FIX (earlier pass): the QR overlay on the back had gone missing in a prior
// version of this file — restored below. A real QR code linking to this
// card's own /verify/student/{studentId} page is drawn on top of the
// printed QR placeholder box on ID_Back.png, so scanning it opens THIS
// card instead of the general site.
//
// The template artwork itself is never redrawn here — the two PNGs below ARE
// the design (front is the blank template, back is unchanged). Only the data
// is positioned over the front. All positions are percentages of the card, so
// the card scales cleanly for on-screen preview, download (html2canvas), and
// print without the overlay drifting.
//
// The full name auto-shrinks to fit on its single line, so long names like
// "GUULEED IBRAAHIM DAAHIR" are shown in full instead of being clipped.
//
// Used by admin/pages/AllIdCards.jsx for manually-created student cards, and
// by pages/StudentIdVerify.jsx for the public QR-scan verification page.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import idFront from "../admin/assets/ID_Front.png";
import idBack from "../admin/assets/ID_Back.png";

// The card keeps the template's real aspect ratio (1024 x 1536 px source).
const CARD_W = 340; // on-screen width; height derived from the ratio
const RATIO = 1536 / 1024;

// Label row centers, measured directly from the real ID_Front.png template
// (1024x1536 source, as % of card height) — each value sits centered
// (vertically) inside its own printed box on the template:
//   Full Name box ~58.5%–64.6% (center 61.6%) · GRADE pill ~65.5%–70.2% (center 67.8%)
//   ID No box ~73.8% center · Issue Date box ~79.6% center · Expire Date box ~85.2% center
const POS = {
  name: 61.6,
  grade: 67.8,
  idNo: 73.8,
  issue: 79.6,
  expire: 85.2,
};

// Student photo box — the new template's photo area is a plain rounded
// SQUARE (not the old shield shape), measured pixel-by-pixel from the
// green outline in ID_Front.png: outer left 288px, top 435px, right
// 737px, bottom 877px (of the 1024x1536 source).
const PHOTO_BOX = { left: "28.1%", top: "28.3%", width: "43.9%", height: "28.8%" };
// Corner radius measured from the rounded-square outline (~40px out of
// ~449px box width ≈ 9%). A plain CSS border-radius replaces the old
// shield clip-path entirely — no clip-path needed for this shape.
const PHOTO_RADIUS = "9%";

// Verify-link QR code shown on the back — mirrors StudentIdCard.jsx's own
// /verify/student/{id} pattern so a manual card's QR resolves the same way.
const SCHOOL_WEBSITE = "alisraschool.com";
function qrSrc(studentId) {
  const qrTarget = `https://${SCHOOL_WEBSITE}/verify/student/${encodeURIComponent(studentId)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(qrTarget)}`;
}

// Position of the printed QR placeholder box on ID_Back.png, as % of the
// card (unchanged — the back template artwork did not change in this pass).
const QR_BOX = { left: "33%", top: "70%", width: "36%", height: "20.7%" };

export default function ManualStudentIdCard({ card }) {
  const {
    fullName,
    studentId,
    grade,
    className,
    studentPhoto, // data URL (manual upload) OR a Firebase Storage URL (auto-fetched from students/{id})
    issueDate,
    expireDate,
  } = card || {};

  const gradeText = grade || className || "";

  return (
    <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
      {/* FRONT */}
      <div
        style={{
          position: "relative",
          width: CARD_W,
          height: CARD_W * RATIO,
          backgroundImage: `url(${idFront})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          fontFamily: "'Inter','Segoe UI',sans-serif",
          flexShrink: 0,
        }}
      >
        {/* Student photo — rounded square, matching the new template's
            plain rounded-corner box (no shield point at the bottom). */}
        <div
          style={{
            position: "absolute",
            left: PHOTO_BOX.left,
            top: PHOTO_BOX.top,
            width: PHOTO_BOX.width,
            height: PHOTO_BOX.height,
            overflow: "hidden",
            borderRadius: PHOTO_RADIUS,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {studentPhoto ? (
            <img
              src={studentPhoto}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
        </div>

        {/* Full Name — sits inside its own printed box, centered, auto-shrinks
            to fit its line. */}
        <FitText
          text={fullName || ""}
          top={`${POS.name}%`}
          left="8.3%"
          right="8.3%"
          maxFontPx={CARD_W * 0.066}
          minFontPx={CARD_W * 0.03}
          color="#111827"
          align="center"
        />

        {/* GRADE value — centered inside the small printed pill next to
            the word "GRADE" (left 50.1% – right 29.98%, i.e. pill spans
            50.1%–70.0% of the card width). */}
        <FitText
          text={gradeText}
          top={`${POS.grade}%`}
          left="50.1%"
          right="29.98%"
          maxFontPx={CARD_W * 0.06}
          minFontPx={CARD_W * 0.028}
          color="#1e2a78"
          align="center"
        />

        {/* ID No value — inside the printed value box (39.45%–91.3% of
            card width), left-aligned with a small inset from the box's
            own left edge. */}
        <FitText
          text={studentId || ""}
          top={`${POS.idNo}%`}
          left="41%"
          right="9%"
          maxFontPx={CARD_W * 0.05}
          minFontPx={CARD_W * 0.03}
          color="#111827"
          align="left"
        />

        {/* Issue Date value — same box bounds as ID No, next row down. */}
        <FitText
          text={issueDate || ""}
          top={`${POS.issue}%`}
          left="41%"
          right="9%"
          maxFontPx={CARD_W * 0.05}
          minFontPx={CARD_W * 0.03}
          color="#111827"
          align="left"
        />

        {/* Expire Date value — same box bounds, bottom row. */}
        <FitText
          text={expireDate || ""}
          top={`${POS.expire}%`}
          left="41%"
          right="9%"
          maxFontPx={CARD_W * 0.05}
          minFontPx={CARD_W * 0.03}
          color="#111827"
          align="left"
        />
      </div>

      {/* BACK — template background unchanged, but the printed QR box is no
          longer just decorative artwork: a real QR code pointing at this
          card's own /verify/student/{studentId} page is overlaid directly
          on top of it (same link pattern StudentIdCard.jsx uses), so
          scanning it opens this exact card instead of the general site. */}
      <div
        style={{
          position: "relative",
          width: CARD_W,
          height: CARD_W * RATIO,
          backgroundImage: `url(${idBack})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          borderRadius: 10,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {studentId ? (
          <img
            src={qrSrc(studentId)}
            alt="Verify QR code"
            crossOrigin="anonymous"
            style={{
              position: "absolute",
              left: QR_BOX.left,
              top: QR_BOX.top,
              width: QR_BOX.width,
              height: QR_BOX.height,
              objectFit: "contain",
              background: "#fff",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

// A single-line text overlay that shrinks its font size until the text fits
// within its box, so long values are shown in full (never clipped). Sits
// absolutely-positioned over the card background.
function FitText({ text, top, left, right, maxFontPx, minFontPx, bold, color, align }) {
  const boxRef = useRef(null);
  const spanRef = useRef(null);
  const [fontPx, setFontPx] = useState(maxFontPx);

  useLayoutEffect(() => {
    setFontPx(maxFontPx); // reset before measuring for the new text
  }, [text, maxFontPx]);

  useEffect(() => {
    const box = boxRef.current;
    const span = spanRef.current;
    if (!box || !span) return;
    let size = maxFontPx;
    span.style.fontSize = `${size}px`;
    // Shrink until the text fits the available width (or we hit the minimum).
    let guard = 0;
    while (span.scrollWidth > box.clientWidth && size > minFontPx && guard < 60) {
      size -= 0.5;
      span.style.fontSize = `${size}px`;
      guard += 1;
    }
    setFontPx(size);
  }, [text, maxFontPx, minFontPx]);

  return (
    <div
      ref={boxRef}
      style={{
        position: "absolute",
        top,
        left,
        right,
        display: "flex",
        justifyContent: align === "center" ? "center" : "flex-start",
        alignItems: "center",
        overflow: "hidden",
        transform: "translateY(-50%)",
      }}
    >
      <span
        ref={spanRef}
        style={{
          whiteSpace: "nowrap",
          fontSize: fontPx,
          fontWeight: bold ? 800 : 600,
          color,
          lineHeight: 1,
        }}
      >
        {text}
      </span>
    </div>
  );
}