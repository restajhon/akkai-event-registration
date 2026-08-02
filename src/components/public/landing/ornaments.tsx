type CornerPosition = "tl" | "tr" | "bl" | "br";

const cornerPositionClasses: Record<CornerPosition, string> = {
  tl: "left-0 top-0",
  tr: "right-0 top-0 rotate-90",
  bl: "bottom-0 left-0 -rotate-90",
  br: "bottom-0 right-0 rotate-180",
};

export function GoldDivider({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`h-px bg-[#c79a35]/60 ${className}`}
    />
  );
}

export function CornerOrnament({
  position = "tl",
}: {
  position?: CornerPosition;
}) {
  return (
    <svg
      aria-hidden="true"
      className={`absolute h-7 w-7 text-[#c79a35]/50 ${cornerPositionClasses[position]}`}
      fill="none"
      viewBox="0 0 40 40"
    >
      <path d="M10 5v10M15 10H5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="8" fill="currentColor" r="1" />
    </svg>
  );
}

export function CurvedPanel() {
  return (
    <div
      aria-hidden="true"
      className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#082b5a]/[0.04]"
    />
  );
}

export function SemarangSkylineSvg() {
  return (
    <svg
      aria-hidden="true"
      className="h-auto w-full text-[#fffdf9]/10"
      preserveAspectRatio="xMidYMax meet"
      viewBox="0 0 800 200"
    >
      <rect fill="currentColor" height="80" width="40" x="50" y="120" />
      <polygon fill="currentColor" points="70,120 50,80 90,80" />
      <rect fill="currentColor" height="100" width="50" x="130" y="100" />
      <polygon fill="currentColor" points="155,100 130,60 180,60" />
      <rect fill="currentColor" height="90" width="35" x="220" y="110" />
      <polygon fill="currentColor" points="237.5,110 220,75 255,75" />
      <rect fill="currentColor" height="105" width="45" x="290" y="95" />
      <polygon fill="currentColor" points="312.5,95 290,50 335,50" />
      <rect fill="currentColor" height="95" width="40" x="370" y="105" />
      <circle cx="390" cy="100" fill="currentColor" r="12" />
    </svg>
  );
}
