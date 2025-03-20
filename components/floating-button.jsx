/**
 * Floating action button component
 * Memoized to prevent unnecessary rerenders
 */
export const FloatingActionButton = memo(({ onClick }) => (
  <button
    className="fixed right-6 bottom-20 z-50 w-14 h-14 bg-pink-500 rounded-full flex items-center justify-center shadow-lg hover:bg-pink-600 transition-colors"
    onClick={onClick}
    aria-label="Create new task"
  >
    <Plus className="w-8 h-8 text-white" />
  </button>
));
