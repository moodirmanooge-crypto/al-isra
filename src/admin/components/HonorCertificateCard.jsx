// src/admin/components/HonorCertificateCard.jsx
// Renders the "Shahada Sharaf / Certificate of Honor" using the NEW
// printed template artwork (honor-certificate-template.png) as the
// background, with editable text overlaid on top.
//
// This template's placeholder wording is just "SHAHADA SHARAF",
// "CERTIFICATE OF HONOR", and "Magaca Ardayga" (the cursive name line) —
// there is no separate intro line or "Ardayga/Macalinka Mudan" label on
// this design, and the space below the HAMBALYO ribbon is a genuinely
// blank area (not baked-in placeholder text), so the Hambalyo paragraph
// and the issue date can be drawn there directly with no mask needed.
//
// Positions below were measured directly against the real template PNG
// (1491 x 1055 px) using pixel-level bright/dark text-band detection.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import honorTemplate from "./assets/honor-certificate-template.png";

const CARD_W = 1050;
const RATIO = 1055 / 1491; // matches the real template.png aspect ratio

const NAVY = "#0c1f4a";
const NAVY_TEXT = "#12266b";
const GOLD_GRADIENT = "linear-gradient(180deg, #f6db8f 0%, #dcaa3f 45%, #c28f28 100%)";
const FONT_FAMILY = "Arial, Helvetica, sans-serif";
const SCRIPT_FONT_FAMILY = "'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive";

// Default wording — matches the template artwork exactly. The admin can
// edit every one of these before generating.
export const HONOR_DEFAULTS = {
  introText: "Waxaa la gudoonsiinayaa",
  title: "SHAHADA SHARAF",
  subtitle: "CERTIFICATE OF HONOR",
  recipientLabelStudent: "Ardayga Mudan",
  recipientLabelTeacher: "Macalinka Mudan",
  hambalyoText: "HAMBALYO",
  bodyText:
    "Waxaan ku hambalyeynaynaa guushaada iyo dadaalkaaga. Waxaad si wanaagsan u soo dhammaystay waxbarshada dugsiga dhexe. Waxaan kuu rajeynaynaa mustaqbal ifaya, nolol wanaagsan iyo guulo waaweyn.",
  tagline: "Waxbarasho  •  Anshax  •  Horumar  •  Mustaqbal Wanaagsan",
};

// Field positions — { top, bottom, left, right } all in % of the card.
const FIELD = {
  title: { top: 22.0, bottom: 28.3, left: 22, right: 22 },
  subtitle: { top: 28.7, bottom: 32.0, left: 29, right: 29 },
  fullName: { top: 33.0, bottom: 42.0, left: 26, right: 26 },
  hambalyoText: { top: 56.5, bottom: 63.2, left: 33, right: 33 },
  bodyText: { top: 64.5, bottom: 78.3, left: 23, right: 21 },
  issueDate: { top: 80.3, bottom: 94.8, left: 68, right: 10 },
};

