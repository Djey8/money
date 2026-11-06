import type { OpportunityCard } from './cashflow-game/opportunity-deck';
import { act, link, tr } from './cashflow-enrich-kit';

/**
 * Employer and pension benefits, and career and education (JFK, 2026-11-06). Two kinds of card the first stack lacked:
 *
 * - plans you pay into - a savings contract of the employer, a company pension, a state-subsidised pension, a private pension: you
 *   register them as a Grow project, decide how long you pay in (the card you take), pay every Payday, and at the end you get back
 *   what you paid in plus a bonus (the employer's share, the state's allowance). Stopped early, you get back less;
 * - an investment in yourself - a course, a certificate, a master craftsman's diploma, a degree: you pay now, the new pay starts when
 *   you have finished (a ramp of Paydays), and a die decides how much it raises your income. Nobody buys a course from you.
 *
 * They come on top of the tuned first stack (the numbers here are final) and carry their own words, tips, tasks and links.
 */

const text = (en: string, de: string) => ({ en, de });

const band = (from: number, to: number, cashflowMinor: number) => ({
  from,
  to,
  value: { cashflowMinor },
});

type Base = Pick<
  OpportunityCard,
  'id' | 'pile' | 'title' | 'story' | 'category' | 'pattern' | 'riskScore'
> & {
  strategy: string;
  reasoning: string;
  risks: string;
  insights: string;
  alternative: string;
  tip: string;
};

function card(base: Base, rest: Partial<OpportunityCard>): OpportunityCard {
  return {
    growType: 'income-growth',
    kind: 'asset',
    alternativeCostMinor: 0,
    links: [],
    actions: [],
    ...base,
    ...rest,
  } as OpportunityCard;
}

const PENSION_LINKS = [
  link(
    'Wikipedia – Betriebliche Altersversorgung',
    'https://de.wikipedia.org/wiki/Betriebliche_Altersversorgung',
  ),
  link('Deutsche Rentenversicherung', 'https://www.deutsche-rentenversicherung.de/'),
];

const PLAN_ACTIONS = [
  act(
    'Check what the Payday leaves after the payment before you sign',
    'Prüfe vor dem Abschluss, was nach der Zahlung vom Zahltag übrig bleibt',
    'high',
  ),
  act(
    'Ask what happens to the bonus if you stop early',
    'Frag, was mit dem Bonus passiert, wenn du früher aufhörst',
    'medium',
  ),
  act(
    'Write down the day the plan pays out and what you will do with the money',
    'Schreibe den Tag der Auszahlung auf und was du mit dem Geld vorhast',
    'low',
  ),
];

const COURSE_ACTIONS = [
  act(
    'Ask your employer whether they pay for the course or give you the time',
    'Frag deinen Arbeitgeber, ob er den Kurs bezahlt oder dir die Zeit gibt',
    'high',
  ),
  act(
    'Write down which job or pay level the diploma opens, and ask for it',
    'Schreibe auf, welche Stelle oder Gehaltsstufe das Diplom öffnet, und frag danach',
    'high',
  ),
  act(
    'Look for a grant or a tax deduction for the cost of the training',
    'Suche nach einer Förderung oder einer steuerlichen Absetzung für die Weiterbildungskosten',
    'medium',
  ),
];

