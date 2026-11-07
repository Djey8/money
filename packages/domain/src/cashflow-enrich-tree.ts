import { act, link, tr, type CardEnrichment } from './cashflow-enrich-kit';

const RENTAL_CHECKS = [
  act(
    'Check the rent against the local rent index and the running costs against the last statement',
    'Prüfe die Miete am örtlichen Mietspiegel und die Nebenkosten an der letzten Abrechnung',
    'high',
  ),
  act(
    'Read the minutes of the owners’ association and the energy certificate',
    'Lies die Protokolle der Eigentümerversammlung und den Energieausweis',
    'medium',
  ),
  act(
    'Plan a reserve of a few months of rent for repairs and empty months',
    'Plane eine Rücklage von einigen Monatsmieten für Reparaturen und Leerstand',
    'medium',
  ),
];

const BUSINESS_CHECKS = [
  act(
    'Ask for the last three years of accounts and check them with your own tax adviser',
    'Verlange die Abschlüsse der letzten drei Jahre und lass sie von deinem eigenen Steuerberater prüfen',
    'high',
  ),
  act(
    'Talk to the biggest customers and to the staff before you sign',
    'Sprich vor der Unterschrift mit den größten Kunden und den Mitarbeitern',
    'medium',
  ),
  act(
    'Agree on a handover period in which the old owner stays',
    'Vereinbare eine Übergabezeit, in der der alte Eigentümer bleibt',
    'medium',
  ),
];

const POSITION_CHECKS = [
  act(
    'Write down the price at which you add and the price at which you sell, before you buy',
    'Schreibe den Kurs, bei dem du nachkaufst, und den Kurs, bei dem du verkaufst, vor dem Kauf auf',
    'high',
  ),
  act(
    'Buy in two or three steps instead of all at once',
    'Kaufe in zwei, drei Schritten statt auf einmal',
    'medium',
  ),
];

