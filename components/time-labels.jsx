import { format, setHours } from "date-fns";

// Constants for timeline configuration
const dayStart = 8; // 8 AM
const dayEnd = 24; // 11 PM
const hourHeight = 60; // Height of one hour in pixels

/**
 * TimeLabels component
 *
 * @returns {JSX.Element} Rendered component
 */
export default function TimeLabels() {
  return (
    <div
      className="relative"
      style={{ height: `${(dayEnd - dayStart) * hourHeight}px` }}
    >
      {/* Generate hour labels from dayStart to dayEnd */}
      {Array.from({ length: dayEnd - dayStart }, (_, i) => (
        <div
          key={i}
          className="absolute text-[.6rem] text-gray-400 w-full"
          style={{ top: `${i * hourHeight}px` }}
        >
          {format(setHours(new Date(), dayStart + i), "ha")}
        </div>
      ))}
    </div>
  );
}