export const CAREER_PENSION_CARDS: OpportunityCard[] = [
  // ── Seed ──
  card(
    {
      id: 'S37',
      pile: 'seed',
      title: text('Employer Savings Plan', 'Vermögenswirksame Leistungen'),
      story: text(
        'Your employer adds money to a savings contract in your name - if you put some in too. Free money, and it is locked for a year.',
        'Dein Arbeitgeber legt Geld auf einen Sparvertrag in deinem Namen - wenn du auch etwas einzahlst. Geschenktes Geld, aber ein Jahr gebunden.',
      ),
      category: tr('Seed · employer benefit', 'Seed · Leistung vom Arbeitgeber'),
      pattern: tr('employer match', 'Zuschuss vom Arbeitgeber'),
      strategy: tr(
        'Sign the contract with your employer’s form, pay the small monthly amount for twelve Paydays and collect the employer’s share at the end. Use it every year: it costs little and adds a bonus nothing else gives you.',
        'Unterschreibe den Vertrag mit dem Formular deines Arbeitgebers, zahle zwölf Zahltage lang den kleinen Monatsbetrag und hole am Ende den Zuschuss ab. Nutze es jedes Jahr: Es kostet wenig und bringt einen Bonus, den sonst nichts bringt.',
      ),
      reasoning: tr(
        'An employer’s match is a return you cannot find on the market: half again on what you pay in.',
        'Der Zuschuss eines Arbeitgebers ist eine Rendite, die du am Markt nicht findest: die Hälfte obendrauf auf das, was du einzahlst.',
      ),
      risks: tr(
        'Risk 1 of 5: the money is locked for the term, and you lose the bonus if you stop. The bank or fund that holds it must be safe.',
        'Risiko 1 von 5: Das Geld ist für die Laufzeit gebunden, und stoppst du, verlierst du den Bonus. Die Bank oder der Fonds muss sicher sein.',
      ),
      insights: tr(
        'Employers in Germany may give vermögenswirksame Leistungen up to a limit a month; many collective agreements include them, and many employees never ask.',
        'Arbeitgeber in Deutschland dürfen vermögenswirksame Leistungen bis zu einer Grenze im Monat geben; viele Tarifverträge enthalten sie, und viele Angestellte fragen nie danach.',
      ),
      alternative: 'Save the same amount yourself',
      riskScore: 1,
      tip: tr(
        'Do: ask HR first - many people have a claim and never use it. Don’t: stop before the end, the bonus is gone then.',
        'Tu: Frag zuerst die Personalabteilung - viele haben einen Anspruch und nutzen ihn nie. Lass: vor dem Ende aufzuhören, dann ist der Bonus weg.',
      ),
    },
    {
      contribution: { monthlyMinor: 4000, paydays: 12, bonusPercent: 50 },
      links: [
        link(
          'Wikipedia – Vermögenswirksame Leistungen',
          'https://de.wikipedia.org/wiki/Verm%C3%B6genswirksame_Leistungen',
        ),
        link('Verbraucherzentrale', 'https://www.verbraucherzentrale.de/'),
      ],
      actions: PLAN_ACTIONS,
      note: tr(
        'You pay in every Payday; what you paid in comes back at the end with the employer’s share.',
        'Du zahlst bei jedem Zahltag ein; das Eingezahlte kommt am Ende mit dem Zuschuss des Arbeitgebers zurück.',
      ),
    },
  ),
  card(
    {
      id: 'S38',
      pile: 'seed',
      title: text('Company Pension (one year)', 'Betriebsrente (ein Jahr)'),
      story: text(
        'Your employer offers to pay part of your salary into a company pension and add a share. You choose how long you pay in - this card is the short one.',
        'Dein Arbeitgeber bietet an, einen Teil deines Gehalts in eine Betriebsrente zu zahlen und einen Zuschuss dazuzugeben. Du wählst, wie lange du einzahlst - diese Karte ist die kurze.',
      ),
      category: tr('Seed · pension', 'Seed · Altersvorsorge'),
      pattern: tr('company pension', 'Betriebsrente'),
      strategy: tr(
        'Convert a part of your pay into the plan: you pay no tax and no social contributions on it, the employer adds a share, and the money grows until you take it out. Take the short card to try it, the long card when you are sure.',
        'Wandle einen Teil deines Gehalts in den Vertrag um: Darauf zahlst du keine Steuer und keine Sozialabgaben, der Arbeitgeber legt einen Zuschuss dazu, und das Geld wächst, bis du es nimmst. Nimm die kurze Karte zum Ausprobieren, die lange, wenn du sicher bist.',
      ),
      reasoning: tr(
        'The state and the employer pay part of it: the bonus is the tax and contributions you save plus the employer’s share.',
        'Staat und Arbeitgeber zahlen einen Teil: Der Bonus sind die gesparten Steuern und Abgaben plus der Zuschuss des Arbeitgebers.',
      ),
      risks: tr(
        'Risk 1 of 5: the money is locked, a payout in old age is taxed, and a change of job can make the plan hard to take along.',
        'Risiko 1 von 5: Das Geld ist gebunden, eine Auszahlung im Alter wird versteuert, und bei einem Jobwechsel ist der Vertrag schwer mitzunehmen.',
      ),
      insights: tr(
        'Since 2019 an employer must add 15% to what you convert into a company pension when it saves social contributions.',
        'Seit 2019 muss ein Arbeitgeber 15 % auf das Umgewandelte drauflegen, wenn er dadurch Sozialabgaben spart.',
      ),
      alternative: 'Pay the same into a savings account',
      riskScore: 1,
      tip: tr(
        'Do: compare the offer of your employer with a private plan. Don’t: pay in more than you can spare - you cannot get it out early without a loss.',
        'Tu: Vergleiche das Angebot deines Arbeitgebers mit einem privaten Vertrag. Lass: mehr einzuzahlen, als du entbehren kannst - früher kommst du ohne Verlust nicht heraus.',
      ),
    },
    {
      contribution: { monthlyMinor: 8000, paydays: 12, bonusPercent: 20 },
      links: [
        ...PENSION_LINKS,
        link('Wikipedia – Altersvorsorge', 'https://de.wikipedia.org/wiki/Altersvorsorge'),
      ],
      actions: PLAN_ACTIONS,
    },
  ),
  card(
    {
      id: 'S39',
      pile: 'seed',
      title: text('Company Pension (two years)', 'Betriebsrente (zwei Jahre)'),
      story: text(
        'The same company pension, paid in for twice as long - the longer you stay, the bigger the share the employer and the state add.',
        'Dieselbe Betriebsrente, doppelt so lange eingezahlt - je länger du bleibst, desto größer der Zuschuss von Arbeitgeber und Staat.',
      ),
      category: tr('Seed · pension', 'Seed · Altersvorsorge'),
      pattern: tr('company pension', 'Betriebsrente'),
      strategy: tr(
        'Commit for the long term: twice the Paydays, a bigger bonus. Only choose it if you will not need the money and will stay with the employer.',
        'Lege dich langfristig fest: doppelt so viele Zahltage, ein größerer Bonus. Wähle sie nur, wenn du das Geld nicht brauchst und beim Arbeitgeber bleibst.',
      ),
      reasoning: tr(
        'Time is the biggest lever of a plan: the longer you pay in, the more the bonus is worth.',
        'Zeit ist der größte Hebel eines Vertrags: Je länger du einzahlst, desto mehr ist der Bonus wert.',
      ),
      risks: tr(
        'Risk 2 of 5: you are tied for a long time. A new job, a baby or a bad year can make the payment hard.',
        'Risiko 2 von 5: Du bist lange gebunden. Ein neuer Job, ein Baby oder ein schlechtes Jahr können die Zahlung schwer machen.',
      ),
      insights: tr(
        'The longer the term, the more of the final sum comes from the bonus and the growth, not from your own payments.',
        'Je länger die Laufzeit, desto mehr der Endsumme stammt aus Bonus und Wachstum, nicht aus deinen eigenen Zahlungen.',
      ),
      alternative: 'The one-year company pension',
      riskScore: 2,
      tip: tr(
        'Do: keep a reserve first. Don’t: choose the long plan to impress anybody - you can always start the short one again.',
        'Tu: Baue zuerst eine Reserve auf. Lass: den langen Vertrag zu wählen, um jemanden zu beeindrucken - den kurzen kannst du immer wieder starten.',
      ),
    },
    {
      contribution: { monthlyMinor: 8000, paydays: 24, bonusPercent: 45 },
      links: [
        ...PENSION_LINKS,
        link('Wikipedia – Altersvorsorge', 'https://de.wikipedia.org/wiki/Altersvorsorge'),
      ],
      actions: PLAN_ACTIONS,
    },
  ),
  card(
    {
      id: 'S40',
      pile: 'seed',
      title: text('Online Certificate Course', 'Online-Zertifikatskurs'),
      story: text(
        'Eight weeks of evenings, a certificate at the end. Some employers pay more for it, some do not notice.',
        'Acht Wochen Abende, am Ende ein Zertifikat. Manche Arbeitgeber zahlen dafür mehr, manche merken es nicht.',
      ),
      category: tr('Seed · education', 'Seed · Bildung'),
      pattern: tr('short course', 'Kurzer Kurs'),
      strategy: tr(
        'Pick a skill your employer already needs, finish the course within a few weeks, and bring the certificate to the next pay talk. Cheap to try, small to win.',
        'Wähle eine Fähigkeit, die dein Arbeitgeber schon braucht, schließe den Kurs in wenigen Wochen ab und bring das Zertifikat zum nächsten Gehaltsgespräch. Billig zum Ausprobieren, klein zu gewinnen.',
      ),
      reasoning: tr(
        'A small cost for a small step up; it also teaches you whether a bigger course is worth the money.',
        'Kleine Kosten für einen kleinen Schritt nach oben; außerdem lernst du, ob sich ein größerer Kurs lohnt.',
      ),
      risks: tr(
        'Risk 2 of 5: a certificate nobody asks for pays nothing. Ask first what your employer would pay for.',
        'Risiko 2 von 5: Ein Zertifikat, nach dem keiner fragt, bringt nichts. Frag zuerst, wofür dein Arbeitgeber zahlen würde.',
      ),
      insights: tr(
        'Short certificates help most when they close a gap your employer has named - not when they are collected.',
        'Kurze Zertifikate helfen am meisten, wenn sie eine Lücke schließen, die dein Arbeitgeber genannt hat - nicht, wenn sie gesammelt werden.',
      ),
      alternative: 'Learn the same from free material',
      riskScore: 2,
      tip: tr(
        'Do: finish it and ask for the raise in the same month. Don’t: start three courses at once.',
        'Tu: Schließe ihn ab und bitte im selben Monat um mehr Gehalt. Lass: drei Kurse gleichzeitig zu beginnen.',
      ),
    },
    {
      costMinor: 25000,
      rampPaydays: 3,
      dice: [band(1, 3, 0), band(4, 5, 8000), band(6, 6, 15000)],
      unsellable: true,
      links: [
        link('Wikipedia – Weiterbildung', 'https://de.wikipedia.org/wiki/Weiterbildung'),
        link(
          'Bundesagentur für Arbeit – Weiterbildung',
          'https://www.arbeitsagentur.de/karriere-und-weiterbildung',
        ),
      ],
      actions: COURSE_ACTIONS,
      note: tr(
        'Cost = the course. The new pay starts when you have finished, and a roll decides how much your employer adds.',
        'Kosten = der Kurs. Das neue Gehalt beginnt, wenn du fertig bist, und ein Wurf entscheidet, wie viel dein Arbeitgeber drauflegt.',
      ),
    },
  ),
  // ── Sapling ──
  card(
    {
      id: 'P33',
      pile: 'sapling',
      title: text('Subsidised Pension Plan', 'Staatlich geförderte Altersvorsorge'),
      story: text(
        'The state adds an allowance to every payment you put into a certified pension plan, and more for children. You pay in for two years.',
        'Der Staat legt auf jede Einzahlung in einen zertifizierten Vorsorgevertrag eine Zulage drauf, für Kinder mehr. Du zahlst zwei Jahre ein.',
      ),
      category: tr('Sapling · pension', 'Sapling · Altersvorsorge'),
      pattern: tr('subsidised pension', 'Geförderte Altersvorsorge'),
      strategy: tr(
        'Register the plan with the state allowance, pay in the minimum that earns the full allowance, and compare the costs of the provider - they can eat the bonus.',
        'Melde den Vertrag mit Zulage an, zahle das Minimum ein, das die volle Zulage bringt, und vergleiche die Kosten des Anbieters - sie können den Bonus auffressen.',
      ),
      reasoning: tr(
        'A free allowance on every payment beats almost any return; the catch is the costs of the contract.',
        'Eine geschenkte Zulage auf jede Zahlung schlägt fast jede Rendite; der Haken sind die Kosten des Vertrags.',
      ),
      risks: tr(
        'Risk 2 of 5: high costs and fixed rules; changing the provider can cost you; the payout is taxed.',
        'Risiko 2 von 5: Hohe Kosten und feste Regeln; ein Anbieterwechsel kann kosten; die Auszahlung wird versteuert.',
      ),
      insights: tr(
        'Consumer advocates tell people to compare the total cost of the contract, not the size of the allowance.',
        'Verbraucherschützer raten, die Gesamtkosten des Vertrags zu vergleichen, nicht die Höhe der Zulage.',
      ),
      alternative: 'An ETF savings plan with the same payments',
      riskScore: 2,
      tip: tr(
        'Do: ask for the cost figures in writing. Don’t: sign at a kitchen-table sales visit.',
        'Tu: Lass dir die Kostenzahlen schriftlich geben. Lass: bei einem Vertreterbesuch am Küchentisch zu unterschreiben.',
      ),
    },
    {
      contribution: { monthlyMinor: 12000, paydays: 24, bonusPercent: 35 },
      links: [
        link('Wikipedia – Riester-Rente', 'https://de.wikipedia.org/wiki/Riester-Rente'),
        link('Wikipedia – Basisrente', 'https://de.wikipedia.org/wiki/Basisrente'),
      ],
      actions: PLAN_ACTIONS,
    },
  ),
  card(
    {
      id: 'P34',
      pile: 'sapling',
      title: text('Evening Course for a Promotion', 'Abendkurs für die Beförderung'),
      story: text(
        'Two evenings a week for half a year, a diploma that your company asks for on the next step of the ladder.',
        'Zwei Abende pro Woche ein halbes Jahr lang, ein Abschluss, den deine Firma für die nächste Stufe der Leiter verlangt.',
      ),
      category: tr('Sapling · education', 'Sapling · Bildung'),
      pattern: tr('further training', 'Weiterbildung'),
      strategy: tr(
        'Agree with your manager which diploma opens which job, take the course next to work, and ask for the new pay the day you pass. Spread the cost: employers often pay half.',
        'Kläre mit deinem Vorgesetzten, welcher Abschluss welche Stelle öffnet, mache den Kurs neben der Arbeit und bitte um das neue Gehalt an dem Tag, an dem du bestehst. Verteile die Kosten: Arbeitgeber zahlen oft die Hälfte.',
      ),
      reasoning: tr(
        'Income is the biggest lever on your cash flow: a raise of a few hundred a month pays for the course within a year.',
        'Einkommen ist der größte Hebel für deinen Cashflow: Eine Erhöhung um einige hundert im Monat zahlt den Kurs innerhalb eines Jahres.',
      ),
      risks: tr(
        'Risk 2 of 5: you may not pass, and a diploma does not force a raise. Evenings are gone for half a year.',
        'Risiko 2 von 5: Du kannst durchfallen, und ein Abschluss erzwingt keine Erhöhung. Die Abende sind ein halbes Jahr weg.',
      ),
      insights: tr(
        'Training that your employer asked for is the one that most often turns into a raise.',
        'Weiterbildung, nach der dein Arbeitgeber gefragt hat, wird am häufigsten zur Gehaltserhöhung.',
      ),
      alternative: 'Ask for more responsibility without a course',
      riskScore: 2,
      tip: tr(
        'Do: get the promotion in writing before you pay. Don’t: take a course with a title nobody in your field knows.',
        'Tu: Lass dir die Beförderung vor der Zahlung schriftlich geben. Lass: einen Kurs mit einem Titel zu nehmen, den in deiner Branche keiner kennt.',
      ),
    },
    {
      costMinor: 120000,
      rampPaydays: 6,
      dice: [band(1, 1, 0), band(2, 4, 20000), band(5, 6, 35000)],
      unsellable: true,
      links: [
        link('Wikipedia – Fachwirt', 'https://de.wikipedia.org/wiki/Fachwirt'),
        link(
          'Bundesagentur für Arbeit – Weiterbildung',
          'https://www.arbeitsagentur.de/karriere-und-weiterbildung',
        ),
      ],
      actions: COURSE_ACTIONS,
      note: tr(
        'Cost = the course. The raise starts when you have finished; a roll decides whether and how much.',
        'Kosten = der Kurs. Die Erhöhung beginnt, wenn du fertig bist; ein Wurf entscheidet, ob und wie viel.',
      ),
    },
  ),
  card(
    {
      id: 'P35',
      pile: 'sapling',
      title: text('Master Craftsman’s Diploma', 'Meisterbrief'),
      story: text(
        'A year of weekends in a training centre, an exam, and a diploma that lets you lead, train and run a business of your own.',
        'Ein Jahr Wochenenden im Bildungszentrum, eine Prüfung und ein Abschluss, der dich führen, ausbilden und einen eigenen Betrieb leiten lässt.',
      ),
      category: tr('Sapling · education', 'Sapling · Bildung'),
      pattern: tr('master diploma', 'Meisterabschluss'),
      strategy: tr(
        'Plan the year: check which part of the cost a grant pays, take the exam parts one by one, and choose a position that uses the diploma at once. A foreman’s pay is the first return; a business of your own the second.',
        'Plane das Jahr: Prüfe, welchen Teil der Kosten eine Förderung zahlt, lege die Prüfungsteile nacheinander ab und wähle eine Stelle, die den Abschluss sofort nutzt. Das Gehalt eines Meisters ist die erste Rendite, ein eigener Betrieb die zweite.',
      ),
      reasoning: tr(
        'A recognised diploma lifts your pay for the rest of your working life, and it is the key to your own business.',
        'Ein anerkannter Abschluss hebt dein Gehalt für den Rest des Berufslebens und ist der Schlüssel zum eigenen Betrieb.',
      ),
      risks: tr(
        'Risk 3 of 5: it costs a lot, a year of free time, and the exam is hard. Without a job that needs it, the raise stays small.',
        'Risiko 3 von 5: Er kostet viel, ein Jahr Freizeit, und die Prüfung ist schwer. Ohne Stelle, die ihn braucht, bleibt die Erhöhung klein.',
      ),
      insights: tr(
        'In Germany a grant (Aufstiegs-BAföG) can pay a large part of the fees for a master’s diploma or a similar further training.',
        'In Deutschland kann das Aufstiegs-BAföG einen großen Teil der Gebühren für einen Meisterabschluss oder eine ähnliche Fortbildung zahlen.',
      ),
      alternative: 'Stay in your job and wait for the yearly review',
      riskScore: 3,
      tip: tr(
        'Do: apply for the grant before you pay anything. Don’t: start without a job in view that asks for the diploma.',
        'Tu: Beantrage die Förderung, bevor du etwas zahlst. Lass: ohne eine Stelle in Sicht anzufangen, die den Abschluss verlangt.',
      ),
    },
    {
      costMinor: 400000,
      rampPaydays: 12,
      dice: [band(1, 1, 0), band(2, 4, 45000), band(5, 6, 70000)],
      unsellable: true,
      links: [
        link('Wikipedia – Meisterprüfung', 'https://de.wikipedia.org/wiki/Meisterpr%C3%BCfung'),
        link('Aufstiegs-BAföG', 'https://www.aufstiegs-bafoeg.de/'),
      ],
      actions: COURSE_ACTIONS,
      note: tr(
        'Cost = the fees. The raise starts after a year of training; a roll decides how much.',
        'Kosten = die Gebühren. Die Erhöhung beginnt nach einem Jahr Ausbildung; ein Wurf entscheidet, wie viel.',
      ),
    },
  ),
  // ── Tree ──
  card(
    {
      id: 'T31',
      pile: 'tree',
      title: text('Part-Time Master’s Degree', 'Berufsbegleitender Master'),
      story: text(
        'Two years next to your job: lectures on Saturdays, a thesis, and a degree that opens positions that were closed to you.',
        'Zwei Jahre neben dem Job: Vorlesungen samstags, eine Abschlussarbeit und ein Abschluss, der Stellen öffnet, die dir verschlossen waren.',
      ),
      category: tr('Tree · education', 'Tree · Bildung'),
      pattern: tr('degree', 'Studienabschluss'),
      strategy: tr(
        'Choose a degree your field pays for, ask your employer to share the fee, and plan the two years like a project: the money, the time, and the position you want at the end. The pay rise is large but comes late.',
        'Wähle einen Abschluss, den deine Branche bezahlt, bitte deinen Arbeitgeber, sich an der Gebühr zu beteiligen, und plane die zwei Jahre wie ein Projekt: das Geld, die Zeit und die Stelle, die du am Ende willst. Die Erhöhung ist groß, kommt aber spät.',
      ),
      reasoning: tr(
        'A degree changes the ceiling of your pay, not just the next step - the biggest single lever on a lifetime of cash flow.',
        'Ein Abschluss verändert die Obergrenze deines Gehalts, nicht nur die nächste Stufe - der größte einzelne Hebel für einen Cashflow über ein ganzes Leben.',
      ),
      risks: tr(
        'Risk 3 of 5: a lot of money and time, and no guarantee: the position has to exist. Drop-out happens.',
        'Risiko 3 von 5: Viel Geld und Zeit und keine Garantie: Die Stelle muss es geben. Abbrüche kommen vor.',
      ),
      insights: tr(
        'Part-time degrees are usually paid in instalments; employers often pay a part if you stay with them for some years after.',
        'Berufsbegleitende Abschlüsse werden meist in Raten bezahlt; Arbeitgeber zahlen oft einen Teil, wenn du danach einige Jahre bleibst.',
      ),
      alternative: 'A shorter certificate in the same field',
      riskScore: 3,
      tip: tr(
        'Do: write down the position you want before you enrol. Don’t: borrow for the whole fee if your employer would share it.',
        'Tu: Schreibe die Stelle, die du willst, vor der Einschreibung auf. Lass: die ganze Gebühr zu leihen, wenn dein Arbeitgeber sich beteiligen würde.',
      ),
    },
    {
      costMinor: 1400000,
      rampPaydays: 24,
      dice: [band(1, 1, 0), band(2, 4, 120000), band(5, 6, 200000)],
      unsellable: true,
      links: [
        link('Wikipedia – Fernstudium', 'https://de.wikipedia.org/wiki/Fernstudium'),
        link('Wikipedia – Masterstudiengang', 'https://de.wikipedia.org/wiki/Masterstudiengang'),
      ],
      actions: COURSE_ACTIONS,
      note: tr(
        'Cost = the fees of two years. The new pay starts after the degree; a roll decides how much.',
        'Kosten = die Gebühren von zwei Jahren. Das neue Gehalt beginnt nach dem Abschluss; ein Wurf entscheidet, wie viel.',
      ),
    },
  ),
  card(
    {
      id: 'T32',
      pile: 'tree',
      title: text('Private Pension Insurance', 'Private Rentenversicherung'),
      story: text(
        'A contract that pays in for three years and invests in funds: at the end the sum comes out in one payment, with the growth and a bonus.',
        'Ein Vertrag, der drei Jahre einzahlt und in Fonds anlegt: Am Ende kommt die Summe in einer Zahlung heraus, mit Wachstum und Bonus.',
      ),
      category: tr('Tree · pension', 'Tree · Altersvorsorge'),
      pattern: tr('private pension', 'Private Altersvorsorge'),
      strategy: tr(
        'Choose a fund-based contract with low costs, pay the full amount for the whole term, and take the sum at the end in one payment to reinvest. Ask for the total costs of the contract first.',
        'Wähle einen fondsgebundenen Vertrag mit niedrigen Kosten, zahle die volle Rate über die ganze Laufzeit und nimm die Summe am Ende auf einmal, um sie neu anzulegen. Frag vorher nach den Gesamtkosten des Vertrags.',
      ),
      reasoning: tr(
        'A long plan turns a monthly habit into a large sum; the growth and the bonus do the work of the last years.',
        'Ein langer Vertrag macht eine monatliche Gewohnheit zu einer großen Summe; Wachstum und Bonus erledigen die Arbeit der letzten Jahre.',
      ),
      risks: tr(
        'Risk 2 of 5: costs and commissions can take a lot of the growth; stopping early loses money; the funds can fall.',
        'Risiko 2 von 5: Kosten und Provisionen können viel vom Wachstum nehmen; früher aufzuhören kostet Geld; die Fonds können fallen.',
      ),
      insights: tr(
        'Test magazines often find that cheap fund plans beat expensive insurance contracts: compare the costs per year, not the promise.',
        'Testmagazine finden oft, dass günstige Fondssparpläne teure Versicherungsverträge schlagen: Vergleiche die Kosten pro Jahr, nicht das Versprechen.',
      ),
      alternative: 'An ETF savings plan with the same payments',
      riskScore: 2,
      tip: tr(
        'Do: ask what you get if you stop after one year. Don’t: sign because of the tax talk of the seller.',
        'Tu: Frag, was du bekommst, wenn du nach einem Jahr aufhörst. Lass: wegen der Steuer-Argumente des Verkäufers zu unterschreiben.',
      ),
    },
    {
      contribution: { monthlyMinor: 25000, paydays: 36, bonusPercent: 55 },
      links: [
        link(
          'Wikipedia – Private Rentenversicherung',
          'https://de.wikipedia.org/wiki/Private_Rentenversicherung',
        ),
        link(
          'Wikipedia – Fondsgebundene Rentenversicherung',
          'https://de.wikipedia.org/wiki/Fondsgebundene_Rentenversicherung',
        ),
      ],
      actions: PLAN_ACTIONS,
    },
  ),
];
