export default function LightLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="160"
      height="48"
      viewBox="0 20 200 60"
      className="text-foreground"
    >
      <defs>
        <linearGradient id="a" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#4a90e2" />
          <stop offset="100%" stopColor="#5ca0f2" />
        </linearGradient>
      </defs>
      <path
        fill="url(#a)"
        d="M10 50c0-20 20-30 30-15 10-15 30-5 30 15S50 80 40 65c-10 15-30 5-30-15Z"
      />
      <path
        fill="#FFF"
        fillOpacity=".2"
        d="M30 40c5-5 15-5 20 0s5 15 0 20-15 5-20 0-5-15 0-20Z"
      />
      <text
        x="80"
        y="60"
        fontFamily="Arial, sans-serif"
        fontSize="24"
        fontWeight="bold"
        fill="currentColor"
      >
        Scribe
      </text>
      <path
        fill="none"
        stroke="#4A90E2"
        strokeWidth="4"
        d="M160 50q20-20 20 0t20 0"
      />
    </svg>
  );
}