export default function HonorCertificateCard({ certificate, elementId }) {
  const { fullName, title, subtitle, hambalyoText, bodyText, issueDate } = certificate || {};

  // The name itself should not show until a real recipient has actually
  // been fetched.
  const hasRecipient = Boolean(fullName && fullName.trim());

  return (
    <div
      id={elementId}
      style={{
        position: "relative",
        width: CARD_W,
        height: CARD_W * RATIO,
        backgroundImage: `url(${honorTemplate})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        borderRadius: 6,
        overflow: "hidden",
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        fontFamily: FONT_FAMILY,
        flexShrink: 0,
      }}
    >
      <MaskedText
        {...FIELD.title}
        text={title || HONOR_DEFAULTS.title}
        maskBackground={NAVY}
        color="#ffffff"
        fontSize={32}
        fontWeight={800}
        letterSpacing={1}
      />

      <MaskedText
        {...FIELD.subtitle}
        text={subtitle || HONOR_DEFAULTS.subtitle}
        maskBackground={GOLD_GRADIENT}
        color={NAVY_TEXT}
        fontSize={17}
        fontWeight={800}
        letterSpacing={0.5}
      />

      <MaskedText
        {...FIELD.fullName}
        text={hasRecipient ? fullName : ""}
        maskBackground="#ffffff"
        color={NAVY_TEXT}
        fontSize={34}
        fontWeight={600}
        fontFamily={SCRIPT_FONT_FAMILY}
      />

      <MaskedText
        {...FIELD.hambalyoText}
        text={hambalyoText || HONOR_DEFAULTS.hambalyoText}
        maskBackground={NAVY}
        color="#ffffff"
        fontSize={21}
        fontWeight={800}
        letterSpacing={2}
      />

      {/* This whole area is genuinely blank on the new template artwork
          (no baked-in placeholder paragraph), so no mask is needed here. */}
      <MaskedParagraph
        {...FIELD.bodyText}
        text={bodyText || HONOR_DEFAULTS.bodyText}
        maskBackground="transparent"
        color={NAVY_TEXT}
        fontSize={13.5}
      />

      {/* Likewise, no date value is baked into the new template — only
          the "Taariikhda la bixiyay:" label is, and this box sits safely
          below it. */}
      <MaskedText
        {...FIELD.issueDate}
        text={issueDate || ""}
        maskBackground="transparent"
        color={NAVY_TEXT}
        fontSize={13}
        fontWeight={700}
        align="left"
      />
    </div>
  );
}

// MaskedText: draws a solid (or gradient) rectangle over the template's
// baked-in placeholder wording, then fits a single line of the real text
// on top, auto-shrinking the font so it never overflows its box.
function MaskedText({
  text,
  top,
  bottom,
  left,
  right,
  maskBackground,
  color,
  fontSize,
  fontWeight = 600,
  fontFamily,
  letterSpacing,
  fontStyle,
  align = "center",
}) {
  const boxRef = useRef(null);
  const spanRef = useRef(null);
  const [size, setSize] = useState(fontSize);
  const min = fontSize * 0.55;

  useLayoutEffect(() => {
    setSize(fontSize);
  }, [text, fontSize]);

  useEffect(() => {
    const box = boxRef.current;
    const span = spanRef.current;
    if (!box || !span) return;
    let s = fontSize;
    span.style.fontSize = `${s}px`;
    let guard = 0;
    while (span.scrollWidth > box.clientWidth && s > min && guard < 60) {
      s -= 0.5;
      span.style.fontSize = `${s}px`;
      guard += 1;
    }
    setSize(s);
  }, [text, fontSize, min]);

  return (
    <div
      ref={boxRef}
      style={{
        position: "absolute",
        top: `${top}%`,
        height: `${bottom - top}%`,
        left: `${left}%`,
        right: `${right}%`,
        background: maskBackground,
        display: "flex",
        justifyContent: align === "left" ? "flex-start" : "center",
        alignItems: "center",
        overflow: "hidden",
        boxSizing: "border-box",
        padding: align === "left" ? "0 2%" : 0,
      }}
    >
      {text ? (
        <span
          ref={spanRef}
          style={{
            whiteSpace: "nowrap",
            fontSize: size,
            fontFamily: fontFamily || FONT_FAMILY,
            fontWeight,
            fontStyle: fontStyle || "normal",
            letterSpacing: letterSpacing ? `${letterSpacing}px` : "0px",
            color,
            lineHeight: 1,
          }}
        >
          {text}
        </span>
      ) : null}
    </div>
  );
}

// MaskedParagraph: same masking idea as MaskedText but wraps onto
// multiple lines (used for the Hambalyo body paragraph).
function MaskedParagraph({ text, top, bottom, left, right, maskBackground, color, fontSize }) {
  return (
    <div
      style={{
        position: "absolute",
        top: `${top}%`,
        height: `${bottom - top}%`,
        left: `${left}%`,
        right: `${right}%`,
        background: maskBackground,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {text ? (
        <p
          style={{
            margin: 0,
            fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: 500,
            color,
            textAlign: "center",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
          }}
        >
          {text}
        </p>
      ) : null}
    </div>
  );
}