/** next-themes values. Phosphor is a dark mode, so the `dark:` variant matches it too. */
export const THEMES = ["light", "dark", "phosphor"] as const;

export type Mode = (typeof THEMES)[number];

export const MODES: { value: Mode | "system"; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "phosphor", label: "Phosphor" },
  { value: "system", label: "System" },
];
