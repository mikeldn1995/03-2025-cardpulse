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
          background: "linear-gradient(135deg, #7c3aed, #a855f7)",
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
          <polyline
            points="116,296 186,296 216,216 256,336 296,256 326,296 396,296"
            fill="none"
            stroke="#7c3aed"
            strokeWidth="22"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="116" y="166" width="64" height="48" rx="8" fill="#7c3aed" opacity="0.25" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
