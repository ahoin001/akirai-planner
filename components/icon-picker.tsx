import { Button } from "@/components/ui/button";
import { useFormContext } from "react-hook-form";

const iconMap = {
  education: { icon: "🎓", label: "Education" },
  fitness: { icon: "🏋️", label: "Fitness" },
  busy: { icon: "💼", label: "Busy" },
  rest: { icon: "🌙", label: "Rest" },
};

export function IconPicker() {
  const { setValue, watch } = useFormContext();
  const selectedIcon = watch("icon");

  return (
    <div className="grid grid-cols-4 gap-2">
      {Object.entries(iconMap).map(([key, { icon, label }]) => (
        <Button
          key={key}
          type="button"
          variant={selectedIcon === key ? "default" : "outline"}
          className="h-14 flex-col gap-1"
          onClick={() => {
            setValue("icon", key);
            setValue("color", getComputedColor(key));
          }}
        >
          <span className="text-2xl">{icon}</span>
          <span className="text-xs">{label}</span>
        </Button>
      ))}
    </div>
  );
}

// Helper to get color from system settings
const getComputedColor = (iconType: string) => {
  // Implement logic to fetch from your system_settings
  // For now returns default colors
  const colors: Record<string, string> = {
    education: "#2563eb",
    fitness: "#16a34a",
    busy: "#ea580c",
    rest: "#9333ea",
  };
  return colors[iconType];
};
