import { act, link, tr, type CardEnrichment } from './cashflow-enrich-kit';

/** The Sapling pile (P01-P32): bigger sums, first businesses and properties - where the cash flow starts to count. */
export const SAPLING_ENRICH: Record<string, CardEnrichment> = {
  P01: {
    strategy: tr(
      'Prepare with facts: what the market pays for your job, what you added in the last year, and the one number you ask for. Ask in a calm moment, after a success, and offer a trade-off if the money is not there (days off, training).',
      'Bereite dich mit Fakten vor: was der Markt für deinen Job zahlt, was du im letzten Jahr beigetragen hast und die eine Zahl, die du forderst. Frag in einem ruhigen Moment, nach einem Erfolg, und biete einen Tausch an, wenn das Geld fehlt (freie Tage, Weiterbildung).',
    ),
    tip: tr(
      'Do: name a number, not a range. Don’t: threaten to quit if you are not ready to do it.',
      'Tu: Nenne eine Zahl, keine Spanne. Lass: mit Kündigung zu drohen, wenn du nicht bereit bist, sie zu tun.',
    ),
    links: [
      link('Wikipedia – Gehaltsverhandlung', 'https://de.wikipedia.org/wiki/Gehaltsverhandlung'),
    ],
    actions: [
      act(
        'Write down three results of the last year with a number each',
        'Schreibe drei Ergebnisse des letzten Jahres mit je einer Zahl auf',
        'high',
      ),
    ],
  },
  P02: {
    strategy: tr(
      'A lump sum goes in at one price: split it into a few parts over months if the market is high, or invest it at once if you can wait ten years. Then leave it - the fund does the work.',
      'Eine Einmalanlage geht zu einem Kurs hinein: Teile sie bei hohem Markt auf einige Monate auf, oder lege sie auf einmal an, wenn du zehn Jahre warten kannst. Dann lass sie liegen - der Fonds arbeitet.',
    ),
    tip: tr(
      'Do: keep an emergency reserve outside. Don’t: put in money you need within five years.',
      'Tu: Halte eine Notreserve außerhalb. Lass: Geld anzulegen, das du in fünf Jahren brauchst.',
    ),
    links: [
      link('Wikipedia – Cost-Average-Effekt', 'https://de.wikipedia.org/wiki/Cost-Average-Effekt'),
      link('justETF', 'https://www.justetf.com/de/'),
    ],
  },
  P03: {
    strategy: tr(
      'Add emerging markets as a small part of your funds: more growth, more swings, and risks of politics and currency. Keep it to a share you can see fall by a third.',
      'Nimm Schwellenländer als kleinen Teil deiner Fonds: mehr Wachstum, mehr Schwankung und Risiken aus Politik und Währung. Halte es bei einem Anteil, dessen Rückgang um ein Drittel du aushältst.',
    ),
    tip: tr(
      'Do: combine it with a world fund. Don’t: make it your only investment.',
      'Tu: Kombiniere es mit einem Welt-Fonds. Lass: es zu deiner einzigen Anlage zu machen.',
    ),
    links: [
      link(
        'Wikipedia – MSCI Emerging Markets',
        'https://de.wikipedia.org/wiki/MSCI_Emerging_Markets_Index',
      ),
      link('justETF', 'https://www.justetf.com/de/'),
    ],
  },
  P04: {
    strategy: tr(
      'A real-estate fund gives you a share of many rented buildings and pays most of the rent as dividends. It is property without a landlord’s work, but it moves with interest rates like a share.',
      'Ein Immobilienfonds gibt dir einen Anteil an vielen vermieteten Gebäuden und zahlt den größten Teil der Miete als Dividende. Es ist Immobilie ohne Vermieterarbeit, bewegt sich aber mit den Zinsen wie eine Aktie.',
    ),
    risks: tr(
      'Risk 3 of 5: when interest rates rise, prices fall; empty offices cut the rents.',
      'Risiko 3 von 5: Steigen die Zinsen, fallen die Kurse; leere Büros kürzen die Mieten.',
    ),
    tip: tr(
      'Do: look at how much of the fund is offices. Don’t: buy it for the payout alone.',
      'Tu: Sieh nach, wie viel des Fonds Büros sind. Lass: ihn nur wegen der Ausschüttung zu kaufen.',
    ),
    links: [link('Wikipedia – REIT', 'https://de.wikipedia.org/wiki/Real_Estate_Investment_Trust')],
  },
  P05: {
    strategy: tr(
      'A covered-call fund sells the upside of shares for a monthly payout. You get a high cash flow in calm and rising markets and give up the big gains. Treat the payout as income and the price as a slow drifter.',
      'Ein Covered-Call-Fonds verkauft die Chancen der Aktien gegen eine monatliche Ausschüttung. Du bekommst viel Cashflow in ruhigen und steigenden Märkten und gibst die großen Gewinne ab. Sieh die Ausschüttung als Einkommen und den Kurs als langsamen Treiber.',
    ),
    risks: tr(
      'Risk 3 of 5: in a crash you take the full fall but keep little of the rebound; the payout can shrink.',
      'Risiko 3 von 5: Im Crash trägst du den vollen Rückgang, bekommst aber wenig vom Aufschwung mit; die Ausschüttung kann schrumpfen.',
    ),
    tip: tr(
      'Do: read how the payout is made. Don’t: call it "interest" - it is part of your own money back.',
      'Tu: Lies, wie die Ausschüttung entsteht. Lass: sie "Zinsen" zu nennen - ein Teil ist dein eigenes Geld zurück.',
    ),
    links: [link('Wikipedia – Covered Call', 'https://de.wikipedia.org/wiki/Covered_Call')],
  },
  P06: {
    strategy: tr(
      'A clean-energy firm lives on subsidies and prices of power: buy a small piece, expect big swings, and sell a part when the price doubles to take your risk off the table.',
      'Ein Ökostrom-Unternehmen lebt von Förderung und Strompreisen: Kaufe ein kleines Stück, erwarte große Schwankungen und verkaufe einen Teil, wenn sich der Kurs verdoppelt, um das Risiko vom Tisch zu nehmen.',
    ),
    tip: tr(
      'Do: follow the news on subsidies. Don’t: buy more just because the price fell.',
      'Tu: Verfolge die Nachrichten zur Förderung. Lass: nachzukaufen, nur weil der Kurs gefallen ist.',
    ),
    links: [
      link(
        'Wikipedia – Erneuerbare-Energien-Gesetz',
        'https://de.wikipedia.org/wiki/Erneuerbare-Energien-Gesetz',
      ),
    ],
  },
  P07: {
    strategy: tr(
      'A hot stock at its all-time high is priced for perfection. If you buy, buy a small part, and decide in advance at which price you sell if it turns.',
      'Eine heiße Aktie auf Rekordhoch ist auf Perfektion bepreist. Wenn du kaufst, kaufe einen kleinen Teil und lege vorher fest, bei welchem Kurs du verkaufst, wenn es dreht.',
    ),
    risks: tr(
      'Risk 4 of 5: the price counts on years of success; one bad quarter can take a third off.',
      'Risiko 4 von 5: Der Kurs rechnet mit Jahren des Erfolgs; ein schlechtes Quartal kann ein Drittel kosten.',
    ),
    tip: tr(
      'Do: set the price at which you sell first. Don’t: buy because everybody is talking about it.',
      'Tu: Lege zuerst den Verkaufskurs fest. Lass: zu kaufen, weil alle darüber reden.',
    ),
    links: [link('Finanztip – Aktien', 'https://www.finanztip.de/aktien/')],
  },
  P08: {
    strategy: tr(
      'A basket of small coins spreads one bet over many, but they usually fall together. Keep it small, take profit in steps when it rises, and expect some of the coins to go to zero.',
      'Ein Korb kleiner Coins verteilt eine Wette auf viele, doch sie fallen meist gemeinsam. Halte ihn klein, nimm Gewinne in Schritten mit, wenn er steigt, und rechne damit, dass einige Coins auf null gehen.',
    ),
    tip: tr(
      'Do: sell a part when the price doubles. Don’t: use money you need for rent.',
      'Tu: Verkaufe einen Teil, wenn sich der Kurs verdoppelt. Lass: Geld zu verwenden, das du für die Miete brauchst.',
    ),
    links: [link('Wikipedia – Kryptowährung', 'https://de.wikipedia.org/wiki/Kryptow%C3%A4hrung')],
  },
  P09: {
    strategy: tr(
      'Put coins into a pool and receive a high yearly rate paid in the pool’s own token. Start with a small test amount, take your payout out every time, and check whether the code was audited.',
      'Lege Coins in einen Pool und erhalte einen hohen Jahreszins, gezahlt im eigenen Token des Pools. Starte mit einem kleinen Testbetrag, nimm die Auszahlung jedes Mal mit und prüfe, ob der Code geprüft wurde.',
    ),
    risks: tr(
      'Risk 4 of 5: a rate far above the market is paid out of new deposits or a token that can lose its value. Ask where the yield comes from.',
      'Risiko 4 von 5: Ein Zins weit über dem Markt wird aus neuen Einlagen oder einem Token bezahlt, der seinen Wert verlieren kann. Frag, woher die Rendite kommt.',
    ),
    tip: tr(
      'Do: ask who can change the rules of the pool. Don’t: put in more because the first payouts came.',
      'Tu: Frag, wer die Regeln des Pools ändern kann. Lass: mehr einzuzahlen, weil die ersten Auszahlungen kamen.',
    ),
    cashflowMinor: 10000,
    links: [
      link('Wikipedia – Schneeballsystem', 'https://de.wikipedia.org/wiki/Schneeballsystem'),
      link('Wikipedia – Kryptowährung', 'https://de.wikipedia.org/wiki/Kryptow%C3%A4hrung'),
    ],
  },
  P10: {
    strategy: tr(
      'A ticket in a young firm through crowdfunding: spread small amounts over several firms, expect most to fail and a few to pay, and plan to wait many years without being able to sell.',
      'Ein Anteil an einer jungen Firma über Crowdfunding: Verteile kleine Beträge auf mehrere Firmen, rechne damit, dass die meisten scheitern und wenige zahlen, und plane, viele Jahre nicht verkaufen zu können.',
    ),
    risks: tr(
      'Risk 5 of 5: total loss is the usual outcome of a startup; your money is locked and the shares are hard to sell.',
      'Risiko 5 von 5: Totalverlust ist das übliche Ergebnis eines Start-ups; dein Geld ist gebunden und die Anteile sind schwer verkäuflich.',
    ),
    tip: tr(
      'Do: put in only what you could lose entirely. Don’t: expect a payout within five years.',
      'Tu: Setze nur ein, was du ganz verlieren könntest. Lass: eine Auszahlung innerhalb von fünf Jahren zu erwarten.',
    ),
    links: [
      link('Wikipedia – Crowdinvesting', 'https://de.wikipedia.org/wiki/Crowdinvesting'),
      link('Wikipedia – Business Angel', 'https://de.wikipedia.org/wiki/Business_Angel'),
    ],
  },
  P11: {
    strategy: tr(
      'Lend small amounts to many borrowers instead of a lot to one, choose the safer loans for the bulk, and reinvest the interest. Expect some loans to default and count the net result, not the advertised rate.',
      'Verleihe kleine Beträge an viele Kreditnehmer statt viel an einen, wähle für den größten Teil die sichereren Kredite und lege die Zinsen wieder an. Rechne damit, dass einzelne Kredite ausfallen, und zähle das Netto-Ergebnis, nicht den beworbenen Zins.',
    ),
    risks: tr(
      'Risk 4 of 5: borrowers fail, and a platform can close; you cannot always get out when you want.',
      'Risiko 4 von 5: Kreditnehmer fallen aus, und eine Plattform kann schließen; du kommst nicht immer heraus, wann du willst.',
    ),
    tip: tr(
      'Do: spread over at least 50 loans. Don’t: lend to one borrower because the rate looks good.',
      'Tu: Verteile auf mindestens 50 Kredite. Lass: an einen Kreditnehmer zu verleihen, weil der Zins gut aussieht.',
    ),
    links: [
      link('Wikipedia – Crowdlending', 'https://de.wikipedia.org/wiki/Crowdlending'),
      link(
        'Wikipedia – Diversifikation',
        'https://de.wikipedia.org/wiki/Diversifikation_(Finanzwirtschaft)',
      ),
    ],
  },
  P12: {
    strategy: tr(
      'A small gold bar is a quiet store of value. Buy from a known dealer with the bar’s papers, keep it at home in a safe or in a box, and hold it for years - it pays nothing while you wait.',
      'Ein kleiner Goldbarren ist ein ruhiger Wertspeicher. Kaufe bei einem bekannten Händler mit den Papieren des Barrens, bewahre ihn zu Hause im Safe oder in einer Box auf und halte ihn Jahre - er zahlt nichts, solange du wartest.',
    ),
    tip: tr(
      'Do: keep the papers with the bar. Don’t: buy on credit.',
      'Tu: Behalte die Papiere beim Barren. Lass: auf Kredit zu kaufen.',
    ),
    links: [
      link('Wikipedia – Goldbarren', 'https://de.wikipedia.org/wiki/Goldbarren'),
      link('Wikipedia – Goldpreis', 'https://de.wikipedia.org/wiki/Goldpreis'),
    ],
  },
  P13: {
    strategy: tr(
      'Fine wine from known estates can gain value with age. Buy original cases from a merchant, keep them cool and dark with the papers, and sell when the wine is ready to drink. It pays nothing in between.',
      'Feiner Wein bekannter Güter kann mit dem Alter an Wert gewinnen. Kaufe Originalkisten beim Händler, lagere sie kühl und dunkel mit den Papieren und verkaufe, wenn der Wein trinkreif ist. Dazwischen zahlt er nichts.',
    ),
    tip: tr(
      'Do: store it properly - a warm cellar ruins the value. Don’t: buy bottles without a clear history.',
      'Tu: Lagere ihn richtig - ein warmer Keller ruiniert den Wert. Lass: Flaschen ohne klare Herkunft zu kaufen.',
    ),
    links: [link('Wikipedia – Wein', 'https://de.wikipedia.org/wiki/Wein')],
  },
  P14: {
    strategy: tr(
      'Buy a watch of a maker whose pieces keep their value, with box and papers, at a fair price - not at the hype price. Sell to a dealer or collector when the model is hard to find.',
      'Kaufe eine Uhr eines Herstellers, dessen Stücke ihren Wert halten, mit Box und Papieren zu einem fairen Preis - nicht zum Hype-Preis. Verkaufe an Händler oder Sammler, wenn das Modell schwer zu finden ist.',
    ),
    risks: tr(
      'Risk 3 of 5: fakes, hype that fades, and high dealer fees when you sell.',
      'Risiko 3 von 5: Fälschungen, verfliegender Hype und hohe Händlergebühren beim Verkauf.',
    ),
    tip: tr(
      'Do: buy only with papers. Don’t: wear it every day if you want to resell.',
      'Tu: Kaufe nur mit Papieren. Lass: sie jeden Tag zu tragen, wenn du weiterverkaufen willst.',
    ),
    links: [link('Wikipedia – Armbanduhr', 'https://de.wikipedia.org/wiki/Armbanduhr')],
  },
  P15: {
    strategy: tr(
      'Choose a spot with a steady crowd (a school, a gym, a waiting room), ask the owner for a fixed rent, and restock on a plan. Your cash flow is the margin on each item times the sales, minus rent and trips.',
      'Wähle einen Standort mit stetigem Publikum (Schule, Fitnessstudio, Wartezimmer), frag den Eigentümer nach einer festen Miete und fülle nach Plan nach. Dein Cashflow ist die Marge pro Artikel mal Verkäufe, minus Miete und Wege.',
    ),
    tip: tr(
      'Do: count the people who pass by in a week first. Don’t: pay a high rent for a quiet corner.',
      'Tu: Zähle zuerst die Leute, die in einer Woche vorbeikommen. Lass: hohe Miete für eine ruhige Ecke zu zahlen.',
    ),
    links: [link('Wikipedia – Verkaufsautomat', 'https://de.wikipedia.org/wiki/Verkaufsautomat')],
  },
  P16: {
    strategy: tr(
      'Buy in a dense area where parking is short, rent to a neighbour on a long contract, and keep the costs low. A parking space is small, simple, and pays steadily - but sells to few buyers.',
      'Kaufe in einem dichten Viertel, wo Parkplätze knapp sind, vermiete an einen Nachbarn mit langem Vertrag und halte die Kosten niedrig. Ein Stellplatz ist klein, einfach und zahlt stetig - hat aber wenige Käufer.',
    ),
    tip: tr(
      'Do: check how many spaces are free in the street. Don’t: forget the costs of the owners’ association.',
      'Tu: Prüfe, wie viele Plätze in der Straße frei sind. Lass: die Kosten der Eigentümergemeinschaft zu vergessen.',
    ),
    links: [link('Wikipedia – Stellplatz', 'https://de.wikipedia.org/wiki/Stellplatz')],
  },
  P17: {
    strategy: tr(
      'Rent the room on a fixed contract to a tenant you have met, with a clear price including all costs. It pays from the first month and needs only a bit of time - but you share your home.',
      'Vermiete das Zimmer mit festem Vertrag an einen Mieter, den du kennengelernt hast, mit klarem Preis inklusive aller Kosten. Es zahlt vom ersten Monat an und braucht wenig Zeit - aber du teilst dein Zuhause.',
    ),
    tip: tr(
      'Do: check what your landlord or the rules say about sublets. Don’t: rent without a written contract.',
      'Tu: Kläre, was dein Vermieter oder die Regeln zu Untermiete sagen. Lass: ohne schriftlichen Vertrag zu vermieten.',
    ),
    links: [link('Wikipedia – Untermiete', 'https://de.wikipedia.org/wiki/Untermiete')],
  },
  P18: {
    strategy: tr(
      'Sell your analysis skill to a few firms on a day rate, and turn the best client into a monthly retainer. Keep a list of the questions you answered, so the next offer is faster to write.',
      'Verkaufe deine Analysefähigkeit an einige Firmen zum Tagessatz und mache den besten Kunden zu einem monatlichen Rahmenvertrag. Führe eine Liste der beantworteten Fragen, damit das nächste Angebot schneller geschrieben ist.',
    ),
    tip: tr(
      'Do: get half the money up front. Don’t: work for one client only - if it stops, the income stops.',
      'Tu: Lass dir die Hälfte vorab zahlen. Lass: nur für einen Kunden zu arbeiten - wenn er aufhört, hört das Einkommen auf.',
    ),
    links: [
      link('Wikipedia – Freiberufler', 'https://de.wikipedia.org/wiki/Freiberufler'),
      link('freelancermap', 'https://www.freelancermap.de/'),
    ],
  },
  P19: {
    strategy: tr(
      'Teach one narrow thing you do well, record it once, and sell it again and again. Test the idea with a short free lesson, and spend more on marketing than on a studio.',
      'Lehre eine enge Sache, die du gut kannst, nimm sie einmal auf und verkaufe sie immer wieder. Teste die Idee mit einer kurzen kostenlosen Lektion und gib mehr für Werbung als für ein Studio aus.',
    ),
    tip: tr(
      'Do: ask ten people if they would pay before you record. Don’t: spend months on the video first.',
      'Tu: Frag zehn Leute, ob sie zahlen würden, bevor du aufnimmst. Lass: zuerst Monate in das Video zu stecken.',
    ),
    links: [link('Wikipedia – E-Learning', 'https://de.wikipedia.org/wiki/E-Learning')],
  },
  P20: {
    strategy: tr(
      'Buy a small shop with real, checkable numbers: twelve months of sales, how the customers come, and who does the work. Pay a multiple of the yearly profit and keep a part of the price until the handover has gone well.',
      'Kaufe einen kleinen Shop mit echten, prüfbaren Zahlen: zwölf Monate Umsatz, woher die Kunden kommen und wer die Arbeit macht. Zahle ein Vielfaches des Jahresgewinns und halte einen Teil des Preises zurück, bis die Übergabe gelungen ist.',
    ),
    risks: tr(
      'Risk 3 of 5: the numbers may be polished, traffic may depend on one source, and a supplier can drop out.',
      'Risiko 3 von 5: Die Zahlen können geschönt sein, der Besucherstrom kann an einer Quelle hängen, und ein Lieferant kann ausfallen.',
    ),
    tip: tr(
      'Do: ask to see the bank statements, not only a sheet. Don’t: buy a shop that lives on one ad account.',
      'Tu: Lass dir die Kontoauszüge zeigen, nicht nur eine Tabelle. Lass: einen Shop zu kaufen, der von einem Werbekonto lebt.',
    ),
    links: [
      link('Wikipedia – Online-Shop', 'https://de.wikipedia.org/wiki/Online-Shop'),
      link(
        'Wikipedia – Unternehmensnachfolge',
        'https://de.wikipedia.org/wiki/Unternehmensnachfolge',
      ),
    ],
  },
  P21: {
    strategy: tr(
      'Build one small tool for one group of users, charge a monthly fee from the start, and fix what the first ten customers ask. A subscription that repeats is worth much more than a one-time sale.',
      'Baue ein kleines Werkzeug für eine Nutzergruppe, verlange von Anfang an eine Monatsgebühr und beseitige, was die ersten zehn Kunden fragen. Ein Abo, das sich wiederholt, ist viel mehr wert als ein einmaliger Verkauf.',
    ),
    tip: tr(
      'Do: sell it before you build all of it. Don’t: add features nobody asked for.',
      'Tu: Verkaufe es, bevor du alles gebaut hast. Lass: Funktionen einzubauen, nach denen keiner gefragt hat.',
    ),
    links: [
      link(
        'Wikipedia – Software as a Service',
        'https://de.wikipedia.org/wiki/Software_as_a_Service',
      ),
    ],
  },
  P22: {
    strategy: tr(
      'Pick a small menu you can make fast and well, work the places with the most hungry people (events, lunch, markets), and keep the costs for food low. Check the licences before your first day.',
      'Wähle eine kleine Karte, die du schnell und gut kochen kannst, bediene die Orte mit den meisten Hungrigen (Events, Mittag, Märkte) und halte die Warenkosten niedrig. Prüfe die Genehmigungen vor dem ersten Tag.',
    ),
    risks: tr(
      'Risk 4 of 5: a truck breaks down, weather and permits decide your days, and the hours are long.',
      'Risiko 4 von 5: Ein Wagen fällt aus, Wetter und Genehmigungen entscheiden über deine Tage, und die Arbeitszeiten sind lang.',
    ),
    tip: tr(
      'Do: have a check-up of the truck before you buy. Don’t: forget that you need a spot, not only a truck.',
      'Tu: Lass den Wagen vor dem Kauf prüfen. Lass: zu vergessen, dass du einen Stellplatz brauchst, nicht nur einen Wagen.',
    ),
    links: [link('Wikipedia – Imbisswagen', 'https://de.wikipedia.org/wiki/Imbisswagen')],
  },
  P23: {
    strategy: tr(
      'Rent the booth for weddings and parties at a fixed price, with a deposit, and grow by working with a few event planners. Keep the costs of prints low and travel in one trip.',
      'Vermiete die Fotobox für Hochzeiten und Feiern zum Festpreis, mit Kaution, und wachse durch Zusammenarbeit mit einigen Eventplanern. Halte die Druckkosten niedrig und fahre in einer Tour.',
    ),
    tip: tr(
      'Do: put your logo on every print. Don’t: rent it out without a deposit.',
      'Tu: Setze dein Logo auf jeden Abzug. Lass: ohne Kaution zu vermieten.',
    ),
    links: [link('Wikipedia – Fotoautomat', 'https://de.wikipedia.org/wiki/Fotoautomat')],
  },
  P24: {
    strategy: tr(
      'Place the bikes where tourists or commuters need them, price by the day, and keep a few for repairs. The fleet pays when most bikes are out most days - so choose the place carefully.',
      'Stelle die Räder dorthin, wo Touristen oder Pendler sie brauchen, verlange Tagespreise und halte einige für Reparaturen bereit. Die Flotte zahlt sich aus, wenn die meisten Räder an den meisten Tagen draußen sind - wähle den Ort sorgfältig.',
    ),
    tip: tr(
      'Do: insure the bikes. Don’t: buy too many before you know the demand.',
      'Tu: Versichere die Räder. Lass: zu viele zu kaufen, bevor du die Nachfrage kennst.',
    ),
    links: [link('Verbraucherzentrale', 'https://www.verbraucherzentrale.de/')],
  },
  P25: {
    strategy: tr(
      'A share of a local solar plant pays a share of the sold power for many years. Check the contract, the feed-in rate, and the exit rules, and take the yearly payout as steady income.',
      'Ein Anteil an einer örtlichen Solaranlage zahlt einen Teil des verkauften Stroms über viele Jahre. Prüfe den Vertrag, die Einspeisevergütung und die Ausstiegsregeln und nimm die jährliche Auszahlung als stetiges Einkommen.',
    ),
    tip: tr(
      'Do: ask how and when you can sell the share. Don’t: put in money you need back soon.',
      'Tu: Frag, wie und wann du den Anteil verkaufen kannst. Lass: Geld einzusetzen, das du bald zurückbrauchst.',
    ),
    links: [
      link(
        'Wikipedia – Energiegenossenschaft',
        'https://de.wikipedia.org/wiki/Energiegenossenschaft',
      ),
      link('Wikipedia – Photovoltaikanlage', 'https://de.wikipedia.org/wiki/Photovoltaikanlage'),
    ],
  },
  P26: {
    strategy: tr(
      'A car you rent out by the hour pays when it is booked often: choose a city with few cars, price below a taxi, and keep it clean. Count the insurance and the repairs before you count the profit.',
      'Ein Auto, das du stundenweise vermietest, zahlt, wenn es oft gebucht wird: Wähle eine Stadt mit wenigen Autos, preise unter dem Taxi und halte es sauber. Rechne Versicherung und Reparaturen, bevor du den Gewinn rechnest.',
    ),
    tip: tr(
      'Do: use a platform with insurance for the renter. Don’t: lend it to people you do not know.',
      'Tu: Nutze eine Plattform mit Versicherung für den Mieter. Lass: es an Leute zu verleihen, die du nicht kennst.',
    ),
    links: [link('Wikipedia – Carsharing', 'https://de.wikipedia.org/wiki/Carsharing')],
  },
  P27: {
    strategy: tr(
      'People store things in a box near where they live. Place it near flats with little space, price by the month, and keep the box dry. It pays in small steady amounts and needs almost no time.',
      'Menschen lagern Dinge in einer Box in der Nähe ihrer Wohnung. Stelle sie nahe Wohnungen mit wenig Platz auf, verlange Monatspreise und halte die Box trocken. Sie zahlt kleine, stetige Beträge und braucht fast keine Zeit.',
    ),
    tip: tr(
      'Do: write clear rules on what may be stored. Don’t: rent to anyone who wants to store fuel or food.',
      'Tu: Schreibe klare Regeln, was gelagert werden darf. Lass: an jemanden zu vermieten, der Kraftstoff oder Lebensmittel lagern will.',
    ),
    links: [link('Wikipedia – Self-Storage', 'https://de.wikipedia.org/wiki/Self-Storage')],
  },
  P28: {
    strategy: tr(
      'Put your loans together into one with a lower rate and a payment you can carry, then pay it off first. Use the saved interest to pay more each month - do not take new debt.',
      'Fasse deine Kredite zu einem mit niedrigerem Zins und einer tragbaren Rate zusammen und zahle ihn zuerst ab. Nutze die gesparten Zinsen, um jeden Monat mehr zu zahlen - nimm keine neuen Schulden auf.',
    ),
    tip: tr(
      'Do: compare the total cost, not only the monthly payment. Don’t: stretch it over so many years that you pay more in the end.',
      'Tu: Vergleiche die Gesamtkosten, nicht nur die Monatsrate. Lass: es über so viele Jahre zu strecken, dass du am Ende mehr zahlst.',
    ),
    links: [
      link('Wikipedia – Umschuldung', 'https://de.wikipedia.org/wiki/Umschuldung'),
      link('Wikipedia – Schuldnerberatung', 'https://de.wikipedia.org/wiki/Schuldnerberatung'),
    ],
  },
  P29: {
    strategy: tr(
      'Pick up the laundry at the door, wash it with a partner, and bring it back the next day. Start with a few streets, give a fixed price per bag, and grow when the route is full.',
      'Hole die Wäsche an der Tür ab, lass sie mit einem Partner waschen und bringe sie am nächsten Tag zurück. Starte in einigen Straßen, nimm einen Festpreis pro Sack und wachse, wenn die Route voll ist.',
    ),
    tip: tr(
      'Do: agree on a price with the laundry before you sell. Don’t: promise a day you cannot keep.',
      'Tu: Vereinbare den Preis mit der Wäscherei, bevor du verkaufst. Lass: einen Tag zu versprechen, den du nicht halten kannst.',
    ),
    links: [link('Wikipedia – Waschsalon', 'https://de.wikipedia.org/wiki/Waschsalon')],
  },
  P30: {
    strategy: tr(
      'Buy several bonds that end in different years: each year one comes due and the money can go into the next one. You get a steady interest and a plan for when you have your cash back.',
      'Kaufe mehrere Anleihen, die in verschiedenen Jahren enden: Jedes Jahr wird eine fällig und das Geld kann in die nächste gehen. Du bekommst stetige Zinsen und einen Plan, wann du dein Geld zurückhast.',
    ),
    tip: tr(
      'Do: choose issuers with a good credit rating. Don’t: reach for a high rate - it means higher risk.',
      'Tu: Wähle Emittenten mit guter Bonität. Lass: nach einem hohen Zins zu greifen - er bedeutet höheres Risiko.',
    ),
    links: [
      link('Wikipedia – Bonität', 'https://de.wikipedia.org/wiki/Bonit%C3%A4t'),
      link('Deutsche Finanzagentur', 'https://www.deutsche-finanzagentur.de/'),
    ],
  },
  P31: {
    strategy: tr(
      'A collection of rare cards is worth more together than apart if it is complete and in good condition. Buy a theme you know, keep a list with the condition of every card, and sell to a collector or a dealer.',
      'Eine Sammlung seltener Karten ist als Ganzes mehr wert als einzeln, wenn sie vollständig und in gutem Zustand ist. Kaufe ein Thema, das du kennst, führe eine Liste mit dem Zustand jeder Karte und verkaufe an einen Sammler oder Händler.',
    ),
    tip: tr(
      'Do: sleeve and store every card. Don’t: buy a "bargain" set without seeing the cards.',
      'Tu: Hülle und lagere jede Karte. Lass: ein "Schnäppchen"-Set zu kaufen, ohne die Karten zu sehen.',
    ),
    links: [
      link('Wikipedia – Sammelkartenspiel', 'https://de.wikipedia.org/wiki/Sammelkartenspiel'),
    ],
  },
  P32: {
    strategy: tr(
      'A course that promises to teach you to trade currencies for a living: ask to see the results of past students with proof, and try a free demo account before you pay anything.',
      'Ein Kurs, der verspricht, dir das Handeln mit Währungen als Beruf beizubringen: Lass dir Ergebnisse früherer Teilnehmer mit Nachweis zeigen und probiere ein kostenloses Demokonto, bevor du zahlst.',
    ),
    risks: tr(
      'Risk 3 of 5: most private traders lose money. Ask who earns from the course and who from your trades.',
      'Risiko 3 von 5: Die meisten privaten Händler verlieren Geld. Frag, wer am Kurs verdient und wer an deinen Trades.',
    ),
    tip: tr(
      'Do: read what regulators say about trading courses. Don’t: pay for secret methods or signal groups.',
      'Tu: Lies, was Aufsichtsbehörden zu Trading-Kursen sagen. Lass: für Geheimmethoden oder Signalgruppen zu zahlen.',
    ),
    links: [
      link('Wikipedia – Devisenhandel', 'https://de.wikipedia.org/wiki/Devisenhandel'),
      link('BaFin – Verbraucher', 'https://www.bafin.de/'),
    ],
  },
};
