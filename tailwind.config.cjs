const colors = require('tailwindcss/colors');
const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		colors: {
			// https://www.tailwindshades.com/#color=282.65060240963857%2C87.36842105263156%2C18.627450980392158&step-up=10&step-down=8&hue-shift=0&name=purple&base-stop=7&overrides=e30%3D
			'purple': {
				DEFAULT: '#410659',
				50: '#E5B1FA',
				100: '#DD99F8',
				200: '#CC69F5',
				300: '#BC39F2',
				400: '#AA10E8',
				500: '#870CB9',
				600: '#640989',
				700: '#410659',
				800: '#250333',
				900: '#09010D'
			},
			// https://www.tailwindshades.com/#color=283.125%2C33.33333333333333%2C37.64705882352941&step-up=9&step-down=9&hue-shift=0&name=violet&base-stop=6&overrides=e30%3D
			'violet': {
				DEFAULT: '#6E4080',
				50: '#E3D3E9',
				100: '#D9C4E2',
				200: '#C6A5D2',
				300: '#B287C3',
				400: '#9E68B4',
				500: '#884F9F',
				600: '#6E4080',
				700: '#543161',
				800: '#392143',
				900: '#1F1224'
			},
			gray: colors.gray,
			white: colors.white,
			black: colors.black,
		},
		fontFamily: {
			'sans': 'Helvetica, Tahoma, Arial, "PingFang TC", "Heiti TC", "微軟正黑體", "Microsoft JhengHei", "Noto Sans CJK", sans-serif',
			'serif': defaultTheme.fontFamily.sans,
		}
	},
	plugins: [],
}
