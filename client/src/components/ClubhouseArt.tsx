/** Original vector game table; decorative and independent of application state. */
export function ClubhouseArt() {
  return (
    <svg viewBox="0 0 500 400" fill="none" aria-hidden="true" className="clubhouse-art">
      <ellipse cx="255" cy="220" rx="205" ry="151" fill="#A477FF" />
      <ellipse
        cx="255"
        cy="220"
        rx="177"
        ry="125"
        stroke="#1B0D39"
        strokeOpacity=".2"
        strokeWidth="2"
        strokeDasharray="7 9"
      />
      <g transform="translate(85 115) rotate(-14 80 95)">
        <rect x="8" y="10" width="148" height="192" rx="19" fill="#1B0D39" />
        <rect width="148" height="192" rx="19" fill="#F9F6FF" stroke="#1B0D39" strokeWidth="3" />
        <rect x="13" y="13" width="122" height="166" rx="12" fill="#FFD166" />
        <path d="m74 45 14 31 34 4-25 23 7 34-30-17-30 17 7-34-25-23 34-4 14-31Z" fill="#1B0D39" />
        <circle cx="27" cy="29" r="5" fill="#1B0D39" />
        <circle cx="121" cy="163" r="5" fill="#1B0D39" />
      </g>
      <g transform="translate(267 160) rotate(15 65 65)">
        <rect x="5" y="8" width="126" height="126" rx="26" fill="#1B0D39" />
        <rect width="126" height="126" rx="26" fill="#FF716B" stroke="#1B0D39" strokeWidth="3" />
        {[
          [32, 32],
          [94, 32],
          [63, 63],
          [32, 94],
          [94, 94],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="9" fill="#1B0D39" />
        ))}
      </g>
      <g transform="translate(263 46) rotate(9 40 40)">
        <path
          d="M24 47c-16-23-3-42 15-42s31 19 15 42l20 42H4l20-42Z"
          fill="#A7E7CB"
          stroke="#1B0D39"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M17 78h45" stroke="#1B0D39" strokeWidth="3" />
      </g>
      <g stroke="#FFD166" strokeWidth="5" strokeLinecap="round">
        <path d="m403 88 5-22m10 33 18-11M61 262l-20 8M62 282l-9 15" />
      </g>
      <g fill="#A7E7CB">
        <circle cx="404" cy="312" r="11" />
        <circle cx="101" cy="57" r="7" />
      </g>
      <path d="m205 335 9-16 9 16 18 4-18 6-9 17-9-17-17-6 17-4Z" fill="#FFD166" />
      <path d="m435 172 8 10-8 10-8-10Z" fill="#FF716B" />
      <g transform="translate(315 320) rotate(-7)">
        <rect width="135" height="39" rx="19" fill="#F9F6FF" stroke="#1B0D39" strokeWidth="2" />
        <text
          x="67"
          y="25"
          textAnchor="middle"
          fill="#1B0D39"
          fontFamily="system-ui, sans-serif"
          fontSize="14"
          fontWeight="800"
        >
          LET’S PLAY!
        </text>
      </g>
    </svg>
  );
}
