/**
 * The career of the Dual Student (JFK, 2026-10-26, temp_cards/dreamfund-career-dual-student.md v0.2): nine stages, English and German.
 * Data Analyst, Data Engineer, Senior, then technical or management. Kept out of the domain package's main entry.
 */
import type { CareerTrack } from './cashflow-game/career';

export const DUAL_STUDENT_CAREER: CareerTrack = {
  start: 'C1',
  stages: [
    {
      id: 'C1',
      stage: 1,
      title: {
        en: 'Dual Student',
        de: 'Dualer Student',
      },
      story: {
        en: 'Three days at the company, two at university. A real salary while you study — and a thesis waiting at the end.',
        de: 'Drei Tage im Betrieb, zwei an der Hochschule. Ein echtes Gehalt während des Studiums — und am Ende wartet die Bachelorarbeit.',
      },
      grossYearMinor: 3400000,
      netMonthMinor: 195500,
      taxMonthMinor: 26600,
      socialMonthMinor: 61100,
      expensesDeltaMinor: 0,
      livingStandard: 1.0,
      next: {
        stages: ['C2'],
        minPaydays: 3,
        rollFrom: 3,
        onFail: {
          upTo: 2,
          oneTimeMinor: -15000,
          label: {
            en: 'Exam retake',
            de: 'Prüfung wiederholen',
          },
        },
      },
      links: [],
    },
    {
      id: 'C2',
      stage: 2,
      title: {
        en: 'Junior Data Analyst',
        de: 'Junior Data Analyst',
      },
      story: {
        en: 'Your bachelor thesis on demand forecasting got a 1.3, and your team wants to keep you. First full-time contract!',
        de: 'Deine Bachelorarbeit über Nachfrageprognosen hat eine 1,3, und dein Team will dich behalten. Erster Vollzeitvertrag!',
      },
      grossYearMinor: 5600000,
      netMonthMinor: 295200,
      taxMonthMinor: 70900,
      socialMonthMinor: 100600,
      expensesDeltaMinor: 20000,
      oneTimeMinor: -30000,
      livingStandard: 1.1,
      next: {
        stages: ['C3'],
        minPaydays: 4,
        rollFrom: 4,
      },
      links: [
        {
          label: {
            en: 'get-in-it – Einstiegsgehalt Informatiker 2026',
            de: 'get-in-it – Einstiegsgehalt Informatiker 2026',
          },
          url: 'https://www.get-in-it.de/magazin/gehalt/statistik',
        },
        {
          label: {
            en: 'jobrise – Data Analyst Gehalt München 2026',
            de: 'jobrise – Data Analyst Gehalt München 2026',
          },
          url: 'https://jobrise.io/de/blog/data-analyst-gehalt-munich-2026/',
        },
      ],
    },
    {
      id: 'C3',
      stage: 3,
      title: {
        en: 'Data Engineer',
        de: 'Data Engineer',
      },
      story: {
        en: "You automated half the team's reports. Your manager offers you the move into data engineering.",
        de: 'Du hast die Hälfte der Reports im Team automatisiert. Deine Chefin bietet dir den Wechsel ins Data Engineering an.',
      },
      grossYearMinor: 7500000,
      netMonthMinor: 376800,
      taxMonthMinor: 118300,
      socialMonthMinor: 129900,
      expensesDeltaMinor: 25000,
      livingStandard: 1.2,
      next: {
        stages: ['C4'],
        minPaydays: 4,
        rollFrom: 5,
      },
      links: [
        {
          label: {
            en: 'jobrise – Was verdient ein Data Engineer 2026',
            de: 'jobrise – Was verdient ein Data Engineer 2026',
          },
          url: 'https://jobrise.io/de/blog/was-verdient-ein-data-engineer-2026/',
        },
      ],
    },
    {
      id: 'C4',
      stage: 4,
      title: {
        en: 'Senior Data Engineer',
        de: 'Senior Data Engineer',
      },
      story: {
        en: "You own the data platform, review everyone's code and mentor two juniors. Five years in, you're senior.",
        de: 'Du verantwortest die Datenplattform, reviewst den Code aller und betreust zwei Juniors. Nach fünf Jahren bist du Senior.',
      },
      grossYearMinor: 9500000,
      netMonthMinor: 461800,
      taxMonthMinor: 182300,
      socialMonthMinor: 147600,
      expensesDeltaMinor: 30000,
      bonus: {
        percent: 8,
        netMinor: 395000,
        everyPaydays: 12,
      },
      livingStandard: 1.35,
      next: {
        stages: ['C5T', 'C5M'],
        minPaydays: 5,
        rollFrom: 5,
      },
      links: [
        {
          label: {
            en: 'jobrise – Was verdient ein Data Engineer 2026',
            de: 'jobrise – Was verdient ein Data Engineer 2026',
          },
          url: 'https://jobrise.io/de/blog/was-verdient-ein-data-engineer-2026/',
        },
      ],
    },
    {
      id: 'C5T',
      stage: 5,
      branch: 'technical',
      title: {
        en: 'Staff Data Engineer',
        de: 'Staff Data Engineer',
      },
      story: {
        en: 'You design systems that five teams build on. Fewer meetings, harder problems.',
        de: 'Du entwirfst Systeme, auf denen fünf Teams aufbauen. Weniger Meetings, schwierigere Probleme.',
      },
      grossYearMinor: 11500000,
      netMonthMinor: 546900,
      taxMonthMinor: 258300,
      socialMonthMinor: 153200,
      expensesDeltaMinor: 30000,
      bonus: {
        percent: 10,
        netMinor: 600000,
        everyPaydays: 12,
      },
      livingStandard: 1.45,
      next: {
        stages: ['C6T'],
        minPaydays: 6,
        rollFrom: 6,
        momentOnFive: true,
      },
      links: [
        {
          label: {
            en: 'jobrise – Was verdient ein Data Engineer 2026',
            de: 'jobrise – Was verdient ein Data Engineer 2026',
          },
          url: 'https://jobrise.io/de/blog/was-verdient-ein-data-engineer-2026/',
        },
      ],
    },
    {
      id: 'C6T',
      stage: 6,
      branch: 'technical',
      title: {
        en: 'Chief Data Architect',
        de: 'Chief Data Architect',
      },
      story: {
        en: 'Your design docs are read across the company. You decide which technology the next five years run on.',
        de: 'Deine Architekturdokumente werden im ganzen Unternehmen gelesen. Du entscheidest, auf welcher Technologie die nächsten fünf Jahre laufen.',
      },
      grossYearMinor: 14500000,
      netMonthMinor: 682200,
      taxMonthMinor: 372900,
      socialMonthMinor: 153200,
      expensesDeltaMinor: 40000,
      bonus: {
        percent: 12,
        netMinor: 900000,
        everyPaydays: 12,
      },
      livingStandard: 1.6,
      next: null,
      links: [],
    },
    {
      id: 'C5M',
      stage: 5,
      branch: 'management',
      title: {
        en: 'Data Team Lead',
        de: 'Teamleiter Data',
      },
      story: {
        en: 'Six people, one roadmap, your first budget. Less coding, more one-on-ones.',
        de: 'Sechs Leute, eine Roadmap, dein erstes Budget. Weniger Code, mehr Einzelgespräche.',
      },
      grossYearMinor: 10500000,
      netMonthMinor: 502700,
      taxMonthMinor: 219100,
      socialMonthMinor: 153200,
      expensesDeltaMinor: 35000,
      bonus: {
        percent: 12,
        netMinor: 650000,
        everyPaydays: 12,
      },
      livingStandard: 1.5,
      next: {
        stages: ['C6M'],
        minPaydays: 6,
        rollFrom: 6,
        momentOnFive: true,
      },
      links: [
        {
          label: {
            en: 'jobrise – Data Analyst Gehalt München 2026 (Lead)',
            de: 'jobrise – Data Analyst Gehalt München 2026 (Lead)',
          },
          url: 'https://jobrise.io/de/blog/data-analyst-gehalt-munich-2026/',
        },
      ],
    },
    {
      id: 'C6M',
      stage: 6,
      branch: 'management',
      title: {
        en: 'Head of Data',
        de: 'Head of Data',
      },
      story: {
        en: 'Three teams, a seat in the leadership meeting and a budget with six zeros.',
        de: 'Drei Teams, ein Platz in der Führungsrunde und ein Budget mit sechs Nullen.',
      },
      grossYearMinor: 13000000,
      netMonthMinor: 613100,
      taxMonthMinor: 317000,
      socialMonthMinor: 153200,
      expensesDeltaMinor: 40000,
      bonus: {
        percent: 18,
        netMinor: 1220000,
        everyPaydays: 12,
      },
      livingStandard: 1.6,
      next: {
        stages: ['C7M'],
        minPaydays: 8,
        rollFrom: 6,
        confirmFrom: 4,
        momentOnFive: true,
      },
      links: [],
    },
    {
      id: 'C7M',
      stage: 7,
      branch: 'management',
      title: {
        en: 'Director of Data',
        de: 'Director of Data',
      },
      story: {
        en: 'You report to the board. The data strategy is yours — and so is the responsibility.',
        de: 'Du berichtest an den Vorstand. Die Datenstrategie gehört dir — und die Verantwortung auch.',
      },
      grossYearMinor: 17500000,
      netMonthMinor: 821400,
      taxMonthMinor: 483700,
      socialMonthMinor: 153200,
      expensesDeltaMinor: 55000,
      bonus: {
        percent: 25,
        netMinor: 2275000,
        everyPaydays: 12,
      },
      livingStandard: 1.8,
      companyCar: true,
      next: null,
      links: [],
    },
  ],
};
