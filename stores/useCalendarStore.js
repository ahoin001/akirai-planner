@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 214, 219, 220;
  --background-end-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-start-rgb: 0, 0, 0;
    --background-end-rgb: 0, 0, 0;
  }
}

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 3.9%;
    --primary: 0 0% 9%;
    --primary-foreground: 0 0% 98%;
    --secondary: 0 0% 96.1%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
    --accent: 0 0% 96.1%;
    --accent-foreground: 0 0% 9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 89.8%;
    --input: 0 0% 89.8%;
    --ring: 0 0% 3.9%;
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
    --radius: 0.5rem;

    /* Colors for timeline gradients */
    --rose-400: 354 89% 74%;
    --green-500: 142 71% 45%;
    --blue-500: 217 91% 60%;
    --gray-600: 215 14% 34%;

    /* Custom app colors - Updated with new values */
    --drawer-bg: 240 5% 16%; /* rgba(40,40,42,255) */
    --navbar-bg: 240 1% 18%; /* rgba(46,46,47,255) */
    --planner-bg: 240 5% 11%; /* rgba(28,28,30,255) */
    --accent-color: 4 45% 66%; /* rgba(218,125,118,255) */
    --disabled-color: 240 3% 54%; /* rgba(135,135,142,255) */
    --modal-color: 240 5% 11%; /* rgba(28,28,30,255) */
  }
  .dark {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    --card: 0 0% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 0 0% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 0 0% 9%;
    --secondary: 0 0% 14.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 0 0% 14.9%;
    --muted-foreground: 0 0% 63.9%;
    --accent: 0 0% 14.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 14.9%;
    --input: 0 0% 14.9%;
    --ring: 0 0% 83.1%;
    --chart-1: 220 70% 50%;
    --chart-2: 160 60% 45%;
    --chart-3: 30 80% 55%;
    --chart-4: 280 65% 60%;
    --chart-5: 340 75% 55%;

    /* Colors for timeline gradients */
    --rose-400: 354 89% 74%;
    --green-500: 142 71% 45%;
    --blue-500: 217 91% 60%;
    --gray-600: 215 14% 34%;

    /* Custom app colors */
    --drawer-bg: 240 5% 16%;
    --navbar-bg: 240 1% 18%;
    --planner-bg: 240 5% 11%;
    --accent-color: 4 95% 75%;
    --disabled-color: 240 3% 54%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}

@keyframes slideInLeft {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.animate-slide-in-left {
  animation: slideInLeft 0.3s forwards;
}

.animate-slide-in-right {
  animation: slideInRight 0.3s forwards;
}

/* globals.css */
/* @keyframes slide-in-left {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes slide-in-right {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

/* Add these new keyframes */
/* @keyframes slide-out-left {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-100%);
  }
}

@keyframes slide-out-right {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(100%);
  } */
/* }  */

/* .animate-slide-out-left {
  animation: slide-out-left 0.3s ease-in-out forwards;
  z-index: 10;
}

.animate-slide-out-right {
  animation: slide-out-right 0.3s ease-in-out forwards;
  z-index: 10;
}

.animate-slide-in-left {
  animation: slide-in-left 0.3s ease-in-out forwards;
  z-index: 20;
  left: 100%;
}

.animate-slide-in-right {
  animation: slide-in-right 0.3s ease-in-out forwards;
  z-index: 20;
  right: 100%;
} */

/* Calendar customizations */
.calendar-month .rdp-months {
  width: 100%;
}

.calendar-month .rdp-month {
  width: 100%;
}

.calendar-month .rdp-table {
  width: 100%;
}

.calendar-month .rdp-cell {
  padding: 0;
  text-align: center;
}

.calendar-month .rdp-button {
  width: 100%;
  height: 40px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
}
