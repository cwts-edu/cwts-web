export const MEDIA_SPECS = {
  cover: { width: 1440, height: 1080, quality: 80, darken: { brightness: 0.4, saturation: 0.4 }, ext: '.cover.webp' },
  thumbnail: { width: 600, height: 350, quality: 80, ext: '.thumbnail.webp' },
  news: { width: 400, height: 220, quality: 85, ext: '.news.webp' },
  carousel: { width: 2560, height: 1067, quality: 90, ext: '.carousel.webp' },
  pdfCover: { height: 528, ext: '.pdf.cover.png' }
} as const;

export const SUPPORTED_LANGUAGES = ['zh', 'en'] as const;
export const DEFAULT_LANGUAGE = 'zh' as const;
