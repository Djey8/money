import { act, link, tr, type CardEnrichment } from './cashflow-enrich-kit';

/** The Seed pile (S01-S36): small, cheap ways to start - they teach the habit that pays for the bigger cards later. */
export const SEED_ENRICH: Record<string, CardEnrichment> = {
  S01: {
    tip: tr(
      'Do: cancel the ones you forgot first - that money is free. Don’t: swap them for new ones you also barely use.',
      'Tu: Kündige zuerst die vergessenen - das Geld ist geschenkt. Lass: sie durch neue zu ersetzen, die du auch kaum nutzt.',
    ),
    links: [
      link(
        'Verbraucherzentrale – Verträge und Reklamation',
        'https://www.verbraucherzentrale.de/wissen/vertraege-reklamation',
      ),
    ],
    actions: [
      act(
        'Mark which subscriptions you really used in the last 30 days',
        'Markiere, welche Abos du in den letzten 30 Tagen wirklich genutzt hast',
      ),
    ],
  },
  S02: {
    tip: tr(
      'Do: compare every year and note the end of the contract. Don’t: take a first-year bonus without looking at the price in year two.',
      'Tu: Vergleiche jedes Jahr und notiere das Vertragsende. Lass: einen Neukundenbonus zu nehmen, ohne den Preis im zweiten Jahr anzusehen.',
    ),
    links: [
      link('Verivox – Stromvergleich', 'https://www.verivox.de/strom/'),
      link('CHECK24 – Stromvergleich', 'https://www.check24.de/strom/'),
    ],
  },
  S03: {
    strategy: tr(
      'Cook two or three dishes in bulk once a week, freeze portions, and fill the gaps with a short shopping list. Count it as a saving only if you really stop buying lunch out.',
      'Koche einmal pro Woche zwei, drei Gerichte auf Vorrat, friere Portionen ein und fülle Lücken mit einer kurzen Einkaufsliste. Es zählt nur als Ersparnis, wenn du wirklich kein Mittagessen mehr außer Haus kaufst.',
    ),
    tip: tr(
      'Do: start with the lunches you buy most often. Don’t: buy a lot of containers and gadgets before the habit sticks.',
      'Tu: Beginne mit den Mittagessen, die du am häufigsten kaufst. Lass: viele Boxen und Geräte zu kaufen, bevor die Gewohnheit sitzt.',
    ),
    links: [
      link('Deutsche Gesellschaft für Ernährung', 'https://www.dge.de/'),
      link('Verbraucherzentrale', 'https://www.verbraucherzentrale.de/'),
    ],
  },
  S04: {
    tip: tr(
      'Do: look at the real data use of the last three months before you choose. Don’t: sign a long contract for a phone you do not own yet.',
      'Tu: Sieh dir den echten Datenverbrauch der letzten drei Monate an, bevor du wählst. Lass: einen langen Vertrag für ein Handy, das du noch nicht hast.',
    ),
    links: [
      link('Verivox – Handytarife', 'https://www.verivox.de/handytarife/'),
      link('CHECK24 – Handytarife', 'https://www.check24.de/handytarife/'),
    ],
  },
  S05: {
    tip: tr(
      'Do: keep the old account open until every direct debit has moved. Don’t: pay for a "premium" account for insurances you already have.',
      'Tu: Lass das alte Konto offen, bis jede Lastschrift umgezogen ist. Lass: für ein "Premium"-Konto mit Versicherungen zu zahlen, die du schon hast.',
    ),
    links: [
      link('Finanztip – Girokonto', 'https://www.finanztip.de/girokonto/'),
      link('Deutsche Einlagensicherung', 'https://www.einlagensicherung.de/'),
    ],
  },
  S06: {
    tip: tr(
      'Do: ask HR, not your manager - it is a standard benefit in many firms. Don’t: forget it ends when the job does.',
      'Tu: Frag die Personalabteilung, nicht den Chef - in vielen Firmen ist es ein Standard-Benefit. Lass: zu vergessen, dass es mit dem Job endet.',
    ),
    links: [
      link('Wikipedia – Deutschlandticket', 'https://de.wikipedia.org/wiki/Deutschlandticket'),
    ],
  },
  S07: {
    strategy: tr(
      'Sort by value: sell the few things worth more than 30 on a classifieds site, give away or bin the rest. Photograph in daylight, write the size and the flaws, and answer fast.',
      'Sortiere nach Wert: Verkaufe die wenigen Dinge über 30 auf einer Kleinanzeigen-Seite, verschenke oder entsorge den Rest. Fotografiere bei Tageslicht, nenne Größe und Mängel und antworte schnell.',
    ),
    tip: tr(
      'Do: sell it in the first month, the price only falls. Don’t: send an item before the payment has arrived.',
      'Tu: Verkaufe im ersten Monat, der Preis sinkt nur. Lass: eine Ware zu verschicken, bevor das Geld da ist.',
    ),
    links: [
      link('Kleinanzeigen', 'https://www.kleinanzeigen.de/'),
      link('Wikipedia – Flohmarkt', 'https://de.wikipedia.org/wiki/Flohmarkt'),
    ],
  },
  S08: {
    strategy: tr(
      'Hang the panel where the sun shines most of the day, plug it into a socket with a registered meter set-up, and run the dishwasher or washing machine at noon so you use what it makes.',
      'Häng das Modul dorthin, wo die Sonne den größten Teil des Tages scheint, stecke es ein, melde es an und lass Spül- oder Waschmaschine mittags laufen, damit du nutzt, was es erzeugt.',
    ),
    tip: tr(
      'Do: register it in the Marktstammdatenregister. Don’t: choose a spot in the shade - the saving is gone.',
      'Tu: Melde es im Marktstammdatenregister an. Lass: einen Platz im Schatten zu wählen - dann ist die Ersparnis weg.',
    ),
    links: [
      link('Wikipedia – Balkonkraftwerk', 'https://de.wikipedia.org/wiki/Balkonkraftwerk'),
      link('Marktstammdatenregister', 'https://www.marktstammdatenregister.de/'),
    ],
  },
  S09: {
    strategy: tr(
      'Park the money you do not need for months here, within the deposit insurance, and move it when another bank pays clearly more. It is a place to wait, not a way to get rich.',
      'Parke hier das Geld, das du Monate nicht brauchst, im Rahmen der Einlagensicherung, und wechsle, wenn eine andere Bank deutlich mehr zahlt. Es ist ein Warteplatz, kein Weg zum Reichtum.',
    ),
    tip: tr(
      'Do: use the tax-free allowance for interest. Don’t: put money here that you want to invest for ten years - inflation eats it.',
      'Tu: Nutze den Sparerpauschbetrag für Zinsen. Lass: hier Geld zu parken, das du zehn Jahre anlegen willst - die Inflation frisst es.',
    ),
    links: [
      link('Finanztip – Tagesgeld', 'https://www.finanztip.de/tagesgeld/'),
      link('Deutsche Einlagensicherung', 'https://www.einlagensicherung.de/'),
    ],
  },
  S10: {
    strategy: tr(
      'Buy the whole world in one fund with low costs, every month the same amount, and do not look at the price. After a fall keep buying - the units are cheaper then.',
      'Kaufe die ganze Welt in einem günstigen Fonds, jeden Monat denselben Betrag, und sieh nicht auf den Kurs. Nach einem Rückgang kaufst du weiter - dann sind die Anteile billiger.',
    ),
    risks: tr(
      'Risk 2 of 5: the price can fall by a third in a crisis and take years to come back. The risk is selling in the fall, not owning.',
      'Risiko 2 von 5: Der Kurs kann in einer Krise um ein Drittel fallen und Jahre brauchen, um zurückzukommen. Das Risiko ist das Verkaufen im Absturz, nicht das Besitzen.',
    ),
    tip: tr(
      'Do: keep it for years and add every month. Don’t: sell in a crash because the news is loud.',
      'Tu: Behalte ihn Jahre und lege jeden Monat nach. Lass: im Crash zu verkaufen, weil die Nachrichten laut sind.',
    ),
    links: [
      link('justETF', 'https://www.justetf.com/de/'),
      link('Wikipedia – MSCI World', 'https://de.wikipedia.org/wiki/MSCI_World'),
      link('Finanztip – Indexfonds und ETF', 'https://www.finanztip.de/indexfonds-etf/'),
    ],
  },
  S11: {
    strategy: tr(
      'Use it as the quiet part of your money: bonds pay a fixed interest and fall less than shares. Hold them to the end or for a few years and do not expect growth.',
      'Nutze es als ruhigen Teil deines Geldes: Anleihen zahlen feste Zinsen und fallen weniger als Aktien. Halte sie bis zum Ende oder einige Jahre und erwarte kein Wachstum.',
    ),
    tip: tr(
      'Do: pick the maturity that fits when you need the money. Don’t: buy long bonds just before rates rise.',
      'Tu: Wähle die Laufzeit, die zu dem Zeitpunkt passt, an dem du das Geld brauchst. Lass: lange Anleihen kurz vor steigenden Zinsen zu kaufen.',
    ),
    links: [
      link('Wikipedia – Staatsanleihe', 'https://de.wikipedia.org/wiki/Staatsanleihe'),
      link('Deutsche Finanzagentur', 'https://www.deutsche-finanzagentur.de/'),
    ],
  },
  S12: {
    strategy: tr(
      'Choose a fund of firms with a long record of paying dividends, let the payouts come every year, and spend them - that is cash flow. A high dividend alone is no reason: look at what the firms earn.',
      'Wähle einen Fonds aus Firmen mit langer Dividendenhistorie, lass die Ausschüttungen jedes Jahr kommen und gib sie aus - das ist Cashflow. Eine hohe Dividende allein ist kein Grund: Sieh, was die Firmen verdienen.',
    ),
    tip: tr(
      'Do: compare the payout with the profit. Don’t: chase the highest yield - it often means the price already fell.',
      'Tu: Vergleiche die Ausschüttung mit dem Gewinn. Lass: der höchsten Rendite nachzujagen - oft ist der Kurs schon gefallen.',
    ),
    links: [
      link('Wikipedia – Dividende', 'https://de.wikipedia.org/wiki/Dividende'),
      link('Wikipedia – Dividendenrendite', 'https://de.wikipedia.org/wiki/Dividendenrendite'),
    ],
  },
  S13: {
    strategy: tr(
      'Buy a few units of one big firm you understand, as a part of a mix and not as the whole. Look at the payout and at what the firm earns before you buy, and again once a year.',
      'Kaufe einige Anteile einer großen Firma, die du verstehst, als Teil einer Mischung und nicht als Ganzes. Sieh dir Ausschüttung und Gewinn vor dem Kauf an und dann einmal im Jahr.',
    ),
    tip: tr(
      'Do: keep one share to a few percent of what you own. Don’t: bet on the one firm because you like its cars.',
      'Tu: Halte eine einzelne Aktie bei wenigen Prozent deines Vermögens. Lass: auf die eine Firma zu setzen, weil dir ihre Autos gefallen.',
    ),
    links: [
      link('Wikipedia – Aktie', 'https://de.wikipedia.org/wiki/Aktie'),
      link('Finanztip – Aktien', 'https://www.finanztip.de/aktien/'),
    ],
  },
  S14: {
    strategy: tr(
      'An insurer earns on premiums and on investing them: a steady payer in most years. Buy for the dividend, hold through quiet times, and expect a hit in a year of big disasters.',
      'Ein Versicherer verdient an Prämien und an deren Anlage: in den meisten Jahren ein verlässlicher Zahler. Kaufe für die Dividende, halte in ruhigen Zeiten und rechne in einem Katastrophenjahr mit einem Rückschlag.',
    ),
    tip: tr(
      'Do: watch the news for storms and floods - they hit the payout. Don’t: forget that a big loss can cut a dividend.',
      'Tu: Behalte Meldungen zu Stürmen und Fluten im Blick - sie treffen die Ausschüttung. Lass: zu vergessen, dass ein großer Schaden eine Dividende kürzen kann.',
    ),
    links: [link('GDV – Versicherer in Deutschland', 'https://www.gdv.de/')],
  },
  S15: {
    strategy: tr(
      'A telecom firm sells something people pay for every month, so the payouts are steady and the price moves slowly. Good for cash flow, not for quick profit.',
      'Eine Telekom-Firma verkauft etwas, das Menschen jeden Monat bezahlen: Die Ausschüttungen sind stetig, der Kurs bewegt sich langsam. Gut für Cashflow, nicht für schnellen Gewinn.',
    ),
    tip: tr(
      'Do: look at the debt of the firm. Don’t: expect big price gains - you are paid to wait.',
      'Tu: Sieh dir die Schulden der Firma an. Lass: große Kursgewinne zu erwarten - du wirst fürs Warten bezahlt.',
    ),
    links: [
      link('Wikipedia – Dividendenrendite', 'https://de.wikipedia.org/wiki/Dividendenrendite'),
    ],
  },
  S16: {
    strategy: tr(
      'A growth stock pays little or nothing now and bets on much more later. Buy only what you can leave alone for years, in small pieces, and expect big swings on the way.',
      'Eine Wachstumsaktie zahlt jetzt wenig oder nichts und setzt auf viel mehr später. Kaufe nur, was du Jahre liegen lassen kannst, in kleinen Stücken, und rechne unterwegs mit großen Schwankungen.',
    ),
    risks: tr(
      'Risk 4 of 5: a high price already counts on years of growth. If the numbers disappoint, the price can halve in weeks.',
      'Risiko 4 von 5: Ein hoher Kurs rechnet schon mit Jahren des Wachstums. Enttäuschen die Zahlen, kann sich der Kurs in Wochen halbieren.',
    ),
    tip: tr(
      'Do: look at the price in relation to the profit. Don’t: put in money you may need within five years.',
      'Tu: Sieh den Kurs im Verhältnis zum Gewinn. Lass: Geld einzusetzen, das du in fünf Jahren brauchen könntest.',
    ),
    links: [
      link(
        'Wikipedia – Kurs-Gewinn-Verhältnis',
        'https://de.wikipedia.org/wiki/Kurs-Gewinn-Verh%C3%A4ltnis',
      ),
      link('Finanztip – Aktien', 'https://www.finanztip.de/aktien/'),
    ],
  },
  S17: {
    strategy: tr(
      'A small mining firm with a licence for a lithium field: if the tests succeed, the price can multiply. Put in only what you can lose, and sell if the news stops.',
      'Eine kleine Bergbaufirma mit einer Lizenz für ein Lithiumfeld: Gelingen die Tests, kann sich der Kurs vervielfachen. Setze nur ein, was du verlieren kannst, und verkaufe, wenn die Nachrichten ausbleiben.',
    ),
    risks: tr(
      'Risk 4 of 5: a firm with no revenue lives on promises. Check who owns the shares and who pays for the tips.',
      'Risiko 4 von 5: Eine Firma ohne Umsatz lebt von Versprechen. Prüfe, wem die Anteile gehören und wer für die Tipps bezahlt.',
    ),
    tip: tr(
      'Do: ask who earns from your buying. Don’t: believe a tip that came to you without you asking.',
      'Tu: Frag, wer an deinem Kauf verdient. Lass: einem Tipp zu glauben, der ungefragt zu dir kam.',
    ),
    links: [
      link('Wikipedia – Penny Stock', 'https://de.wikipedia.org/wiki/Penny_Stock'),
      link('Wikipedia – Pump and Dump', 'https://de.wikipedia.org/wiki/Pump_and_Dump'),
      link('Investor.gov – Investor protection', 'https://www.investor.gov/'),
    ],
  },
  S18: {
    strategy: tr(
      'Buy a small slice with money you can lose, in steps and not all at once, and keep the coins in your own wallet if you plan to hold them for years. Decide in advance at what price you add and at what price you sell.',
      'Kaufe ein kleines Stück mit Geld, das du verlieren kannst, in Schritten und nicht auf einmal, und verwahre die Coins in einer eigenen Wallet, wenn du sie Jahre halten willst. Lege vorher fest, bei welchem Kurs du nachkaufst und bei welchem du verkaufst.',
    ),
    risks: tr(
      'Risk 4 of 5: the price can halve in months and has done so several times. It pays no cash flow: you only gain if someone pays more later.',
      'Risiko 4 von 5: Der Kurs kann sich in Monaten halbieren und hat das mehrfach getan. Er zahlt keinen Cashflow: Du gewinnst nur, wenn später jemand mehr zahlt.',
    ),
    tip: tr(
      'Do: write down your plan before you buy. Don’t: borrow money for coins.',
      'Tu: Schreibe deinen Plan vor dem Kauf auf. Lass: Geld für Coins zu leihen.',
    ),
    links: [
      link('Wikipedia – Bitcoin', 'https://de.wikipedia.org/wiki/Bitcoin'),
      link('Bitcoin whitepaper', 'https://bitcoin.org/bitcoin.pdf'),
    ],
  },
  S19: {
    strategy: tr(
      'Ether can be staked: you lock it and are paid a small yield, which makes it a cash flow in coins. Count what you get in euros at the day’s price, and know that the coins themselves swing a lot.',
      'Ether kann gestakt werden: Du sperrst es und bekommst eine kleine Rendite, also einen Cashflow in Coins. Rechne, was du bekommst, zum Tageskurs in Euro um, und wisse, dass die Coins selbst stark schwanken.',
    ),
    risks: tr(
      'Risk 4 of 5: the price swings, the staking rules can change, and a platform that stakes for you can fail.',
      'Risiko 4 von 5: Der Kurs schwankt, die Staking-Regeln können sich ändern, und eine Plattform, die für dich stakt, kann ausfallen.',
    ),
    tip: tr(
      'Do: stake only what you will not need soon. Don’t: leave the coins on an exchange you do not know.',
      'Tu: Stake nur, was du bald nicht brauchst. Lass: Coins auf einer Börse zu lassen, die du nicht kennst.',
    ),
    links: [
      link('ethereum.org – Staking', 'https://ethereum.org/de/staking/'),
      link('Wikipedia – Ethereum', 'https://de.wikipedia.org/wiki/Ethereum'),
    ],
  },
  S20: {
    strategy: tr(
      'A new token with a big community and a dog on the logo: some have multiplied, most are gone after a year. If you play, play with money you have already written off.',
      'Ein neuer Token mit großer Community und einem Hund im Logo: Manche haben sich vervielfacht, die meisten sind nach einem Jahr weg. Wenn du mitspielst, dann mit Geld, das du schon abgeschrieben hast.',
    ),
    risks: tr(
      'Risk 4 of 5: the price lives on the next buyer. Look at who holds most of the coins and whether you can sell at all.',
      'Risiko 4 von 5: Der Kurs lebt vom nächsten Käufer. Sieh nach, wem die meisten Coins gehören und ob du überhaupt verkaufen kannst.',
    ),
    tip: tr(
      'Do: try to sell a tiny amount first. Don’t: follow a price chart that only goes up.',
      'Tu: Versuche zuerst, einen winzigen Betrag zu verkaufen. Lass: einem Kurs zu folgen, der nur nach oben geht.',
    ),
    links: [
      link('Wikipedia – Kryptowährung', 'https://de.wikipedia.org/wiki/Kryptow%C3%A4hrung'),
      link('Wikipedia – Pump and Dump', 'https://de.wikipedia.org/wiki/Pump_and_Dump'),
    ],
  },
  S21: {
    strategy: tr(
      'Lend your coins to an app and collect a fixed interest every week. Start small, take the interest out as it comes, and do not bring friends in before you have been paid for a long time.',
      'Verleihe deine Coins an eine App und erhalte jede Woche feste Zinsen. Fange klein an, nimm die Zinsen mit, sobald sie kommen, und hol keine Freunde dazu, bevor du lange ausgezahlt wurdest.',
    ),
    risks: tr(
      'Risk 3 of 5: returns far above the market need a reason. Ask where the money comes from and who watches the firm.',
      'Risiko 3 von 5: Renditen weit über dem Markt brauchen einen Grund. Frag, woher das Geld kommt und wer die Firma beaufsichtigt.',
    ),
    tip: tr(
      'Do: ask what happens to your coins when you want them back. Don’t: let a bonus for bringing friends decide.',
      'Tu: Frag, was mit deinen Coins passiert, wenn du sie zurückwillst. Lass: einen Bonus fürs Werben von Freunden entscheiden.',
    ),
    cashflowMinor: 8000,
    links: [
      link('Wikipedia – Schneeballsystem', 'https://de.wikipedia.org/wiki/Schneeballsystem'),
      link('BaFin – Verbraucher', 'https://www.bafin.de/'),
    ],
  },
  S22: {
    strategy: tr(
      'Sealed boxes of a sought-after set can rise when the set goes out of print. Buy at the shop price at the release, store dry and dark, keep the box sealed, and sell to collectors when the set is gone.',
      'Versiegelte Boxen eines gefragten Sets können steigen, wenn das Set nicht mehr gedruckt wird. Kaufe zum Ladenpreis beim Erscheinen, lagere trocken und dunkel, lass die Box versiegelt und verkaufe an Sammler, wenn das Set ausverkauft ist.',
    ),
    tip: tr(
      'Do: buy from the shop at the release. Don’t: buy a "sealed" box from a stranger - it may have been opened and closed again.',
      'Tu: Kaufe im Laden zum Erscheinen. Lass: eine "versiegelte" Box von einem Fremden zu kaufen - sie kann geöffnet und wieder verschlossen worden sein.',
    ),
    links: [
      link('Wikipedia – Sammelkartenspiel', 'https://de.wikipedia.org/wiki/Sammelkartenspiel'),
      link('PSA – card grading', 'https://www.psacard.com/'),
    ],
  },
  S23: {
    strategy: tr(
      'A card that a grading firm has rated and sealed is easy to sell to collectors. Buy cards in high grades of players or characters people keep loving, and keep the grading case closed.',
      'Eine Karte, die ein Prüfunternehmen bewertet und eingeschweißt hat, lässt sich leicht an Sammler verkaufen. Kaufe Karten in hoher Note von Figuren, die Menschen weiter lieben, und lass die Hülle zu.',
    ),
    tip: tr(
      'Do: check the serial number of the grading case online. Don’t: pay a record price for a hype - prices can fall by half.',
      'Tu: Prüfe die Seriennummer der Hülle online. Lass: einen Rekordpreis für einen Hype zu zahlen - Preise können sich halbieren.',
    ),
    links: [link('PSA – card grading', 'https://www.psacard.com/')],
  },
  S24: {
    strategy: tr(
      'Silver coins are cheap to start and easy to split. Buy official bullion coins from a dealer, pay no more than a few percent over the metal price, and keep them dry.',
      'Silbermünzen sind billig im Einstieg und leicht zu teilen. Kaufe offizielle Anlagemünzen beim Händler, zahle nur wenige Prozent über dem Metallpreis und lagere sie trocken.',
    ),
    risks: tr(
      'Risk 3 of 5: silver swings more than gold, pays nothing while you hold it, and in Germany silver is taxed with VAT.',
      'Risiko 3 von 5: Silber schwankt stärker als Gold, zahlt nichts, solange du es hältst, und wird in Deutschland mit Mehrwertsteuer verkauft.',
    ),
    tip: tr(
      'Do: compare the dealer’s buy and sell price. Don’t: buy "collector" coins at a big premium.',
      'Tu: Vergleiche An- und Verkaufspreis des Händlers. Lass: "Sammlermünzen" mit großem Aufschlag zu kaufen.',
    ),
    links: [
      link('Wikipedia – Anlagemünze', 'https://de.wikipedia.org/wiki/Anlagem%C3%BCnze'),
      link('Wikipedia – Silber', 'https://de.wikipedia.org/wiki/Silber'),
    ],
  },
  S25: {
    strategy: tr(
      'A gold coin is a small store of value you can sell anywhere. Buy official bullion coins, pay as little as possible over the gold price, and keep them for years, not weeks.',
      'Eine Goldmünze ist ein kleiner Wertspeicher, den du überall verkaufen kannst. Kaufe offizielle Anlagemünzen, zahle so wenig wie möglich über dem Goldpreis und halte sie Jahre, nicht Wochen.',
    ),
    tip: tr(
      'Do: keep it as the quiet part of your money. Don’t: expect cash flow - gold pays nothing.',
      'Tu: Halte es als ruhigen Teil deines Geldes. Lass: Cashflow zu erwarten - Gold zahlt nichts.',
    ),
    links: [
      link('Wikipedia – Goldpreis', 'https://de.wikipedia.org/wiki/Goldpreis'),
      link('Wikipedia – Anlagemünze', 'https://de.wikipedia.org/wiki/Anlagem%C3%BCnze'),
    ],
  },
  S26: {
    strategy: tr(
      'Sets that the maker retires can rise in value: buy a sealed set shortly before it is retired, store it dry and flat, and sell to collectors after a few years.',
      'Sets, die der Hersteller aus dem Programm nimmt, können im Wert steigen: Kaufe ein versiegeltes Set kurz vor dem Auslaufen, lagere es trocken und flach und verkaufe nach einigen Jahren an Sammler.',
    ),
    tip: tr(
      'Do: pick big, popular themes. Don’t: buy a set that was made in huge numbers.',
      'Tu: Wähle große, beliebte Themen. Lass: ein Set zu kaufen, das in riesiger Stückzahl gebaut wurde.',
    ),
    links: [
      link('Wikipedia – Lego', 'https://de.wikipedia.org/wiki/Lego'),
      link('BrickEconomy', 'https://www.brickeconomy.com/'),
    ],
  },
  S27: {
    strategy: tr(
      'A limited drop can sell for a multiple on the day if you get it at the shop price. Buy only what you can sell fast, in a common size, and sell in the first weeks while the hype lasts.',
      'Ein limitierter Drop kann am Tag ein Vielfaches bringen, wenn du ihn zum Ladenpreis bekommst. Kaufe nur, was du schnell verkaufen kannst, in einer gängigen Größe, und verkaufe in den ersten Wochen, solange der Hype hält.',
    ),
    risks: tr(
      'Risk 3 of 5: the hype fades fast, fakes are common, and a pair that has been worn is worth little.',
      'Risiko 3 von 5: Der Hype verfliegt schnell, Fälschungen sind häufig, und getragene Schuhe sind wenig wert.',
    ),
    tip: tr(
      'Do: keep the box and the receipt. Don’t: wait for a price that never comes.',
      'Tu: Behalte Karton und Beleg. Lass: auf einen Preis zu warten, der nie kommt.',
    ),
    links: [link('Wikipedia – Sneaker', 'https://de.wikipedia.org/wiki/Sneaker')],
  },
  S28: {
    strategy: tr(
      'Pick one topic you can make a video about every week for a year. The first months pay nothing; income comes from views, sponsors and your own products once an audience trusts you.',
      'Wähle ein Thema, zu dem du ein Jahr lang jede Woche ein Video machen kannst. Die ersten Monate zahlen nichts; Einnahmen kommen aus Aufrufen, Sponsoren und eigenen Produkten, wenn dir ein Publikum vertraut.',
    ),
    risks: tr(
      'Risk 3 of 5: most channels never earn much, and a change of the platform’s rules can cut the income overnight.',
      'Risiko 3 von 5: Die meisten Kanäle verdienen nie viel, und eine Änderung der Plattformregeln kann die Einnahmen über Nacht kappen.',
    ),
    tip: tr(
      'Do: build a mailing list as well. Don’t: depend on one platform for everything.',
      'Tu: Baue zusätzlich einen Mail-Verteiler auf. Lass: dich für alles von einer Plattform abhängig zu machen.',
    ),
    links: [
      link(
        'Wikipedia – YouTube-Partnerprogramm',
        'https://de.wikipedia.org/wiki/YouTube-Partnerprogramm',
      ),
      link(
        'Wikipedia – Kleinunternehmerregelung',
        'https://de.wikipedia.org/wiki/Kleinunternehmerregelung',
      ),
    ],
  },
  S29: {
    strategy: tr(
      'Sell a skill you already have for a fixed hourly or day rate, to two or three steady clients, on weekends. Raise the rate when the calendar is full, and turn repeat work into a monthly agreement.',
      'Verkaufe eine Fähigkeit, die du schon hast, zu einem festen Stunden- oder Tagessatz an zwei, drei feste Kunden, am Wochenende. Erhöhe den Satz, wenn der Kalender voll ist, und mache Wiederholungsarbeit zu einer Monatsvereinbarung.',
    ),
    tip: tr(
      'Do: clear it with your employer and register the business. Don’t: work without a contract and a written price.',
      'Tu: Kläre es mit deinem Arbeitgeber und melde das Gewerbe an. Lass: ohne Vertrag und schriftlichen Preis zu arbeiten.',
    ),
    links: [
      link('Wikipedia – Freiberufler', 'https://de.wikipedia.org/wiki/Freiberufler'),
      link('Gründerplattform', 'https://www.gruenderplattform.de/'),
      link('freelancermap', 'https://www.freelancermap.de/'),
    ],
  },
  S30: {
    strategy: tr(
      'Buy used phones that are priced below their market, test them, clean them, and sell with a short guarantee. Your profit is the gap between what you pay and what you sell for, minus fees and your time.',
      'Kaufe gebrauchte Handys, die unter ihrem Marktpreis angeboten werden, teste sie, reinige sie und verkaufe mit kurzer Garantie. Dein Gewinn ist der Abstand zwischen Einkauf und Verkauf, minus Gebühren und Zeit.',
    ),
    tip: tr(
      'Do: check the IMEI and that the phone is not locked or reported lost. Don’t: buy more than you can sell in a month.',
      'Tu: Prüfe die IMEI und dass das Handy nicht gesperrt oder als gestohlen gemeldet ist. Lass: mehr zu kaufen, als du in einem Monat verkaufen kannst.',
    ),
    links: [
      link('Wikipedia – Arbitrage', 'https://de.wikipedia.org/wiki/Arbitrage'),
      link('Wikipedia – Gewerbeanmeldung', 'https://de.wikipedia.org/wiki/Gewerbeanmeldung'),
    ],
  },
  S31: {
    strategy: tr(
      'Teach a school subject you are good at, one hour a time, and raise the price with each recommendation. Offer a monthly package, so the income does not depend on one lesson.',
      'Unterrichte ein Schulfach, das du gut kannst, eine Stunde nach der anderen, und erhöhe den Preis mit jeder Empfehlung. Biete ein Monatspaket an, damit das Einkommen nicht an einer Stunde hängt.',
    ),
    tip: tr(
      'Do: write down a goal with every student. Don’t: teach without telling the tax office.',
      'Tu: Schreibe mit jedem Schüler ein Ziel auf. Lass: zu unterrichten, ohne es dem Finanzamt zu sagen.',
    ),
    links: [link('Wikipedia – Nachhilfe', 'https://de.wikipedia.org/wiki/Nachhilfe')],
  },
  S32: {
    strategy: tr(
      'Design a few products for one small group of people, let a print firm make and ship on order, and spend your time on the designs and the shop. Start with five designs, keep the two that sell.',
      'Gestalte einige Produkte für eine kleine Zielgruppe, lass eine Druckerei auf Bestellung drucken und versenden und stecke deine Zeit in Designs und Shop. Starte mit fünf Designs, behalte die zwei, die sich verkaufen.',
    ),
    risks: tr(
      'Risk 3 of 5: many shops, low margins, and designs that copy a brand can be taken down.',
      'Risiko 3 von 5: Viele Shops, kleine Margen, und Designs, die eine Marke kopieren, werden gelöscht.',
    ),
    tip: tr(
      'Do: order a sample before you sell. Don’t: use a logo or a quote that belongs to someone else.',
      'Tu: Bestelle ein Muster, bevor du verkaufst. Lass: ein Logo oder Zitat zu verwenden, das einem anderen gehört.',
    ),
    links: [
      link('Wikipedia – Print on Demand', 'https://de.wikipedia.org/wiki/Print_on_Demand'),
      link('Spreadshirt', 'https://www.spreadshirt.de/'),
    ],
  },
  S33: {
    strategy: tr(
      'Make a template that solves one clear problem (a budget sheet, a CV, a planner), sell it again and again, and improve it from the questions customers ask. The work is done once; the income repeats.',
      'Baue eine Vorlage, die ein klares Problem löst (Budget-Tabelle, Lebenslauf, Planer), verkaufe sie immer wieder und verbessere sie anhand der Kundenfragen. Die Arbeit ist einmal getan; die Einnahmen wiederholen sich.',
    ),
    tip: tr(
      'Do: sell on your own page as well as a marketplace. Don’t: make ten templates before one has sold.',
      'Tu: Verkaufe auch auf einer eigenen Seite, nicht nur auf einem Marktplatz. Lass: zehn Vorlagen zu bauen, bevor eine verkauft ist.',
    ),
    links: [
      link('Gumroad', 'https://gumroad.com/'),
      link(
        'Wikipedia – Kleinunternehmerregelung',
        'https://de.wikipedia.org/wiki/Kleinunternehmerregelung',
      ),
    ],
  },
  S34: {
    strategy: tr(
      'Work the busy slots (weekend evenings, bad weather), choose the zone where orders are close together, and keep the bike or the bag in good shape - it is your tool.',
      'Arbeite in den vollen Zeiten (Wochenendabende, schlechtes Wetter), wähle das Gebiet mit dicht beieinanderliegenden Aufträgen und halte Rad und Tasche in Schuss - es ist dein Werkzeug.',
    ),
    risks: tr(
      'Risk 2 of 5: income depends on weather and orders, and an accident without insurance can cost more than you earn.',
      'Risiko 2 von 5: Das Einkommen hängt von Wetter und Aufträgen ab, und ein Unfall ohne Versicherung kann mehr kosten, als du verdienst.',
    ),
    tip: tr(
      'Do: check whether you are an employee or self-employed. Don’t: ride without insurance.',
      'Tu: Kläre, ob du angestellt oder selbstständig bist. Lass: ohne Versicherung zu fahren.',
    ),
    links: [
      link('Wikipedia – Minijob', 'https://de.wikipedia.org/wiki/Minijob'),
      link('Minijob-Zentrale', 'https://www.minijob-zentrale.de/'),
    ],
  },
  S35: {
    strategy: tr(
      'Lock money you will not need for a set time and get a fixed rate. Spread across a few terms, so something comes free every year, and compare banks within the deposit insurance.',
      'Lege Geld, das du für eine feste Zeit nicht brauchst, zu einem festen Zins an. Verteile auf mehrere Laufzeiten, damit jedes Jahr etwas frei wird, und vergleiche Banken im Rahmen der Einlagensicherung.',
    ),
    tip: tr(
      'Do: choose the term by when you need the money. Don’t: lock the money you may need for an emergency.',
      'Tu: Wähle die Laufzeit danach, wann du das Geld brauchst. Lass: Geld zu sperren, das du für einen Notfall brauchen könntest.',
    ),
    links: [
      link('Finanztip – Festgeld', 'https://www.finanztip.de/festgeld/'),
      link('Wikipedia – Festgeld', 'https://de.wikipedia.org/wiki/Festgeld'),
    ],
  },
  S36: {
    tip: tr(
      'Do: put the end dates into your calendar. Don’t: let a contract renew just because it is easier.',
      'Tu: Trage die Enddaten in deinen Kalender ein. Lass: einen Vertrag nur deshalb weiterlaufen, weil es einfacher ist.',
    ),
    links: [
      link('Wikipedia – Kündigungsfrist', 'https://de.wikipedia.org/wiki/K%C3%BCndigungsfrist'),
      link(
        'Verbraucherzentrale – Verträge',
        'https://www.verbraucherzentrale.de/wissen/vertraege-reklamation',
      ),
    ],
  },
};
