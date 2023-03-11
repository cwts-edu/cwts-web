const colors = require("tailwindcss/colors");
const defaultTheme = require("tailwindcss/defaultTheme");
const plugin = require("tailwindcss/plugin");

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
  lightpurple: "#93729F",
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
        ...Object.keys(themeColors).reduce((result, key) => {
          result[key] = {
            DEFAULT: themeColors[key],
          };
          return result;
        }, {}),
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            "--tw-prose-body": themeColors.darkblue,
            "--tw-prose-headings": themeColors.darkviolet,
            "--tw-prose-links": themeColors.darkviolet,
            "--tw-prose-bold": "inherit",
            "--tw-prose-counters": "inherit",
            "--tw-prose-bullets": "inherit",
            "max-width": "none",
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
        tabs: {
          css: {
            "--tw-prose-body": theme.colors.black,
            "--tw-prose-headings": theme.colors.black,
            fontSize: rem(16),
            h1: {
              fontSize: em(20, 16),
            },
            h1: {
              fontSize: em(20, 16),
              marginTop: em(8, 20),
              marginBottom: em(8, 20),
            },
            h2: {
              fontSize: em(18, 16),
              marginTop: em(8, 18),
              marginBottom: em(8, 18),
            },
            li: {
              marginTop: "0",
              marginBottom: "0",
              marginLeft: "0",
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
    plugin(function ({ addVariant, e }) {
      addVariant("activetab", [
        ".tabs-component > input[type='radio']:checked + label&",
        ".tabs-component > input[type='radio']:checked + label &",
      ]);
      addVariant("activepanel", [
        ".tabs-component > input[type='radio']:checked + label + &.panel",
        ".tabs-component > input[type='radio']:checked + label + .panel &",
      ]);
    }),
  ],
};
