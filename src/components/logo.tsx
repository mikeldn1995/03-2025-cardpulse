"use client"

interface LogoProps {
  size?: number
  variant?: "light" | "dark"
  className?: string
}

export function Logo({ size = 32, variant = "dark", className }: LogoProps) {
  const cardColor = variant === "dark" ? "#ffffff" : "#0A1628"
  const pulseColor = variant === "dark" ? "#3b82f6" : "#3b82f6"

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Card shape */}
      <rect
        x="56"
        y="116"
        width="400"
        height="280"
        rx="32"
        fill={cardColor}
        opacity="0.95"
      />
      {/* Chip rectangle */}
      <rect
        x="116"
        y="166"
        width="64"
        height="48"
        rx="8"
        fill={pulseColor}
        opacity="0.3"
      />
      {/* Heartbeat/pulse line */}
      <polyline
        points="56,296 156,296 196,216 256,356 316,236 356,296 456,296"
        fill="none"
        stroke={pulseColor}
        strokeWidth="26"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
