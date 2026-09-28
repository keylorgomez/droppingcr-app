/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Escala monocromática ─────────────────────────────────────────
        // Negro base #0a0a0a en vez de #000 puro: menos vibración sobre
        // blanco y deja margen para un negro más profundo en overlays.
        ink: {
          DEFAULT: "#0a0a0a",
          950: "#000000",
          900: "#0a0a0a",
          800: "#1a1a1a",
          700: "#2e2e2e",
          600: "#4a4a4a",
          500: "#6b6b6b",
          400: "#909090",
          300: "#b8b8b8",
          200: "#d9d9d9",
          100: "#ebeae8",
          50:  "#f5f4f2",
        },
        bone: "#faf9f7",

        // Único color del sistema y con un único significado: precio rebajado.
        // Justamente porque todo lo demás es blanco y negro, basta con que
        // aparezca en ~1 de cada 4 tarjetas para que se vea desde lejos.
        // Contraste: 5.9:1 con blanco encima, 5.6:1 como texto sobre `bone`.
        sale: "#c8102e",

        // ── Alias de compatibilidad ──────────────────────────────────────
        // Mapean los tokens de la marca anterior a la paleta monocromática
        // para que las 40+ pantallas ya existentes se rebrandeen sin tocarlas.
        brand: {
          bg:      "#faf9f7",
          primary: "#0a0a0a",
          accent:  "#4a4a4a",
          dark:    "#0a0a0a",
        },
        promo: {
          bg:    "#0a0a0a",
          blush: "#ffffff",
          coral: "#2e2e2e",
        },
      },

      fontFamily: {
        // Grotesca de UI: precios, formularios, todo el backoffice
        sans:    ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        // Display condensado — hereda la tensión del logo
        display: ["Anton", "Impact", "Haettenschweiler", "sans-serif"],
        // Serif editorial para frases-acento en cursiva
        serif:   ['"Instrument Serif"', "Georgia", "serif"],
        // Alias heredado: el codebase usa `font-poppins` en ~40 archivos
        poppins: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },

      borderRadius: {
        // Regla: las SECCIONES a sangre (hero, destacado, footer) van cuadradas;
        // todo objeto discreto —tarjeta, botón, input, chip— lleva radio.
        chip:  "6px",
        btn:   "10px",
        card:  "12px",
        panel: "16px",
      },

      letterSpacing: {
        tightest: "-0.045em",
        display:  "-0.02em",
        wider2:   "0.14em",
        widest2:  "0.22em",
        mega:     "0.32em",
      },

      boxShadow: {
        card:  "0 1px 2px rgba(10,10,10,0.04)",
        lift:  "0 18px 40px -20px rgba(10,10,10,0.35)",
        sheet: "0 -8px 40px -12px rgba(10,10,10,0.25)",
      },

      transitionTimingFunction: {
        // Curva única del sistema: salida rápida, asentamiento largo
        drop: "cubic-bezier(0.16, 1, 0.3, 1)",
      },

      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to:   { transform: "translateX(-50%)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        // Sin opacidad a propósito: la usa la grilla de producto, donde una
        // animación congelada a mitad no puede dejar la prenda invisible.
        rise: {
          from: { transform: "translateY(16px)" },
          to:   { transform: "translateY(0)" },
        },
        "ken-burns": {
          from: { transform: "scale(1)" },
          to:   { transform: "scale(1.12)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },

      animation: {
        marquee:     "marquee 28s linear infinite",
        "marquee-fast": "marquee 16s linear infinite",
        "fade-up":   "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        rise:        "rise 0.6s cubic-bezier(0.16,1,0.3,1) both",
        "ken-burns": "ken-burns 18s ease-out forwards",
        shimmer:     "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
}
