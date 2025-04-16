import {
  CheckCircle,
  Circle,
  Edit,
  Trash2,
  Clock,
  Activity,
  AlarmClock,
  Book,
  CalendarIcon,
  Check,
  Dumbbell,
  Flag,
  Heart,
  Home,
  Loader2,
  Package,
  Rocket,
  Settings,
  ShoppingCart,
  Star,
  Target,
  Timer,
  Trash,
  Trophy,
  Users,
  Zap,
  Moon,
} from "lucide-react";

// Create an icon map for easy lookup
export const iconMap = {
  // Basic icons
  default: Clock,
  check: Check,
  edit: Edit,
  trash2: Trash2,
  calendaricon: CalendarIcon,
  heart: Heart,
  trash: Trash,

  // Activity icons
  activity: Activity,
  dumbbell: Dumbbell,
  moon: Moon,
  alarmclock: AlarmClock,
  timer: Timer,

  // Category icons
  home: Home,
  shoppingcart: ShoppingCart,
  book: Book,
  trophy: Trophy,
  star: Star,
  rocket: Rocket,
  settings: Settings,
  users: Users,

  // Status icons
  checkcircle: CheckCircle,
  circle: Circle,
  loader2: Loader2,

  // Additional icons
  flag: Flag,
  package: Package,
  target: Target,
  zap: Zap,
};

// Reusable icon component getter
export const getTaskIcon = (iconName, size = "w-5 h-5") => {
  console.log("Recieved: ", iconName);
  console.log("ICONMAP: ", iconMap);
  console.log("iconmap select: ", iconMap[iconName?.toLowerCase()]);
  const IconComponent = iconMap[iconName?.toLowerCase()] || iconMap.default;
  return <IconComponent className={size} />;
};
