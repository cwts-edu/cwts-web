const colors = require("tailwindcss/colors");
const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    colors: {
      darkviolet: {
        DEFAULT: "#410659",
      },
      maxpurple: {
        DEFAULT: "#6E4080",
      },
      rebeccapurple: {
        DEFAULT: "#6126A2",
      },
      gray: colors.gray,
      white: colors.white,
      black: colors.black,
    },
    fontFamily: {
      sans: [
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
      ],
      serif: defaultTheme.fontFamily.serif,
    },
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
    },
  },
  plugins: [],
};
