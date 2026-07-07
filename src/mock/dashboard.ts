// DEMO / MOCK data for the Home dashboard.
//
// Nothing here is real: no cameras, detections, or public alerts exist yet — those
// arrive in Phases 2–5. `getDashboardSummary` deliberately simulates a network call
// (short delay) so the Home screen can exercise its loading/error states. A real
// data source will later replace this function behind the same signature.

export type Tone = 'neutral' | 'success' | 'alert';

export type DashboardStat = {
  key: string;
  label: string;
  value: string;
  tone: Tone;
};

export type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: Tone;
};

export type DashboardSummary = {
  neighborhood: string;
  stats: DashboardStat[];
  recentActivity: ActivityItem[];
};

const demoDashboardSummary: DashboardSummary = {
  neighborhood: 'Maple Grove',
  stats: [
    { key: 'cameras', label: 'Cameras online', value: '4', tone: 'success' },
    { key: 'review', label: 'Pending review', value: '2', tone: 'alert' },
    { key: 'nearby', label: 'Active nearby', value: '1', tone: 'neutral' },
  ],
  recentActivity: [
    {
      id: 'a1',
      title: 'Motion at Front Door',
      detail: 'Person detected — awaiting your review',
      time: '8 min ago',
      tone: 'alert',
    },
    {
      id: 'a2',
      title: 'Package left at Porch Cam',
      detail: 'You approved this alert',
      time: '1 hr ago',
      tone: 'success',
    },
    {
      id: 'a3',
      title: 'Backyard Cam reconnected',
      detail: 'Camera back online',
      time: '3 hr ago',
      tone: 'neutral',
    },
  ],
};

export function getDashboardSummary(): Promise<DashboardSummary> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(demoDashboardSummary), 600);
  });
}
