const colors = require("tailwindcss/colors");
const defaultTheme = require("tailwindcss/defaultTheme");

const defaultFont = [
  "Helvetica",
  "Tahoma",
  "Arial",
  '"PingFang TC"',
  '"PingFang SC"',
  '"Heiti TC"',
  '"微軟正黑體"',
  '"Microsoft JhengHei"',
  '"微软雅黑"',
  '"Microsoft YaHei"',
  '"Noto Sans TC"',
  '"Noto Sans SC"',
  "Roboto",
  '"Segoe UI"',
  "sans-serif",
];

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        darkerviolet: {
          DEFAULT: "#330047",
        },
        darkviolet: {
          DEFAULT: "#410659",
        },
        maxpurple: {
          DEFAULT: "#6E4080",
        },
        rebeccapurple: {
          DEFAULT: "#6126A2",
        },
        darkblue: {
          DEFAULT: "#211F54",
        },
      },
    },
    fontFamily: {
      sans: defaultFont,
      serif: defaultTheme.fontFamily.serif,
      ui: ['"Roboto Condensed"', ...defaultFont],
    },
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
