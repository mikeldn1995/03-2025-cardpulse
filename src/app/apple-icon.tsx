import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0A1628, #1B2A4A)",
          borderRadius: 38,
        }}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 512 512"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="56" y="116" width="400" height="280" rx="32" fill="white" opacity="0.95" />
          <rect x="116" y="166" width="64" height="48" rx="8" fill="#3b82f6" opacity="0.3" />
          <polyline
            points="56,296 156,296 196,216 256,356 316,236 356,296 456,296"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="22"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  )
}
