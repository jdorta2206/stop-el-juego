/**
 * Halloween scare visuals.
 *
 * The clown is the real licensed photo already bundled in halloweenScareImage.ts.
 * The additional scares are standalone image assets (SVG data URLs), not CSS-drawn
 * faces in the React component. Keeping them as image assets makes the visual
 * selection independent from the overlay logic and avoids loading at scare time.
 */
import { HALLOWEEN_SCARE_IMAGE } from "@/lib/halloweenScareImage";

const svg = (body: string) =>
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920">${body}</svg>`,
  );

export const HALLOWEEN_SCARE_ASSETS = {
  clown: HALLOWEEN_SCARE_IMAGE,

  nightmare: svg(`
    <defs>
      <radialGradient id="bg"><stop offset="0" stop-color="#260000"/><stop offset=".58" stop-color="#080000"/><stop offset="1" stop-color="#000"/></radialGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
    </defs>
    <rect width="1080" height="1920" fill="url(#bg)"/>
    <ellipse cx="540" cy="1010" rx="330" ry="510" fill="#050505" opacity=".96" filter="url(#blur)"/>
    <ellipse cx="540" cy="990" rx="275" ry="450" fill="#111"/>
    <ellipse cx="440" cy="900" rx="58" ry="92" fill="#d8d8d8"/><ellipse cx="640" cy="900" rx="58" ry="92" fill="#d8d8d8"/>
    <ellipse cx="440" cy="910" rx="18" ry="40" fill="#090909"/><ellipse cx="640" cy="910" rx="18" ry="40" fill="#090909"/>
    <path d="M350 1110 Q540 1370 730 1110 Q680 1470 540 1510 Q400 1470 350 1110Z" fill="#020202"/>
    <path d="M430 1210 L650 1210" stroke="#7d0000" stroke-width="18"/>
    <path d="M395 1280 Q540 1360 685 1280" stroke="#b00000" stroke-width="10" fill="none"/>
    <path d="M0 1600 Q260 1420 540 1640 Q820 1420 1080 1600 V1920 H0Z" fill="#000"/>
  `),

  specter: svg(`
    <defs>
      <linearGradient id="fog" x2="0" y2="1"><stop stop-color="#020204"/><stop offset=".55" stop-color="#10131b"/><stop offset="1" stop-color="#000"/></linearGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="26"/></filter>
    </defs>
    <rect width="1080" height="1920" fill="url(#fog)"/>
    <g opacity=".25" filter="url(#soft)" fill="#9da8b7">
      <ellipse cx="180" cy="1260" rx="250" ry="170"/><ellipse cx="820" cy="1120" rx="300" ry="190"/>
    </g>
    <path d="M540 270 C350 300 315 560 340 900 L300 1540 Q420 1430 540 1540 Q660 1430 780 1540 L740 900 C765 560 730 300 540 270Z" fill="#c7cbd2" opacity=".17"/>
    <path d="M430 690 Q540 590 650 690 L625 1040 Q540 1110 455 1040Z" fill="#050609" opacity=".92"/>
    <ellipse cx="475" cy="790" rx="28" ry="52" fill="#b8c7d5"/><ellipse cx="605" cy="790" rx="28" ry="52" fill="#b8c7d5"/>
    <path d="M475 1190 Q540 1250 605 1190" stroke="#d7dce4" stroke-width="12" opacity=".5" fill="none"/>
    <path d="M260 1740 Q540 1530 820 1740" stroke="#8e98a8" stroke-width="70" opacity=".12" fill="none"/>
  `),

  stranger: svg(`
    <defs>
      <radialGradient id="dark"><stop stop-color="#242424"/><stop offset=".52" stop-color="#050505"/><stop offset="1" stop-color="#000"/></radialGradient>
      <filter id="shadow"><feGaussianBlur stdDeviation="30"/></filter>
    </defs>
    <rect width="1080" height="1920" fill="url(#dark)"/>
    <ellipse cx="540" cy="1500" rx="360" ry="210" fill="#000" filter="url(#shadow)"/>
    <path d="M540 280 C390 300 315 520 330 850 L285 1660 Q540 1510 795 1660 L750 850 C765 520 690 300 540 280Z" fill="#030303"/>
    <path d="M390 640 Q540 470 690 640 L675 1120 Q540 1230 405 1120Z" fill="#161616"/>
    <ellipse cx="455" cy="780" rx="20" ry="34" fill="#f4f4f4"/><ellipse cx="625" cy="780" rx="20" ry="34" fill="#f4f4f4"/>
    <circle cx="455" cy="788" r="8" fill="#000"/><circle cx="625" cy="788" r="8" fill="#000"/>
    <path d="M455 1000 Q540 1045 625 1000" stroke="#6b0000" stroke-width="15" fill="none"/>
    <path d="M100 1820 Q260 1540 420 1710 M980 1820 Q820 1540 660 1710" stroke="#050505" stroke-width="130" fill="none"/>
  `),
} as const;

export type HalloweenScareVisualId = keyof typeof HALLOWEEN_SCARE_ASSETS;
