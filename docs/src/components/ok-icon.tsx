import { type SVGProps, useId } from 'react';

export function OkIcon(props: SVGProps<SVGSVGElement>) {
  const filterId = useId();
  return (
    <svg
      width="227"
      height="252"
      viewBox="0 0 227 252"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      {...props}
    >
      <title>OpenKnowledge</title>
      <g filter={`url(#${filterId})`}>
        <path
          d="M195.615 47.322C170.404 11.5418 135.032 -1.78461 87.4933 6.60183C62.581 10.9903 39.3632 28.1768 25.382 52.5836C11.5214 76.7664 8.72979 104.499 17.7136 128.665C27.2431 154.312 48.887 171.24 70.8583 185.71C75.4421 188.731 76.4301 192.419 77.0735 201.989C77.5617 209.22 78.3717 221.323 89.7335 227.521C93.0479 229.325 96.6954 230.244 100.584 230.244C108.436 230.244 115.232 226.481 118.494 224.678C137.755 214.022 201.457 174.865 212.445 118.388C217.414 92.8442 207.574 64.2844 195.621 47.322H195.615Z"
          fill="white"
        />
        <path
          d="M109.438 208.318C84.1921 222.282 107.582 187.513 81.142 170.097C63.2778 158.333 43.248 143.697 35.2406 122.156C19.7257 80.4194 51.307 31.9562 90.7404 25.0115C132.179 17.7107 159.952 29.1703 180.332 58.092C190.7 72.8085 197.696 96.2618 194.083 114.821C186.26 155.036 143.512 189.466 109.438 208.318Z"
          fill="#69A3FF"
        />
        <path
          d="M154.195 85.8131C156.366 83.6428 159.884 83.6428 162.055 85.8131V85.8131C164.225 87.9834 164.225 91.5021 162.055 93.6724L144.061 111.666L136.202 103.807L154.195 85.8131Z"
          fill="#D5E5FF"
        />
        <path
          d="M162.054 113.942C164.224 116.112 164.224 119.631 162.054 121.801V121.801C159.883 123.971 156.365 123.971 154.194 121.801L136.201 103.807L144.06 95.9481L162.054 113.942Z"
          fill="#D5E5FF"
        />
      </g>
      <defs>
        <filter
          id={filterId}
          x="0"
          y="0"
          width="226.296"
          height="251.133"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="8.35549" />
          <feGaussianBlur stdDeviation="6.26662" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
        </filter>
      </defs>
    </svg>
  );
}
