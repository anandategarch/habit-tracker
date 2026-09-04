// Shared AppSettings interface — canonical shape used by the settings page
// and other components that consume the /api/settings query cache.
//
// Previously duplicated as a full interface in settings.tsx and a minimal
// shape in calendar-view.tsx. Centralizing here lets future components
// import the same type without re-declaring it.

export interface AppSettings {
  id: string;
  userName: string;
  theme: string;
  primaryColor: string;
  secondaryColor: string;
  weekStart: string;
  language: string;
  targetCompletion: number;
  createdAt: string;
  updatedAt: string;
}