/** The Tree pile (T01-T30): big positions, financed with a bank - properties, businesses and large holdings. */
export const TREE_ENRICH: Record<string, CardEnrichment> = {
  T01: {
    strategy: tr(
      'A small flat in a cheaper city where the rent covers the loan: buy with the minimum deposit, rent to a tenant with a steady job, and let the rent pay the mortgage down for years. Sell when a buyer pays well - or keep it for the cash flow.',
      'Eine kleine Wohnung in einer günstigeren Stadt, in der die Miete den Kredit deckt: Kaufe mit minimaler Anzahlung, vermiete an einen Mieter mit sicherem Job und lass die Miete den Kredit jahrelang tilgen. Verkaufe, wenn ein Käufer gut zahlt - oder behalte sie für den Cashflow.',
    ),
    tip: tr(
      'Do: calculate with a vacancy of one month a year. Don’t: count on the price to rise.',
      'Tu: Rechne mit einem Monat Leerstand im Jahr. Lass: auf steigende Preise zu setzen.',
    ),
    links: [
      link('Wikipedia – Eigentumswohnung', 'https://de.wikipedia.org/wiki/Eigentumswohnung'),
      link('Wikipedia – Mietrendite', 'https://de.wikipedia.org/wiki/Mietrendite'),
    ],
    actions: RENTAL_CHECKS,
  },
  T02: {
    strategy: tr(
      'An auction flat is cheap because you buy blind: no viewing, maybe a tenant who does not leave. Bid at most what the flat is worth after a repair budget and a few months of delay, and expect to wait for your first rent.',
      'Eine Auktionswohnung ist billig, weil du blind kaufst: keine Besichtigung, vielleicht ein Bewohner, der nicht auszieht. Biete höchstens, was die Wohnung nach einem Reparaturbudget und einigen Monaten Verzögerung wert ist, und rechne mit Wartezeit bis zur ersten Miete.',
    ),
    risks: tr(
      'Risk 3 of 5: no inside viewing, hidden damage, and a tenant or resident you may have to move out through a court.',
      'Risiko 3 von 5: Keine Innenbesichtigung, versteckte Schäden und ein Bewohner, den du womöglich gerichtlich zum Auszug bringen musst.',
    ),
    tip: tr(
      'Do: read the expert’s report of the court. Don’t: bid more than you set before the auction starts.',
      'Tu: Lies das Gutachten des Gerichts. Lass: mehr zu bieten, als du vor der Auktion festgelegt hast.',
    ),
    links: [
      link('Wikipedia – Zwangsversteigerung', 'https://de.wikipedia.org/wiki/Zwangsversteigerung'),
    ],
    actions: RENTAL_CHECKS,
  },
  T03: {
    strategy: tr(
      'A flat in a top city costs a lot and pays little rent: the cash flow can be negative at today’s rates. You buy it for the long run - the land is scarce - and need a salary or other income that carries the monthly gap.',
      'Eine Wohnung in einer Top-Stadt kostet viel und bringt wenig Miete: Der Cashflow kann bei heutigen Zinsen negativ sein. Du kaufst sie für die lange Frist - Boden ist knapp - und brauchst Gehalt oder anderes Einkommen, das die monatliche Lücke trägt.',
    ),
    tip: tr(
      'Do: check that you can carry the gap for years. Don’t: buy it for the cash flow - there is none.',
      'Tu: Prüfe, dass du die Lücke Jahre tragen kannst. Lass: sie für den Cashflow zu kaufen - es gibt keinen.',
    ),
    links: [
      link('Wikipedia – Mietpreisbremse', 'https://de.wikipedia.org/wiki/Mietpreisbremse'),
      link(
        'Wikipedia – Annuitätendarlehen',
        'https://de.wikipedia.org/wiki/Annuit%C3%A4tendarlehen',
      ),
    ],
    actions: RENTAL_CHECKS,
  },
  T04: {
    strategy: tr(
      'Six rented units mean six rents and one roof: if one tenant leaves, five still pay. Buy for a fair price, fix the biggest building problem first (heating, roof), and raise the rents step by step within the law.',
      'Sechs vermietete Einheiten bedeuten sechs Mieten unter einem Dach: Zieht einer aus, zahlen fünf weiter. Kaufe zu fairem Preis, behebe zuerst das größte Bauproblem (Heizung, Dach) und erhöhe die Mieten schrittweise im Rahmen des Gesetzes.',
    ),
    tip: tr(
      'Do: ask for the energy certificate and the age of the heating. Don’t: forget that the rules for heating can force a big cost.',
      'Tu: Frag nach Energieausweis und Alter der Heizung. Lass: zu vergessen, dass die Heizungsregeln hohe Kosten erzwingen können.',
    ),
    links: [
      link('Wikipedia – Mietshaus', 'https://de.wikipedia.org/wiki/Mietshaus'),
      link('Wikipedia – Mieterhöhung', 'https://de.wikipedia.org/wiki/Mieterh%C3%B6hung'),
    ],
    actions: RENTAL_CHECKS,
  },
  T05: {
    strategy: tr(
      'A holiday flat earns in the season and less outside it. Price by the week in summer, find a local manager for cleaning and keys, and use it yourself only when it would be empty.',
      'Eine Ferienwohnung verdient in der Saison und außerhalb weniger. Verlange im Sommer Wochenpreise, finde einen örtlichen Verwalter für Reinigung und Schlüssel und nutze sie selbst nur, wenn sie sonst leer stünde.',
    ),
    tip: tr(
      'Do: check the local rules for holiday rentals before you buy. Don’t: plan with the full-season price all year.',
      'Tu: Prüfe die örtlichen Regeln für Ferienvermietung vor dem Kauf. Lass: mit dem Hauptsaison-Preis das ganze Jahr zu planen.',
    ),
    links: [link('Wikipedia – Ferienwohnung', 'https://de.wikipedia.org/wiki/Ferienwohnung')],
    actions: RENTAL_CHECKS,
  },
  T06: {
    strategy: tr(
      'A shop unit rents on a long contract to one business: when it runs, it is quiet income; when the tenant leaves, you can wait a year. Check how long the contract runs and how the tenant is doing.',
      'Eine Ladeneinheit ist auf lange Zeit an ein Geschäft vermietet: Läuft es, ist es ruhiges Einkommen; zieht der Mieter aus, kannst du ein Jahr warten. Prüfe, wie lange der Vertrag läuft und wie es dem Mieter geht.',
    ),
    tip: tr(
      'Do: ask the tenant’s accounts. Don’t: buy a shop in a street that is losing its customers.',
      'Tu: Verlange die Zahlen des Mieters. Lass: einen Laden in einer Straße zu kaufen, die ihre Kunden verliert.',
    ),
    links: [link('Wikipedia – Gewerbeimmobilie', 'https://de.wikipedia.org/wiki/Gewerbeimmobilie')],
    actions: RENTAL_CHECKS,
  },
  T07: {
    strategy: tr(
      'Small furnished flats for students or commuters bring a high rent per square metre. Furnish durably, rent on fixed terms, and keep a plan for the next tenant, because they come and go often.',
      'Kleine möblierte Wohnungen für Studenten oder Pendler bringen hohe Miete pro Quadratmeter. Möbliere haltbar, vermiete mit festen Fristen und halte einen Plan für den nächsten Mieter bereit, denn sie wechseln oft.',
    ),
    tip: tr(
      'Do: check what the rules allow for furnished rentals. Don’t: skip cleaning and repairs between tenants.',
      'Tu: Prüfe, was die Regeln für möblierte Vermietung erlauben. Lass: Reinigung und Reparaturen zwischen den Mietern auszulassen.',
    ),
    links: [link('Wikipedia – Mietshaus', 'https://de.wikipedia.org/wiki/Mietshaus')],
    actions: RENTAL_CHECKS,
  },
  T08: {
    strategy: tr(
      'Buy a rough flat below its fixed-up value, renovate to a clear plan and budget, and rent it for more or sell it for more. The profit is made at the purchase and the renovation - plan both with a reserve of a third.',
      'Kaufe eine marode Wohnung unter ihrem saniertem Wert, sanieren nach klarem Plan und Budget und vermiete sie teurer oder verkaufe sie teurer. Der Gewinn entsteht bei Kauf und Sanierung - plane beides mit einem Drittel Reserve.',
    ),
    risks: tr(
      'Risk 4 of 5: the work costs more and takes longer than planned; rent only starts when it is done.',
      'Risiko 4 von 5: Die Arbeiten kosten mehr und dauern länger als geplant; Miete gibt es erst nach Fertigstellung.',
    ),
    tip: tr(
      'Do: get three offers from craftsmen before you buy. Don’t: begin without a fixed price.',
      'Tu: Hole vor dem Kauf drei Angebote von Handwerkern ein. Lass: ohne Festpreis anzufangen.',
    ),
    links: [link('Wikipedia – Sanierung', 'https://de.wikipedia.org/wiki/Sanierung_(Bauwesen)')],
    actions: RENTAL_CHECKS,
  },
  T09: {
    strategy: tr(
      'A flat in a care home is rented to an operator on a long contract. The rent is steady, but it all depends on the operator and the price you paid. Check the operator’s record, not the brochure.',
      'Eine Wohnung in einem Pflegeheim ist langfristig an einen Betreiber vermietet. Die Miete ist stetig, hängt aber ganz vom Betreiber und vom Kaufpreis ab. Prüfe die Bilanz des Betreibers, nicht den Prospekt.',
    ),
    risks: tr(
      'Risk 3 of 5: if the operator fails, the flat is hard to rent or sell; salesmen often add a big margin to the price.',
      'Risiko 3 von 5: Fällt der Betreiber aus, ist die Wohnung schwer zu vermieten oder zu verkaufen; Vertriebe schlagen oft eine große Marge auf den Preis.',
    ),
    tip: tr(
      'Do: compare the price per square metre with ordinary flats. Don’t: sign at a presentation.',
      'Tu: Vergleiche den Preis pro Quadratmeter mit normalen Wohnungen. Lass: bei einer Präsentation zu unterschreiben.',
    ),
    links: [link('Verbraucherzentrale', 'https://www.verbraucherzentrale.de/')],
    actions: RENTAL_CHECKS,
  },
  T10: {
    strategy: tr(
      'Several parking spaces in one house are one purchase and several rents. Buy where parking is short, rent to neighbours on long contracts, and sell the package to a fund or to a neighbour.',
      'Mehrere Stellplätze in einem Haus sind ein Kauf und mehrere Mieten. Kaufe, wo Parkplätze knapp sind, vermiete an Nachbarn langfristig und verkaufe das Paket an einen Fonds oder einen Nachbarn.',
    ),
    tip: tr(
      'Do: check how many spaces the street really lacks. Don’t: buy where a new car park is planned.',
      'Tu: Prüfe, wie viele Plätze der Straße wirklich fehlen. Lass: dort zu kaufen, wo ein neues Parkhaus geplant ist.',
    ),
    links: [link('Wikipedia – Stellplatz', 'https://de.wikipedia.org/wiki/Stellplatz')],
    actions: RENTAL_CHECKS,
  },
  T11: {
    strategy: tr(
      'A laundromat runs with little staff: machines, a cleaner, and a payment system. Choose a place with many flats and few washing machines, price by the load, and keep the machines in order - a broken one earns nothing.',
      'Ein Waschsalon läuft mit wenig Personal: Maschinen, eine Reinigungskraft und ein Zahlungssystem. Wähle einen Ort mit vielen Wohnungen und wenigen Waschmaschinen, preise nach Ladung und halte die Maschinen in Ordnung - eine defekte verdient nichts.',
    ),
    tip: tr(
      'Do: count the flats within ten minutes’ walk. Don’t: forget the water and energy prices.',
      'Tu: Zähle die Wohnungen im Umkreis von zehn Minuten Fußweg. Lass: Wasser- und Energiepreise zu vergessen.',
    ),
    links: [link('Wikipedia – Waschsalon', 'https://de.wikipedia.org/wiki/Waschsalon')],
    actions: BUSINESS_CHECKS,
  },
  T12: {
    strategy: tr(
      'A franchise gives you a known name and a system, and takes a fee. Pick one where existing owners say they earn what the brochure says, and plan for long hours in the first years.',
      'Ein Franchise gibt dir einen bekannten Namen und ein System und nimmt eine Gebühr. Wähle eines, bei dem bestehende Betreiber sagen, dass sie verdienen, was der Prospekt sagt, und plane in den ersten Jahren lange Arbeitszeiten ein.',
    ),
    tip: tr(
      'Do: talk to three owners without the franchisor present. Don’t: sign before you have seen the fees for the whole contract.',
      'Tu: Sprich mit drei Betreibern ohne den Franchisegeber. Lass: zu unterschreiben, bevor du alle Gebühren des Vertrags gesehen hast.',
    ),
    links: [link('Wikipedia – Franchising', 'https://de.wikipedia.org/wiki/Franchising')],
    actions: BUSINESS_CHECKS,
  },
  T13: {
    strategy: tr(
      'You buy a company that already has customers and a team. Keep the best people with a share of the profit, move the top customers to long contracts, and bring the owner in for a handover.',
      'Du kaufst eine Firma, die schon Kunden und ein Team hat. Halte die besten Leute mit einem Gewinnanteil, bringe die Top-Kunden in langfristige Verträge und hole den Eigentümer für eine Übergabe dazu.',
    ),
    risks: tr(
      'Risk 3 of 5: customers may follow the old owner, and the key staff can quit after the sale.',
      'Risiko 3 von 5: Kunden können dem alten Eigentümer folgen, und Schlüsselmitarbeiter können nach dem Verkauf kündigen.',
    ),
    tip: tr(
      'Do: pay part of the price later, tied to the customers who stay. Don’t: pay everything on day one.',
      'Tu: Zahle einen Teil des Preises später, gebunden an die Kunden, die bleiben. Lass: alles am ersten Tag zu zahlen.',
    ),
    links: [
      link(
        'Wikipedia – Unternehmensnachfolge',
        'https://de.wikipedia.org/wiki/Unternehmensnachfolge',
      ),
      link('nexxt-change', 'https://www.nexxt-change.org/'),
    ],
    actions: BUSINESS_CHECKS,
  },
  T14: {
    strategy: tr(
      'A self-service car wash runs by itself: customers pay at the machine. Choose a busy road, keep it clean and working, and add a vacuum or a second bay once the first is full.',
      'Eine SB-Autowaschanlage läuft von selbst: Kunden zahlen am Automaten. Wähle eine belebte Straße, halte sie sauber und funktionsfähig und ergänze Staubsauger oder eine zweite Box, wenn die erste voll ist.',
    ),
    tip: tr(
      'Do: check the water and waste rules. Don’t: forget that a sunny weekend is worth more than a rainy week.',
      'Tu: Prüfe die Wasser- und Abwasserregeln. Lass: zu vergessen, dass ein sonniges Wochenende mehr wert ist als eine Regenwoche.',
    ),
    links: [link('Wikipedia – Autowäsche', 'https://de.wikipedia.org/wiki/Autow%C3%A4sche')],
    actions: BUSINESS_CHECKS,
  },
  T15: {
    strategy: tr(
      'Panels on a big roof sell power to the grid at a fixed rate for twenty years, or save the firm its own power bill. Check the roof, the contract and the inverter, and take the payout as a steady income.',
      'Module auf einem großen Dach verkaufen Strom zu festem Satz an das Netz, zwanzig Jahre lang, oder sparen der Firma die eigene Stromrechnung. Prüfe Dach, Vertrag und Wechselrichter und nimm die Auszahlung als stetiges Einkommen.',
    ),
    tip: tr(
      'Do: calculate the cost of an inverter after ten to fifteen years. Don’t: forget the roof’s repair - panels sit on it for decades.',
      'Tu: Rechne mit den Kosten eines Wechselrichters nach zehn bis fünfzehn Jahren. Lass: die Reparatur des Dachs zu vergessen - die Module liegen jahrzehntelang darauf.',
    ),
    links: [
      link('Wikipedia – Photovoltaikanlage', 'https://de.wikipedia.org/wiki/Photovoltaikanlage'),
      link(
        'Wikipedia – Erneuerbare-Energien-Gesetz',
        'https://de.wikipedia.org/wiki/Erneuerbare-Energien-Gesetz',
      ),
    ],
    actions: BUSINESS_CHECKS,
  },
  T16: {
    strategy: tr(
      'Tiny houses on a plot are rented by the night: the income is high in the season and low outside it. Price by the season, keep reviews high, and plan the permits before you buy the land.',
      'Tiny Houses auf einem Grundstück werden nächteweise vermietet: Das Einkommen ist in der Saison hoch und außerhalb niedrig. Preise nach Saison, halte die Bewertungen hoch und kläre die Genehmigungen, bevor du das Land kaufst.',
    ),
    risks: tr(
      'Risk 4 of 5: permits, seasonality and bad reviews can ruin a year.',
      'Risiko 4 von 5: Genehmigungen, Saisonalität und schlechte Bewertungen können ein Jahr ruinieren.',
    ),
    tip: tr(
      'Do: ask the authority first. Don’t: build before you have the permit in writing.',
      'Tu: Frag zuerst die Behörde. Lass: zu bauen, bevor du die Genehmigung schriftlich hast.',
    ),
    links: [link('Wikipedia – Glamping', 'https://de.wikipedia.org/wiki/Glamping')],
    actions: BUSINESS_CHECKS,
  },
  T17: {
    strategy: tr(
      'Twenty firms that have paid dividends for years, in different sectors, give you a payout every quarter and little dependence on one of them. Reinvest in the cheap ones, sell a firm that cuts its dividend for a bad reason.',
      'Zwanzig Firmen, die seit Jahren Dividende zahlen, aus verschiedenen Branchen, geben dir jedes Quartal eine Ausschüttung und wenig Abhängigkeit von einer einzelnen. Lege in den günstigen nach, verkaufe eine Firma, die die Dividende aus schlechtem Grund kürzt.',
    ),
    tip: tr(
      'Do: look at the payout in relation to the profit. Don’t: buy the highest yields only.',
      'Tu: Sieh die Ausschüttung im Verhältnis zum Gewinn. Lass: nur die höchsten Renditen zu kaufen.',
    ),
    links: [
      link('Wikipedia – Dividendenrendite', 'https://de.wikipedia.org/wiki/Dividendenrendite'),
    ],
    actions: POSITION_CHECKS,
  },
  T18: {
    strategy: tr(
      'Put a big sum into a broad world fund and do nothing for years. If you can, invest in two or three steps over a year. The fund does the work; your job is not to sell in a crash.',
      'Lege eine große Summe in einen breiten Welt-Fonds und tu jahrelang nichts. Wenn du kannst, lege in zwei, drei Schritten über ein Jahr an. Der Fonds arbeitet; deine Aufgabe ist, im Crash nicht zu verkaufen.',
    ),
    tip: tr(
      'Do: keep a cash reserve outside the fund. Don’t: look at the price every day.',
      'Tu: Halte eine Barreserve außerhalb des Fonds. Lass: jeden Tag auf den Kurs zu sehen.',
    ),
    links: [
      link('justETF', 'https://www.justetf.com/de/'),
      link('Wikipedia – MSCI World', 'https://de.wikipedia.org/wiki/MSCI_World'),
    ],
    actions: POSITION_CHECKS,
  },
  T19: {
    strategy: tr(
      'A big bet on one coin can multiply or halve. If you do it, do it in steps, keep the coins in your own wallet, and decide in advance how much of a rise you will take as profit.',
      'Eine große Wette auf einen Coin kann sich vervielfachen oder halbieren. Wenn du es tust, dann in Schritten, mit den Coins in einer eigenen Wallet, und lege vorher fest, wie viel eines Anstiegs du als Gewinn mitnimmst.',
    ),
    tip: tr(
      'Do: sell a part when the price doubles. Don’t: put in money you need within five years.',
      'Tu: Verkaufe einen Teil, wenn sich der Kurs verdoppelt. Lass: Geld einzusetzen, das du in fünf Jahren brauchst.',
    ),
    links: [link('Wikipedia – Bitcoin', 'https://de.wikipedia.org/wiki/Bitcoin')],
    actions: POSITION_CHECKS,
  },
  T20: {
    strategy: tr(
      'A kilo of gold is a big, quiet store of value. Buy from a trusted dealer, keep it insured and safe, and plan to hold it for many years. It pays no income, but it is an anchor when stocks fall.',
      'Ein Kilo Gold ist ein großer, ruhiger Wertspeicher. Kaufe beim vertrauenswürdigen Händler, bewahre es versichert und sicher auf und plane, es viele Jahre zu halten. Es zahlt kein Einkommen, ist aber ein Anker, wenn Aktien fallen.',
    ),
    tip: tr(
      'Do: insure it. Don’t: keep it all in one place at home.',
      'Tu: Versichere es. Lass: alles an einem Ort zu Hause aufzubewahren.',
    ),
    links: [link('Wikipedia – Goldbarren', 'https://de.wikipedia.org/wiki/Goldbarren')],
    actions: POSITION_CHECKS,
  },
  T21: {
    strategy: tr(
      'Bonds of several firms that end in different years give you interest every year and money back on a plan. Spread over many issuers, prefer good credit ratings, and reinvest what comes due.',
      'Anleihen mehrerer Firmen mit verschiedenen Laufzeiten geben dir jedes Jahr Zinsen und Geld zurück nach Plan. Verteile auf viele Emittenten, bevorzuge gute Bonität und lege Fälliges neu an.',
    ),
    tip: tr(
      'Do: keep each issuer small. Don’t: chase the highest coupon.',
      'Tu: Halte jeden Emittenten klein. Lass: dem höchsten Kupon nachzujagen.',
    ),
    links: [link('Wikipedia – Bonität', 'https://de.wikipedia.org/wiki/Bonit%C3%A4t')],
    actions: POSITION_CHECKS,
  },
  T22: {
    strategy: tr(
      'Shares of a firm that plans to go public: if the listing happens, the first price can be well above what you paid. Ask who sells them to you, whether the firm is registered, and whether you can sell at all before the listing.',
      'Anteile einer Firma, die an die Börse will: Klappt der Börsengang, kann der erste Kurs weit über deinem Kaufpreis liegen. Frag, wer sie dir verkauft, ob die Firma registriert ist und ob du vor dem Börsengang überhaupt verkaufen kannst.',
    ),
    risks: tr(
      'Risk 4 of 5: shares that are not listed have no price you can check. Ask for the prospectus and the register entry.',
      'Risiko 4 von 5: Nicht börsennotierte Anteile haben keinen Kurs, den du prüfen kannst. Verlange den Prospekt und den Registereintrag.',
    ),
    tip: tr(
      'Do: check the seller in the BaFin database. Don’t: decide on the phone.',
      'Tu: Prüfe den Verkäufer in der BaFin-Datenbank. Lass: am Telefon zu entscheiden.',
    ),
    links: [
      link(
        'Wikipedia – Initial Public Offering',
        'https://de.wikipedia.org/wiki/Initial_Public_Offering',
      ),
      link('BaFin – Verbraucher', 'https://www.bafin.de/'),
    ],
    actions: POSITION_CHECKS,
  },
  T23: {
    strategy: tr(
      'Buy a fixed holiday week in a resort and use it every year, or let others use it. Count the yearly fees and the real price at which you could sell, and compare with renting the same week.',
      'Kaufe eine feste Ferienwoche in einer Anlage und nutze sie jedes Jahr oder lass andere sie nutzen. Rechne die jährlichen Gebühren und den Preis, zu dem du wirklich verkaufen könntest, und vergleiche mit dem Mieten derselben Woche.',
    ),
    risks: tr(
      'Risk 3 of 5: yearly fees continue for life, and the resale market is thin. Ask what the week would sell for tomorrow.',
      'Risiko 3 von 5: Die jährlichen Gebühren laufen lebenslang, und der Wiederverkaufsmarkt ist dünn. Frag, wofür die Woche morgen verkäuflich wäre.',
    ),
    tip: tr(
      'Do: use the time you have to think about it. Don’t: sign on the day of the offer.',
      'Tu: Nutze die Zeit, die du zum Nachdenken hast. Lass: am Tag des Angebots zu unterschreiben.',
    ),
    links: [link('Wikipedia – Timesharing', 'https://de.wikipedia.org/wiki/Timesharing')],
    actions: POSITION_CHECKS,
  },
  T24: {
    strategy: tr(
      'A classic car in good, original condition can gain value. Buy a model collectors like, with its papers and history, and keep it dry and insured. It costs money while you hold it - count that before you count the gain.',
      'Ein Oldtimer in gutem, originalem Zustand kann an Wert gewinnen. Kaufe ein Modell, das Sammler mögen, mit Papieren und Historie, und halte es trocken und versichert. Er kostet Geld, solange du ihn hältst - rechne das, bevor du den Gewinn rechnest.',
    ),
    tip: tr(
      'Do: have it checked by an expert before you buy. Don’t: buy a project car and call it an investment.',
      'Tu: Lass ihn vor dem Kauf von einem Gutachter prüfen. Lass: ein Bastelauto zu kaufen und es Geldanlage zu nennen.',
    ),
    links: [link('Wikipedia – Oldtimer', 'https://de.wikipedia.org/wiki/Oldtimer')],
    actions: POSITION_CHECKS,
  },
  T25: {
    strategy: tr(
      'A painting by a young artist can rise if the artist breaks through - and is worth little if not. Buy from a gallery with a certificate, choose what you like to look at, and plan to wait many years.',
      'Ein Gemälde eines jungen Künstlers kann steigen, wenn der Künstler durchstartet - und ist wenig wert, wenn nicht. Kaufe in einer Galerie mit Zertifikat, wähle, was du gern ansiehst, und plane viele Jahre Wartezeit.',
    ),
    tip: tr(
      'Do: keep the certificate and the invoice. Don’t: pay for a name that nobody knows yet as if it were famous.',
      'Tu: Bewahre Zertifikat und Rechnung auf. Lass: für einen Namen, den noch keiner kennt, zu zahlen, als wäre er berühmt.',
    ),
    links: [link('Wikipedia – Kunstmarkt', 'https://de.wikipedia.org/wiki/Kunstmarkt')],
    actions: POSITION_CHECKS,
  },
  T26: {
    strategy: tr(
      'A fund that buys into private firms: you may get a higher return, but your money is locked for years and the fees are high. Put in only what you will not need, and read what you will pay in total.',
      'Ein Fonds, der in nicht börsennotierte Firmen investiert: Du bekommst vielleicht mehr Rendite, doch dein Geld ist Jahre gebunden und die Gebühren sind hoch. Setze nur ein, was du nicht brauchst, und lies, was du insgesamt zahlst.',
    ),
    tip: tr(
      'Do: ask what you can get out and when. Don’t: judge it by the target return in the brochure.',
      'Tu: Frag, was du wann herausbekommst. Lass: es nach der Zielrendite im Prospekt zu beurteilen.',
    ),
    links: [link('Wikipedia – Private Equity', 'https://de.wikipedia.org/wiki/Private_Equity')],
    actions: POSITION_CHECKS,
  },
  T27: {
    strategy: tr(
      'Farmland pays a lease and moves slowly. Buy where farmers want to lease, check the rules for who may buy, and see it as a long-term store of value with a small yearly income.',
      'Ackerland zahlt Pacht und bewegt sich langsam. Kaufe dort, wo Landwirte pachten wollen, prüfe die Regeln, wer kaufen darf, und sieh es als langfristigen Wertspeicher mit kleinem Jahreseinkommen.',
    ),
    tip: tr(
      'Do: ask a local farmer what the land leases for. Don’t: forget that a sale can need approval.',
      'Tu: Frag einen örtlichen Landwirt, wofür das Land verpachtet wird. Lass: zu vergessen, dass ein Verkauf eine Genehmigung brauchen kann.',
    ),
    links: [link('Wikipedia – Ackerland', 'https://de.wikipedia.org/wiki/Ackerland')],
    actions: POSITION_CHECKS,
  },
  T28: {
    strategy: tr(
      'Buy a share of machines that mine coins and receive a payout every day. Ask where the machines are, who owns them, and whether you can see them work; start with a small test amount.',
      'Kaufe einen Anteil an Maschinen, die Coins schürfen, und erhalte jeden Tag eine Auszahlung. Frag, wo die Maschinen stehen, wem sie gehören und ob du sie arbeiten sehen kannst; starte mit einem kleinen Testbetrag.',
    ),
    risks: tr(
      'Risk 4 of 5: payouts depend on the coin price and the cost of power - and a firm that pays too much may pay you from new deposits.',
      'Risiko 4 von 5: Auszahlungen hängen vom Coin-Preis und den Stromkosten ab - und eine Firma, die zu viel zahlt, zahlt dich womöglich aus neuen Einlagen.',
    ),
    tip: tr(
      'Do: check the firm in the commercial register. Don’t: reinvest the payouts again and again.',
      'Tu: Prüfe die Firma im Handelsregister. Lass: die Auszahlungen immer wieder neu anzulegen.',
    ),
    cashflowMinor: 90000,
    links: [
      link('Wikipedia – Schneeballsystem', 'https://de.wikipedia.org/wiki/Schneeballsystem'),
      link('Wikipedia – Kryptowährung', 'https://de.wikipedia.org/wiki/Kryptow%C3%A4hrung'),
    ],
    actions: POSITION_CHECKS,
  },
  T29: {
    strategy: tr(
      'You have one machine that works: copy it. Add machines at the places with the best sales, hire someone for restocking, and keep a map of every machine’s income to move or close the weak ones.',
      'Du hast eine Maschine, die läuft: kopiere sie. Stelle weitere an den Orten mit den besten Umsätzen auf, stelle jemanden zum Nachfüllen ein und führe eine Karte mit dem Ertrag jeder Maschine, um schwache zu verschieben oder zu schließen.',
    ),
    tip: tr(
      'Do: put every location contract in writing. Don’t: add machines faster than you can restock them.',
      'Tu: Halte jeden Standortvertrag schriftlich fest. Lass: schneller Maschinen aufzustellen, als du nachfüllen kannst.',
    ),
    links: [link('Wikipedia – Verkaufsautomat', 'https://de.wikipedia.org/wiki/Verkaufsautomat')],
    actions: BUSINESS_CHECKS,
  },
  T30: {
    strategy: tr(
      'You buy a café you know: run it yourself first, learn the numbers, then hire a manager and open a second location only when the first earns on its own. Margins are thin, so the rent and the staff decide.',
      'Du kaufst ein Café, das du kennst: Führe es zuerst selbst, lerne die Zahlen, stelle dann einen Leiter ein und eröffne einen zweiten Standort erst, wenn der erste von allein verdient. Die Margen sind dünn, Miete und Personal entscheiden.',
    ),
    tip: tr(
      'Do: calculate with the rent as it will be after the first contract. Don’t: open a second place before the first one runs without you.',
      'Tu: Rechne mit der Miete, wie sie nach dem ersten Vertrag sein wird. Lass: einen zweiten Ort zu eröffnen, bevor der erste ohne dich läuft.',
    ),
    links: [
      link(
        'Wikipedia – Unternehmensnachfolge',
        'https://de.wikipedia.org/wiki/Unternehmensnachfolge',
      ),
    ],
    actions: BUSINESS_CHECKS,
  },
};
