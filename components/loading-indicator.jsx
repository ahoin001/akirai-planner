// components/ui/LoadingIndicator.jsx (or similar path)
import { Loader2 } from "lucide-react";

/**
 * Simple loading indicator component.
 * Uses a subtle overlay and spinner.
 * Controlled by the 'show' prop.
 */
export const LoadingIndicator = ({ show, text = "Loading..." }) => {
  if (!show) {
    return null; // Don't render anything if not showing
  }

  return (
    // Fixed position overlay, subtle background
    // Adjust z-index to be high, but potentially below modals if needed
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[900]">
      <div className="flex flex-col items-center p-6 bg-zinc-800/90 rounded-lg shadow-lg">
        <Loader2 className="h-8 w-8 text-indigo-400 animate-spin mb-3" />
        <p className="text-sm text-gray-200">{text}</p>
      </div>
    </div>
  );
};

// --- Alternative: Simple Top Banner ---
export const LoadingBanner = ({ show, text = "Loading..." }) => {
  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 right-0 p-2 bg-indigo-600/90 text-white text-xs text-center z-[80] animate-pulse">
      <span className="flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        {text}
      </span>
    </div>
  );
};
