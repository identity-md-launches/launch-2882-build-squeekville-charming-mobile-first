import { LOCATIONS, type Location } from "../game/types";

function Tree({
  x,
  y,
  s = 1,
  variant = 0,
}: {
  x: number;
  y: number;
  s?: number;
  variant?: number;
}) {
  const fill = variant ? "#9eae85" : "#839b79";
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="8" rx="36" ry="11" fill="#6b7d61" opacity=".15" />
      <path d="M-5 4-2-65h9L5 4Z" fill="#8e7455" />
      <path
        d="m1-29-16-16m19 10 19-18"
        stroke="#8e7455"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M-31-43C-55-56-40-83-25-84c-7-28 38-43 50-17 24-6 42 27 21 41 12 26-27 42-40 27-14 15-40 5-37-10Z"
        fill={fill}
      />
      <path
        d="M-32-69c6-12 18-12 23-7m7-24c11-6 19 1 18 11m5 25c10 0 16 6 14 12"
        fill="none"
        stroke="#c2cba0"
        strokeWidth="4"
        opacity=".55"
        strokeLinecap="round"
      />
      <path
        d="m-24-50 3-6m32-22 5 1m-2 34 5-4"
        stroke="#657d61"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  );
}
function Shrub({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cy="4" rx="32" ry="9" fill="#697f5d" opacity=".12" />
      <path
        d="M-29 0c-15-17 0-29 11-23C-17-46 18-43 18-23 35-31 43-9 30 0Z"
        fill="#8da77e"
      />
      <path
        d="m-13-16 3-4m13 6 4-3m10 9 3-4"
        stroke="#c1cc9d"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  );
}
export function Hamster({
  x,
  y,
  s = 1,
  coat = "#d4a16d",
  scarf = "#a65c48",
  happy = false,
  baker = false,
}: {
  x: number;
  y: number;
  s?: number;
  coat?: string;
  scarf?: string;
  happy?: boolean;
  baker?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cy="21" rx="23" ry="6" fill="#6a5a43" opacity=".15" />
      <ellipse cx="-10" cy="19" rx="7" ry="3.5" fill="#a77c5b" />
      <ellipse cx="10" cy="19" rx="7" ry="3.5" fill="#a77c5b" />
      <ellipse cy="-2" rx="21" ry="24" fill={coat} />
      <ellipse cx="-13" cy="-23" rx="8" ry="9" fill={coat} />
      <ellipse cx="13" cy="-23" rx="8" ry="9" fill={coat} />
      <ellipse cx="-13" cy="-23" rx="4.5" ry="5" fill="#e8b3a0" />
      <ellipse cx="13" cy="-23" rx="4.5" ry="5" fill="#e8b3a0" />
      <path
        d="M-17-1c3-8 11 3 17 3S14-9 18-1c9 22-43 27-35 0Z"
        fill="#f7ebcd"
      />
      {happy ? (
        <path
          d="m-11-8 3-3 3 3m10 0 3-3 3 3"
          stroke="#4d4433"
          fill="none"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      ) : (
        <>
          <ellipse cx="-8" cy="-9" rx="2" ry="2.7" fill="#4d4433" />
          <ellipse cx="8" cy="-9" rx="2" ry="2.7" fill="#4d4433" />
          <circle cx="-7.5" cy="-10" r=".7" fill="white" />
          <circle cx="8.5" cy="-10" r=".7" fill="white" />
        </>
      )}
      <ellipse cx="-14" cy="-2" rx="4" ry="2.5" fill="#dd9d84" />
      <ellipse cx="14" cy="-2" rx="4" ry="2.5" fill="#dd9d84" />
      <path
        d="m-3-3 3 2 3-2M0-1v4m-4 0c2 3 6 3 8 0"
        stroke="#76523e"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M-17 8c9 5 25 5 34-1l-2 7c-10 4-22 3-30-1Z" fill={scarf} />
      <path d="m9 12 1 12 6-2-2-12" fill={scarf} />
      <ellipse
        cx="-20"
        cy="7"
        rx="5"
        ry="8"
        fill={coat}
        transform="rotate(-25 -20 7)"
      />
      <ellipse
        cx="20"
        cy="7"
        rx="5"
        ry="8"
        fill={coat}
        transform="rotate(25 20 7)"
      />
      {baker && (
        <>
          <path
            d="M-15-25v-8c-12-6-4-18 3-15 1-13 20-13 22 0 13-3 19 10 9 15v8Z"
            fill="#fff6df"
          />
          <path d="M-15-31h34v7h-34Z" fill="#f0dfbc" />
        </>
      )}
    </g>
  );
}
function Flowers({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0v-17m0 9-7-4m7 9 7-6" stroke="#708965" strokeWidth="2" />
      <g fill="#e1b273">
        <circle cx="-3" cy="-20" r="4" />
        <circle cx="3" cy="-20" r="4" />
        <circle cx="0" cy="-16" r="4" />
      </g>
      <circle cy="-20" r="2.5" fill="#9d6c43" />
    </g>
  );
}
export function TownScene({
  selected,
  event,
  onSelect,
  reducedMotion,
}: {
  selected: Location;
  event: Location | null;
  onSelect: (location: Location) => void;
  reducedMotion: boolean;
}) {
  return (
    <div
      className={`town-scene ${reducedMotion ? "motion-off" : ""}`}
      data-event={event ?? "idle"}
    >
      <div className="scene-canvas">
        <svg
          className="town-art"
          viewBox="0 65 960 625"
          role="img"
          aria-label={`An illustrated hamster town at dusk, with a central wheel power station, bakery, fountain park and a square with string lights.${event ? ` ${LOCATIONS[event].event}` : ""}`}
        >
          <defs>
            <linearGradient id="sky" x2="0" y2="1">
              <stop stopColor="#e2d3bd" />
              <stop offset=".6" stopColor="#f2dcc0" />
              <stop offset="1" stopColor="#f6f1e5" />
            </linearGradient>
            <linearGradient id="roof" x2=".1" y2="1">
              <stop stopColor="#c98261" />
              <stop offset="1" stopColor="#ac624b" />
            </linearGradient>
            <linearGradient id="ground" x2=".2" y2="1">
              <stop stopColor="#b9c59e" />
              <stop offset="1" stopColor="#d1d5af" />
            </linearGradient>
            <radialGradient id="warmGlow">
              <stop stopColor="#ffd47f" stopOpacity=".7" />
              <stop offset="1" stopColor="#ffd47f" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="ovenFire" x2="0" y2="1">
              <stop stopColor="#eabc62" />
              <stop offset="1" stopColor="#ce7540" />
            </linearGradient>
            <filter
              id="buildingShadow"
              x="-30%"
              y="-30%"
              width="170%"
              height="180%"
            >
              <feDropShadow
                dx="0"
                dy="9"
                stdDeviation="5"
                floodColor="#74674b"
                floodOpacity=".14"
              />
            </filter>
            <filter
              id="islandShadow"
              x="-20%"
              y="-20%"
              width="150%"
              height="160%"
            >
              <feDropShadow
                dx="0"
                dy="16"
                stdDeviation="14"
                floodColor="#706c50"
                floodOpacity=".11"
              />
            </filter>
            <pattern
              id="cobbles"
              width="30"
              height="22"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M1 5q10-4 22 0v11q-10 4-22 0Z"
                fill="#e5d8b7"
                stroke="#cfc3a1"
                strokeWidth="1.5"
              />
            </pattern>
          </defs>
          <path
            d="M102 177C153 79 290 82 382 103 450 50 614 50 669 113 814 79 921 173 873 292L96 309Z"
            fill="url(#sky)"
          />
          <circle cx="785" cy="138" r="31" fill="#f8e6b7" />
          <path
            d="M780 107a31 31 0 0 1 6 61 29 29 0 0 0-6-61Z"
            fill="#eed4a7"
          />
          <g fill="#fff3d2">
            <path d="m218 115 2 6 6 2-6 2-2 6-2-6-6-2 6-2ZM686 86l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" />
            <circle cx="734" cy="173" r="2" />
            <circle cx="306" cy="99" r="2" />
            <circle cx="850" cy="213" r="2" />
          </g>
          <path
            d="M99 286c31-68 114-99 185-63 76-78 146-65 215-11 77-37 143-69 214-6 63-9 125 20 153 73Z"
            fill="#c1c6a4"
            opacity=".65"
          />
          <path
            d="M72 332C74 244 242 200 437 211 598 185 812 218 874 309c82 70 40 203-63 255-60 72-241 116-380 87-203 25-406-85-394-189-23-42 0-92 35-130Z"
            fill="url(#ground)"
            filter="url(#islandShadow)"
          />
          <path
            d="M57 481c38 102 216 167 375 155 174 27 338-27 404-95"
            stroke="#aeb78f"
            strokeWidth="5"
            fill="none"
            opacity=".45"
          />
          <g fill="#c1cb9e">
            <ellipse cx="216" cy="317" rx="110" ry="29" />
            <ellipse cx="769" cy="385" rx="117" ry="61" />
            <ellipse cx="504" cy="565" rx="167" ry="86" />
          </g>
          <path
            d="M475 361c-33 43-67 78-111 107-27 18-68 36-100 52M373 471c56 10 92 31 135 57s110 26 156-16c35-32 38-61 85-79M508 529c-8 42-10 62 18 99"
            fill="none"
            stroke="#c2c49b"
            strokeWidth="52"
            strokeLinecap="round"
          />
          <path
            d="M475 361c-33 43-67 78-111 107-27 18-68 36-100 52M373 471c56 10 92 31 135 57s110 26 156-16c35-32 38-61 85-79M508 529c-8 42-10 62 18 99"
            fill="none"
            stroke="#ede0bd"
            strokeWidth="40"
            strokeLinecap="round"
          />
          <g stroke="#cdbf9e" strokeWidth="2" fill="none" opacity=".7">
            <path d="m436 411 19 10m-51 25 18 11m-66 37 11 17m-57 5 10 16m103-30-8 17m53 5-8 14m57 13-3 19m47-19 3 18m42-23 11 16m37-30 14 14m25-43 18 9m-165 83 18-2m-16 24 20-2" />
          </g>
          <Tree x={126} y={359} s={0.9} />
          <Tree x={219} y={276} s={0.9} variant={1} />
          <Tree x={282} y={307} s={1.1} />
          <Tree x={682} y={298} s={1.05} />
          <Tree x={791} y={320} s={1.15} variant={1} />
          <Tree x={857} y={403} s={0.8} />
          <g stroke="#9ba781" strokeWidth="3" fill="none">
            <path d="m177 293 24 4 13-4m-124 116 20 6m704-86 18 5m-95-21 13 4" />
          </g>
          <g filter="url(#buildingShadow)">
            <ellipse
              cx="480"
              cy="388"
              rx="133"
              ry="27"
              fill="#8c9771"
              opacity=".25"
            />
            <path d="M358 258h244v117q-125 39-244 0Z" fill="#e6cba0" />
            <path d="M358 258h26v124l-26-7Z" fill="#cfb387" />
            <path d="M575 258h27v117l-27 7Z" fill="#d8b989" />
            <path
              d="m336 257 143-104 146 104-13 14-132-77-132 77Z"
              fill="url(#roof)"
            />
            <path
              d="m347 260 133-84 133 84"
              stroke="#e4a67b"
              strokeWidth="7"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="m395 229 86-54 86 54M422 211l62-35 58 35"
              stroke="#8c503e"
              opacity=".45"
              strokeWidth="2"
              fill="none"
            />
            <path d="M446 156v-21q34-17 68 0v21" fill="#c37a58" />
            <ellipse cx="480" cy="135" rx="34" ry="9" fill="#e4b083" />
            <path d="M452 135v-18q28-12 56 0v18" fill="#e0c39a" />
            <ellipse cx="480" cy="117" rx="28" ry="7" fill="#b88760" />
            <path
              d="M347 339h265M347 370h265"
              stroke="#a98662"
              strokeWidth="5"
            />
            <path d="M378 274v62m209-62v62" stroke="#a98662" strokeWidth="4" />
            <rect
              x="362"
              y="294"
              width="28"
              height="33"
              rx="13"
              fill="#855d3e"
            />
            <rect
              x="366"
              y="298"
              width="20"
              height="25"
              rx="10"
              fill="#e9bb64"
            />
            <path d="M376 299v24m-10-13h20" stroke="#a17a4c" strokeWidth="2" />
            <rect
              x="571"
              y="294"
              width="28"
              height="33"
              rx="13"
              fill="#855d3e"
            />
            <rect
              x="575"
              y="298"
              width="20"
              height="25"
              rx="10"
              fill="#e9bb64"
            />
            <path d="M585 299v24m-10-13h20" stroke="#a17a4c" strokeWidth="2" />
            <circle cx="480" cy="291" r="93" fill="#795a40" />
            <circle cx="480" cy="291" r="85" fill="#dbbb83" />
            <circle cx="480" cy="291" r="75" fill="#a98c5b" />
            <circle cx="480" cy="291" r="68" fill="#ead29c" />
            <g className="wheel-spokes">
              <circle
                cx="480"
                cy="291"
                r="79"
                fill="none"
                stroke="#f4db9f"
                strokeWidth="4"
              />
              <g stroke="#b58f56" strokeWidth="8">
                <path d="M480 213v156m-78-78h156m-133-55 110 110m-110 0 110-110" />
              </g>
              <circle
                cx="480"
                cy="291"
                r="12"
                fill="#dfc08a"
                stroke="#9b754b"
                strokeWidth="5"
              />
            </g>
            <g className="wheel-runner">
              <Hamster
                x={500}
                y={328}
                s={0.92}
                coat="#ca9764"
                scarf="#7e8c65"
                happy
              />
            </g>
            <path
              d="m431 362-12 30h125l-13-30"
              fill="none"
              stroke="#826244"
              strokeWidth="8"
              strokeLinejoin="round"
            />
            <path
              d="M404 396h152"
              stroke="#a18257"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <rect
              x="415"
              y="199"
              width="132"
              height="25"
              rx="6"
              fill="#f5e5be"
              transform="rotate(-1 480 212)"
            />
            <text
              x="480"
              y="216"
              textAnchor="middle"
              fill="#75563c"
              fontSize="15"
              fontWeight="700"
              fontFamily="Nunito Variable, sans-serif"
            >
              Wheel Power Co.
            </text>
            <path
              d="M555 377q39 37 74 22"
              stroke="#8c7654"
              strokeWidth="4"
              fill="none"
            />
            <path d="M626 401v25" stroke="#7d6b4c" strokeWidth="5" />
            <circle cx="626" cy="390" r="14" fill="#dbb97a" />
            <path d="m630 381-9 11h7l-3 8 10-12h-7Z" fill="#f9e5ad" />
          </g>
          <Shrub x={343} y={364} />
          <Shrub x={610} y={372} s={0.7} />
          <g
            className={`bakery-building ${selected === "bakery" ? "is-selected" : ""}`}
          >
            <ellipse
              className="selection-halo"
              cx="231"
              cy="494"
              rx="133"
              ry="54"
            />
            <g filter="url(#buildingShadow)">
              <path d="M139 384h192v117q-96 23-192 0Z" fill="#f0d9ad" />
              <path d="M139 384h20v122l-20-5Z" fill="#d7b98f" />
              <path d="M278 335v-68h28v78" fill="#b78060" />
              <path d="M273 269h37v-10h-37Z" fill="#96634a" />
              <g className="chimney-smoke" fill="#efe6cf" opacity="0">
                <ellipse cx="291" cy="239" rx="14" ry="18" />
                <ellipse cx="306" cy="214" rx="20" ry="16" />
                <ellipse cx="295" cy="185" rx="23" ry="13" />
              </g>
              <path d="m111 388 65-73h111l69 73-14 13H126Z" fill="url(#roof)" />
              <path
                d="M126 387h216"
                stroke="#e2a17a"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <g stroke="#9d5844" strokeWidth="2" opacity=".65">
                <path d="M151 346h161M135 365h194m-159-47-39 67m67-67-17 67m47-67 6 67m22-67 30 67" />
              </g>
              <rect
                x="182"
                y="371"
                width="100"
                height="29"
                rx="5"
                fill="#faebcc"
              />
              <text
                x="232"
                y="391"
                fill="#73553b"
                textAnchor="middle"
                fontSize="21"
                fontFamily="Fraunces, Georgia, serif"
                fontWeight="600"
              >
                Bakery
              </text>
              <path d="M151 464v-31a23 23 0 0 1 46 0v31Z" fill="#ae7751" />
              <path
                className="oven-opening"
                d="M157 463v-29a17 17 0 0 1 34 0v29Z"
                fill="#674c38"
              />
              <g className="oven-flames">
                <ellipse
                  cx="175"
                  cy="463"
                  rx="46"
                  ry="38"
                  fill="url(#warmGlow)"
                />
                <path
                  d="M162 459c-2-10 3-12 5-22 10 5 5 9 9 11 4-4 6-7 6-11 8 11 8 15 4 22Z"
                  fill="#f6d277"
                />
                <path d="M170 459c0-6 4-9 6-14 3 7 7 8 5 14" fill="#fff1ae" />
              </g>
              <path d="M149 469h50v9h-50Z" fill="#c19668" />
              <path d="M149 478h50" stroke="#b18056" strokeWidth="3" />
              <rect
                x="215"
                y="421"
                width="95"
                height="45"
                rx="4"
                fill="#9a7650"
              />
              <rect
                x="220"
                y="425"
                width="85"
                height="36"
                rx="2"
                fill="#e1bc73"
              />
              <path d="M248 424v38m28-38v38" stroke="#aa8352" strokeWidth="3" />
              <path d="m210 415 9-14h88l10 14v12H210Z" fill="#e4bc8e" />
              <path
                d="m224 401-3 26h15l2-26m16 0v26h15l-2-26m17 0 4 26h16l-6-26"
                fill="#b76e53"
              />
              <path
                d="M210 427q7 8 14 0 7 8 14 0 7 8 14 0 7 8 14 0 7 8 14 0 7 8 14 0 7 8 14 0l9 0"
                fill="#d9ad83"
              />
              <path d="M226 500v-25h67v25" fill="#b58c5e" />
              <path d="M219 474h81v8h-81Z" fill="#d4ad77" />
              <g fill="#eac58c" stroke="#b68955" strokeWidth="1.5">
                <ellipse cx="235" cy="470" rx="12" ry="6" />
                <ellipse cx="257" cy="469" rx="13" ry="7" />
                <ellipse cx="282" cy="470" rx="13" ry="6" />
              </g>
              <path
                d="m231 467 3 4m20-7 4 5m22-2 4 4"
                stroke="#b68955"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
            <g className="bread-delivery">
              <Hamster
                x={300}
                y={527}
                s={1.06}
                coat="#d8ae7c"
                scarf="#9d6851"
                baker
                happy
              />
              <g transform="rotate(-17 300 535)">
                <ellipse
                  cx="300"
                  cy="533"
                  rx="35"
                  ry="12"
                  fill="#d6a465"
                  stroke="#b88750"
                  strokeWidth="2"
                />
                <path
                  d="m280 525 6 11m9-14 6 12m8-11 6 11"
                  stroke="#f4d39a"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </g>
            </g>
          </g>
          <g transform="translate(119 489)">
            <path d="m-12 7 2-38h24l3 38Z" fill="#cbac7c" />
            <path d="M-10-18h23m-23 8h25" stroke="#997c52" strokeWidth="2" />
            <path
              d="m-5-27-5-29m9 27 3-34m5 35 8-28"
              stroke="#c8a164"
              strokeWidth="3"
            />
            <path
              d="m-10-50-6-5m8 13-7-5m17-8 5-6m-5 15 6-5m5 3 7-3"
              stroke="#dfbd79"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
          <Shrub x={136} y={530} s={0.65} />
          <Flowers x={166} y={535} />
          <g
            className={`park-building ${selected === "park" ? "is-selected" : ""}`}
          >
            <ellipse
              className="selection-halo"
              cx="743"
              cy="442"
              rx="116"
              ry="70"
            />
            <path
              d="M654 440q91-84 183 0-10 59-92 66-88-10-91-66Z"
              fill="#c4cba3"
            />
            <ellipse cx="747" cy="455" rx="84" ry="36" fill="#a7b18d" />
            <ellipse cx="747" cy="449" rx="78" ry="31" fill="#b29177" />
            <path d="M671 441v10q75 45 152 0v-10" fill="#c4ab8b" />
            <ellipse cx="747" cy="439" rx="78" ry="31" fill="#e8d3ab" />
            <ellipse cx="747" cy="437" rx="66" ry="23" fill="#96b3aa" />
            <g
              className="pool-ripples"
              fill="none"
              stroke="#d0e2c9"
              strokeWidth="2"
            >
              <ellipse cx="747" cy="439" rx="51" ry="15" />
              <path d="M708 439q36 17 74 0" />
            </g>
            <path d="m738 435 3-65h13l4 65Z" fill="#d6bd94" />
            <path d="M718 370q29 30 59 0Z" fill="#b59b7a" />
            <ellipse cx="747" cy="370" rx="30" ry="9" fill="#e7d5af" />
            <ellipse cx="747" cy="368" rx="22" ry="5" fill="#98b4ab" />
            <path d="M742 368v-27h10v27" fill="#e3cca4" />
            <ellipse cx="747" cy="339" rx="9" ry="6" fill="#dfc59d" />
            <g
              className="fountain-water"
              fill="none"
              stroke="#b9dfd5"
              strokeLinecap="round"
            >
              <path
                d="M747 338c-17-38-38-27-36 9m36-9c18-39 37-27 36 9m-36-9v-31m-28 68c-4 18-16 36-16 58m73-58c3 18 16 36 16 58"
                strokeWidth="5"
              />
              <path
                d="M747 310c-9-14-15-7-13 3m13-3c9-14 15-7 13 3"
                strokeWidth="3"
              />
              <g fill="#d3ede0" stroke="none">
                <ellipse cx="709" cy="357" rx="3" ry="5" />
                <ellipse cx="783" cy="356" rx="3" ry="5" />
                <ellipse cx="702" cy="438" rx="5" ry="2" />
                <ellipse cx="792" cy="438" rx="5" ry="2" />
              </g>
            </g>
            <g transform="translate(654 404) rotate(-18)">
              <path d="M-26 7h54v9h-54Z" fill="#a37e58" />
              <path d="M-26-6h54v10h-54Z" fill="#bf9c6c" />
              <path
                d="M-21 16v16m43-16v16m-48-27v16m54-16v16"
                stroke="#876e4e"
                strokeWidth="5"
              />
            </g>
            <g className="park-gathering">
              <Hamster
                x={697}
                y={491}
                s={0.9}
                coat="#c0b299"
                scarf="#7b8f79"
                happy
              />
              <Hamster
                x={801}
                y={489}
                s={0.8}
                coat="#d4a574"
                scarf="#c08361"
                happy
              />
              <Hamster
                x={760}
                y={509}
                s={0.64}
                coat="#e7c697"
                scarf="#a28355"
                happy
              />
            </g>
          </g>
          <Shrub x={831} y={481} s={0.65} />
          <Flowers x={844} y={478} />
          <Flowers x={686} y={511} />
          <Flowers x={673} y={518} />
          <g
            className={`square-building ${selected === "square" ? "is-selected" : ""}`}
          >
            <ellipse
              className="selection-halo"
              cx="519"
              cy="561"
              rx="135"
              ry="67"
            />
            <ellipse cx="519" cy="566" rx="126" ry="56" fill="#b3ae88" />
            <ellipse cx="519" cy="559" rx="127" ry="54" fill="#cdbf9a" />
            <ellipse cx="519" cy="554" rx="115" ry="47" fill="url(#cobbles)" />
            <path
              d="M402 515v-91m231 106v-94"
              stroke="#9c7950"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M402 424q112 100 231 12"
              fill="none"
              stroke="#796a4e"
              strokeWidth="2.5"
            />
            <path
              d="M402 440q113 72 231 14"
              fill="none"
              stroke="#b89469"
              strokeWidth="1.5"
            />
            <g>
              <path
                d="m419 449 11 7-9 11Zm28 16 12 5-9 11Zm30 9 12 3-8 12Zm30 4 12 0-5 12Zm32-1 12-2-3 13Zm31-6 11-5 1 13Zm29-12 10-5 2 13Z"
                fill="#c18b68"
              />
              <path
                d="m447 465 12 5-9 11Zm60 13 12 0-5 12Zm63-7 11-5 1 13Z"
                fill="#9ba77d"
              />
            </g>
            <g className="square-lamps">
              {[
                { x: 419, y: 441 },
                { x: 449, y: 459 },
                { x: 483, y: 470 },
                { x: 519, y: 475 },
                { x: 555, y: 472 },
                { x: 590, y: 462 },
                { x: 620, y: 447 },
              ].map((p, i) => (
                <g key={i}>
                  <circle
                    className="bulb-glow"
                    cx={p.x}
                    cy={p.y + 9}
                    r="29"
                    fill="url(#warmGlow)"
                  />
                  <path
                    d={`M${p.x} ${p.y - 1}v7`}
                    stroke="#796a4e"
                    strokeWidth="2"
                  />
                  <circle
                    className="light-bulb"
                    cx={p.x}
                    cy={p.y + 9}
                    r="5"
                    fill="#d5bd86"
                  />
                </g>
              ))}
            </g>
            <path d="M501 573h40v-23h-40Z" fill="#ba9263" />
            <ellipse cx="521" cy="551" rx="27" ry="9" fill="#e2c08a" />
            <path d="M514 535h14v15h-14Z" fill="#b29465" />
            <g fill="#d7aa6b">
              <ellipse cx="514" cy="537" rx="8" ry="4" />
              <ellipse cx="528" cy="537" rx="8" ry="4" />
            </g>
            <g className="square-gathering">
              <Hamster
                x={464}
                y={552}
                s={0.92}
                coat="#bfae94"
                scarf="#788c70"
                happy
              />
              <Hamster
                x={571}
                y={563}
                s={0.9}
                coat="#d9b07b"
                scarf="#ab6d54"
                happy
              />
              <Hamster
                x={514}
                y={605}
                s={0.74}
                coat="#e4c599"
                scarf="#7a9190"
                happy
              />
              <Hamster
                x={591}
                y={525}
                s={0.65}
                coat="#c7a375"
                scarf="#b48b55"
                happy
              />
            </g>
          </g>
          <g transform="translate(337 570)">
            <path d="M0 6v-58" stroke="#987d55" strokeWidth="5" />
            <path d="m-28-53 48-3 12 11-11 10-49-2Z" fill="#c69e6d" />
            <text
              x="0"
              y="-42"
              textAnchor="middle"
              fill="#65553e"
              fontSize="10"
              fontWeight="700"
              fontFamily="Nunito Variable, sans-serif"
            >
              Town Square
            </text>
            <path d="m-2 6-9 5h21" fill="#a3af80" />
          </g>
          <Hamster x={371} y={429} s={0.72} coat="#d7bb8f" scarf="#879b80" />
          <Hamster x={607} y={377} s={0.57} coat="#d1b493" scarf="#b4835c" />
          <g transform="translate(193 566) rotate(10)">
            <path d="M-24 0h50v10h-50Z" fill="#b38b5f" />
            <path d="M-24-14h50v10h-50Z" fill="#c49e6b" />
            <path
              d="M-19 10v15m40-15v15m-45-29V6m49-20V6"
              stroke="#8d7350"
              strokeWidth="4"
            />
          </g>
          <Tree x={95} y={481} s={0.78} variant={1} />
          <Tree x={745} y={589} s={0.85} />
          <Shrub x={660} y={590} />
          <Shrub x={284} y={599} s={0.9} />
          <Shrub x={391} y={634} s={0.65} />
          <Flowers x={255} y={600} />
          <Flowers x={271} y={604} />
          <Flowers x={642} y={601} />
          <Flowers x={719} y={608} />
          <Flowers x={357} y={621} />
          <g fill="#82956d" opacity=".6">
            <path d="m186 332 3-8 4 10m139-17 4-8 3 9m-165 251 3-8 5 8m418 57 2-7 4 7m190-103 3-8 3 9m-672-75 4-9 4 11m646-94 3-7 4 9" />
          </g>
          <g className="fireflies" fill="#f8df96">
            <circle cx="316" cy="332" r="2.5" />
            <circle cx="690" cy="348" r="2.5" />
            <circle cx="853" cy="445" r="2" />
            <circle cx="160" cy="301" r="2" />
            <circle cx="628" cy="571" r="2.5" />
          </g>
        </svg>
        <div className="scene-caption">
          <span className="sun-dot" /> Evening in Squeekville
        </div>
        <div
          className="scene-location-buttons"
          aria-label="Choose a town location"
        >
          {(Object.keys(LOCATIONS) as Location[]).map((location) => (
            <button
              key={location}
              className={`scene-pin pin-${location} ${selected === location ? "chosen" : ""}`}
              aria-pressed={selected === location}
              onClick={() => onSelect(location)}
            >
              <span>{LOCATIONS[location].name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={`scene-message ${event ? "is-event" : ""}`} role="status">
        {event ? LOCATIONS[event].event : "All is quiet in the neighborhood."}
      </div>
    </div>
  );
}
