import type { LesionChannelId } from "@/lib/types";

function svgToDataUri(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    svg.replace(/\n/g, "").replace(/\s\s+/g, " ")
  )}`;
}

export function createFundusImageDataUri(options?: {
  accent?: string;
  vesselColor?: string;
  discX?: number;
}) {
  const accent = options?.accent ?? "#de7b3a";
  const vesselColor = options?.vesselColor ?? "#8c3a1a";
  const discX = options?.discX ?? 625;

  return svgToDataUri(`
    <svg width="880" height="880" viewBox="0 0 880 880" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="retina" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(430 430) rotate(90) scale(360)">
          <stop offset="0%" stop-color="#F8B06D"/>
          <stop offset="58%" stop-color="${accent}"/>
          <stop offset="82%" stop-color="#6A240F"/>
          <stop offset="100%" stop-color="#03070E"/>
        </radialGradient>
        <radialGradient id="discGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${discX} 360) rotate(90) scale(150)">
          <stop offset="0%" stop-color="#FFF7C7" stop-opacity="0.98"/>
          <stop offset="45%" stop-color="#FFD88A" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#FFD88A" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="880" height="880" fill="#050811"/>
      <circle cx="440" cy="440" r="345" fill="url(#retina)"/>
      <circle cx="${discX}" cy="360" r="150" fill="url(#discGlow)"/>
      <circle cx="440" cy="440" r="320" stroke="rgba(255,255,255,0.12)" stroke-width="6"/>
      <path d="M${discX - 45} 370C540 380 500 450 448 500C394 548 362 625 280 660" stroke="${vesselColor}" stroke-width="16" stroke-linecap="round" opacity="0.75"/>
      <path d="M${discX - 35} 360C540 332 470 302 400 248C350 210 286 175 228 156" stroke="${vesselColor}" stroke-width="13" stroke-linecap="round" opacity="0.7"/>
      <path d="M${discX - 18} 392C575 402 600 455 640 530C676 600 714 650 764 688" stroke="${vesselColor}" stroke-width="11" stroke-linecap="round" opacity="0.62"/>
      <path d="M${discX - 28} 338C596 310 655 272 710 210C742 174 764 142 782 110" stroke="${vesselColor}" stroke-width="11" stroke-linecap="round" opacity="0.62"/>
      <path d="M520 510C472 556 440 600 415 664" stroke="${vesselColor}" stroke-width="10" stroke-linecap="round" opacity="0.58"/>
      <path d="M470 284C432 242 380 210 324 180" stroke="${vesselColor}" stroke-width="10" stroke-linecap="round" opacity="0.58"/>
      <path d="M522 508C566 536 618 566 652 612" stroke="${vesselColor}" stroke-width="8" stroke-linecap="round" opacity="0.46"/>
      <path d="M478 294C532 266 574 240 622 196" stroke="${vesselColor}" stroke-width="8" stroke-linecap="round" opacity="0.46"/>
      <circle cx="440" cy="440" r="340" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2" stroke-dasharray="6 12"/>
    </svg>
  `);
}

export function createOverlayDataUri(channelId: LesionChannelId, color: string) {
  const overlays: Record<LesionChannelId, string> = {
    ma: `
      <circle cx="370" cy="322" r="10" fill="${color}" />
      <circle cx="438" cy="402" r="12" fill="${color}" />
      <circle cx="502" cy="472" r="11" fill="${color}" />
      <circle cx="320" cy="514" r="9" fill="${color}" />
      <circle cx="286" cy="380" r="8" fill="${color}" />
      <circle cx="540" cy="328" r="8" fill="${color}" />
    `,
    hard_exudates: `
      <ellipse cx="520" cy="398" rx="54" ry="24" fill="${color}" opacity="0.92" />
      <ellipse cx="574" cy="432" rx="34" ry="18" fill="${color}" opacity="0.84" />
      <ellipse cx="488" cy="450" rx="28" ry="16" fill="${color}" opacity="0.76" />
      <ellipse cx="332" cy="286" rx="28" ry="16" fill="${color}" opacity="0.7" />
    `,
    haemorrhages: `
      <ellipse cx="360" cy="454" rx="44" ry="28" fill="${color}" opacity="0.84" />
      <ellipse cx="270" cy="504" rx="24" ry="16" fill="${color}" opacity="0.74" />
      <ellipse cx="514" cy="318" rx="30" ry="18" fill="${color}" opacity="0.76" />
    `,
    soft_exudates: `
      <ellipse cx="446" cy="284" rx="66" ry="30" fill="${color}" opacity="0.5" />
      <ellipse cx="500" cy="268" rx="34" ry="18" fill="${color}" opacity="0.32" />
      <ellipse cx="294" cy="554" rx="48" ry="22" fill="${color}" opacity="0.46" />
    `,
    irma: `
      <path d="M450 440C484 420 510 404 534 370" stroke="${color}" stroke-width="18" stroke-linecap="round" opacity="0.72" />
      <path d="M494 404C520 418 548 420 574 396" stroke="${color}" stroke-width="14" stroke-linecap="round" opacity="0.65" />
      <path d="M356 322C388 334 422 320 444 290" stroke="${color}" stroke-width="14" stroke-linecap="round" opacity="0.58" />
    `,
    neovascularisation: `
      <path d="M608 286C628 310 648 330 676 346" stroke="${color}" stroke-width="11" stroke-linecap="round" opacity="0.84" />
      <path d="M634 318C622 340 620 362 628 388" stroke="${color}" stroke-width="9" stroke-linecap="round" opacity="0.74" />
      <path d="M644 328C662 328 684 336 706 356" stroke="${color}" stroke-width="8" stroke-linecap="round" opacity="0.74" />
      <path d="M622 304C602 296 584 288 566 272" stroke="${color}" stroke-width="8" stroke-linecap="round" opacity="0.65" />
    `
  };

  return svgToDataUri(`
    <svg width="880" height="880" viewBox="0 0 880 880" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${overlays[channelId]}
    </svg>
  `);
}

export function createDicomPlaceholderDataUri() {
  return svgToDataUri(`
    <svg width="640" height="640" viewBox="0 0 640 640" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="640" height="640" rx="40" fill="#0F1629"/>
      <rect x="54" y="54" width="532" height="532" rx="28" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" stroke-width="4"/>
      <path d="M216 210H426" stroke="#0EA5E9" stroke-width="22" stroke-linecap="round"/>
      <path d="M216 274H426" stroke="#FFFFFF" stroke-opacity="0.72" stroke-width="18" stroke-linecap="round"/>
      <path d="M216 338H354" stroke="#FFFFFF" stroke-opacity="0.48" stroke-width="18" stroke-linecap="round"/>
      <rect x="210" y="414" width="220" height="76" rx="22" fill="rgba(14,165,233,0.18)" stroke="rgba(14,165,233,0.32)"/>
      <text x="320" y="462" text-anchor="middle" fill="#7DD3FC" font-size="44" font-family="Inter, Arial, sans-serif" font-weight="700">DICOM</text>
    </svg>
  `);
}

