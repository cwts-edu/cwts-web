const colors = require("tailwindcss/colors");
const defaultTheme = require("tailwindcss/defaultTheme");

const round = (num) =>
  num
    .toFixed(7)
    .replace(/(\.[0-9]+?)0+$/, "$1")
    .replace(/\.0$/, "");
const rem = (px) => `${round(px / 16)}rem`;
const em = (px, base) => `${round(px / base)}em`;

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

const themeColors = {
  darkerviolet: "#330047",
  darkviolet: "#410659",
  maxpurple: "#6E4080",
  rebeccapurple: "#6126A2",
  darkblue: "#211F54",
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        darkerviolet: {
          DEFAULT: themeColors.darkerviolet,
        },
        darkviolet: {
          DEFAULT: themeColors.darkviolet,
        },
        maxpurple: {
          DEFAULT: themeColors.maxpurple,
        },
        rebeccapurple: {
          DEFAULT: themeColors.rebeccapurple,
        },
        darkblue: {
          DEFAULT: themeColors.darkblue,
        },
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            "--tw-prose-body": themeColors.darkblue,
            "--tw-prose-headings": themeColors.darkviolet,
            "--tw-prose-counters": "inherit",
            "--tw-prose-bullets": "inherit",
            fontSize: rem(20),
            lineHeight: round(28 / 20),
            h1: {
              fontSize: em(30, 20),
              marginTop: em(30, 30),
              marginBottom: em(30, 30),
            },
            h2: {
              fontSize: em(28, 20),
              marginTop: em(28, 28),
              marginBottom: em(28, 28),
              fontWeight: "600",
            },
            '[class~="lead"]': {
              fontSize: em(20, 20),
              lineHeight: round(28 / 20),
              marginTop: em(20, 20),
              marginBottom: em(20, 20),
            },
          },
        },
      }),
    },
    fontFamily: {
      sans: defaultFont,
      serif: defaultTheme.fontFamily.serif,
      ui: ['"Roboto Condensed"', ...defaultFont],
    },
    screens: {
      sm: "576px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    require("tailwind-scrollbar-hide"),
  ],
};
