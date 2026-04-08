import { useState, useEffect } from "react";

const TEXTS = [
  "Global drip",
  "Vintage fits",
  "Limited drops",
  "Envíos a todo el país por medio de Correos de CR",
];

const TYPE_SPEED   = 55;
const DELETE_SPEED = 28;
const PAUSE_AFTER_TYPE   = 1600;
const PAUSE_AFTER_DELETE = 350;

export default function TypewriterBanner() {
  const [textIndex, setTextIndex]     = useState(0);
  const [displayed, setDisplayed]     = useState("");
  const [phase, setPhase]             = useState<"typing" | "pausing" | "deleting" | "waiting">("typing");

  useEffect(() => {
    const full = TEXTS[textIndex];

    if (phase === "typing") {
      if (displayed.length < full.length) {
        const t = setTimeout(() => setDisplayed(full.slice(0, displayed.length + 1)), TYPE_SPEED);
        return () => clearTimeout(t);
      } else {
        const t = setTimeout(() => setPhase("pausing"), PAUSE_AFTER_TYPE);
        return () => clearTimeout(t);
      }
    }

    if (phase === "pausing") {
      setPhase("deleting");
    }

    if (phase === "deleting") {
      if (displayed.length > 0) {
        const t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), DELETE_SPEED);
        return () => clearTimeout(t);
      } else {
        const t = setTimeout(() => {
          setTextIndex((i) => (i + 1) % TEXTS.length);
          setPhase("typing");
        }, PAUSE_AFTER_DELETE);
        return () => clearTimeout(t);
      }
    }
  }, [phase, displayed, textIndex]);

  return (
    <div className="w-full bg-brand-primary px-4 py-1.5 flex items-center justify-center">
      <p className="font-poppins text-[11px] font-semibold text-white tracking-wide text-center min-h-[1rem]">
        {displayed}
        <span className="inline-block w-px h-[11px] bg-white ml-px align-middle animate-pulse" />
      </p>
    </div>
  );
}
