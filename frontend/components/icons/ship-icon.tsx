interface ShipIconProps {
    className?: string;
}

export function ShipIcon({ className = "h-6 w-6" }: ShipIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 32 32"
            fill="none"
            className={className}
        >
            {/* Main sail (triangle) */}
            <path d="M16 8 L16 24 L8 24 Z" fill="currentColor" />
            {/* Secondary sail */}
            <path d="M16 12 L16 24 L22 24 Z" fill="currentColor" opacity="0.7" />
            {/* Hull (boat bottom) */}
            <path d="M6 24 L16 28 L26 24 L24 24 L16 26 L8 24 Z" fill="currentColor" />
            {/* Waterline */}
            <rect x="4" y="27" width="24" height="2" fill="currentColor" opacity="0.5" />
        </svg>
    );
}

