/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg:      "#ffefd1",
          primary: "#975023",
          accent:  "#a26720",
          dark:    "#000011",
        },
        promo: {
          bg:    "#0a0707",
          blush: "#e8776a",
          coral: "#bd5245",
        },
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
      },
    },
  },
  plugins: [],
}
