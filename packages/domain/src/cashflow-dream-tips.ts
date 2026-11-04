/**
 * One tip against a known trap, or one fun fact, for a dream (JFK, 2026-11): it becomes the last note of the project, so planning,
 * reading and living the dream has a small detail to smile about. `tip`: what people who did it warn about; `fact`: something to enjoy.
 */
export type DreamTipKind = 'tip' | 'fact';
export interface DreamTip {
  kind: DreamTipKind;
  en: string;
  de: string;
}

const t = (en: string, de: string): DreamTip => ({ kind: 'tip', en, de });
const f = (en: string, de: string): DreamTip => ({ kind: 'fact', en, de });

export const DREAM_TIPS: Record<string, DreamTip> = {
  D01: t(
    'Buy only on the official ticket site: resellers sell the same slots for double. The arena floor and the underground need their own ticket.',
    'Kauf nur auf der offiziellen Ticketseite: Wiederverkäufer verlangen für dieselben Zeitfenster das Doppelte. Arenaboden und Untergeschoss brauchen ein eigenes Ticket.',
  ),
  D02: f(
    'Petra was unknown to the western world until 1812, when the Swiss explorer Johann Ludwig Burckhardt disguised himself as a pilgrim to get in.',
    'Petra war der westlichen Welt bis 1812 unbekannt, als der Schweizer Forscher Johann Ludwig Burckhardt sich als Pilger verkleidete, um hineinzukommen.',
  ),
  D03: t(
    'The Taj Mahal is closed to visitors on Fridays. Plan the sunrise for another day, and take the gate with the shorter queue.',
    'Das Taj Mahal ist freitags für Besucher geschlossen. Plane den Sonnenaufgang für einen anderen Tag und nimm das Tor mit der kürzeren Schlange.',
  ),
  D04: t(
    'Badaling is the crowded, easy section. Mutianyu and Jinshanling are quieter, and a weekday morning is best.',
    'Badaling ist der überlaufene, leichte Abschnitt. Mutianyu und Jinshanling sind ruhiger, und ein Vormittag unter der Woche ist am besten.',
  ),
  D05: t(
    'Spend a night or two in the Sacred Valley first: Cusco is at 3,400 m and altitude sickness hits those who fly in and walk the same day.',
    'Verbring zuerst ein bis zwei Nächte im Heiligen Tal: Cusco liegt auf 3.400 m, und die Höhenkrankheit trifft die, die einfliegen und am selben Tag loslaufen.',
  ),
  D06: f(
    'Clap your hands in front of the main stairway: the echo that comes back sounds like the chirp of the quetzal, the sacred bird of the Maya.',
    'Klatsch vor der großen Treppe in die Hände: das Echo klingt wie das Zwitschern des Quetzals, des heiligen Vogels der Maya.',
  ),
  D07: t(
    'The statue is often in the clouds. Look at the live webcam in the morning and go up when it is clear.',
    'Die Statue steckt oft in Wolken. Schau morgens auf die Live-Webcam und fahr hoch, wenn es klar ist.',
  ),
  D08: t(
    'The lights depend on clear skies, not on luck alone: stay at least four nights, and check an aurora forecast and the cloud cover each evening.',
    'Die Lichter hängen vom klaren Himmel ab, nicht nur vom Glück: bleib mindestens vier Nächte und prüfe jeden Abend Polarlicht-Vorhersage und Bewölkung.',
  ),
  D09: t(
    'The Great Migration moves in a circle all year. River crossings in the north are around July to October, the calving in the south in January and February: choose your month by what you want to see.',
    'Die Große Migration zieht das ganze Jahr im Kreis. Flussüberquerungen im Norden sind etwa von Juli bis Oktober, die Kälber im Süden im Januar und Februar: wähle den Monat nach dem, was du sehen willst.',
  ),
  D10: t(
    'The blossom peaks for about a week and moves with the year: keep your dates flexible, follow the forecast, and plan a second city further north as a back-up.',
    'Die Blüte hat nur etwa eine Woche ihren Höhepunkt und wandert mit dem Jahr: halte deine Termine flexibel, folge der Vorhersage und plane als Reserve eine zweite Stadt weiter nördlich.',
  ),
  D11: t(
    'The Drake Passage can be rough. If the sea worries you, look at fly-cruises that skip it, and take seasickness tablets either way.',
    'Die Drake-Passage kann rau sein. Wenn dich die See sorgt, schau dir Fly-Cruises an, die sie auslassen, und nimm in jedem Fall Tabletten gegen Seekrankheit mit.',
  ),
  D12: t(
    'Round-the-world tickets of the airline alliances have rules: one direction, a fixed number of stops. Compare with single flights before you book.',
    'Weltreise-Tickets der Airline-Allianzen haben Regeln: eine Richtung, eine feste Zahl an Stopps. Vergleiche vor der Buchung mit Einzelflügen.',
  ),
  D13: t(
    'An annual national parks pass costs about 80 dollars and pays for itself after two or three big parks. Some parks need a timed reservation: check it before you go.',
    'Ein Jahrespass für die Nationalparks kostet etwa 80 Dollar und lohnt sich nach zwei oder drei großen Parks. Manche Parks brauchen eine Zeitreservierung: prüf das vor der Abreise.',
  ),
  D14: t(
    'Roads are narrow and winding, so plan fewer kilometres a day than you think. Camp only where it is allowed: fines for wild camping are high.',
    'Die Straßen sind schmal und kurvig, plane also weniger Kilometer am Tag, als du denkst. Campe nur, wo es erlaubt ist: die Strafen für wildes Campen sind hoch.',
  ),
  D15: t(
    'Use only the official ticketing and hospitality sellers. Tickets for finals are scarce, and fake ones are the biggest trap.',
    'Nutze nur die offiziellen Ticket- und Hospitality-Anbieter. Tickets für Finals sind knapp, und gefälschte sind die größte Falle.',
  ),
  D16: t(
    'Choose a route of seven or eight days, such as Lemosho or Machame. The slower the climb, the better the chance of reaching the top, and "pole pole" (slowly) is the guide\'s favourite word.',
    'Wähle eine Route von sieben oder acht Tagen, etwa Lemosho oder Machame. Je langsamer der Aufstieg, desto besser die Chance auf den Gipfel, und "pole pole" (langsam) ist das Lieblingswort der Führer.',
  ),
  D17: t(
    'Do not skip the rest days in Namche Bazaar and Dingboche. "Climb high, sleep low" is the rule that keeps trekkers well.',
    'Lass die Ruhetage in Namche Bazaar und Dingboche nicht aus. "Hoch steigen, tief schlafen" ist die Regel, die Trekker gesund hält.',
  ),
  D18: t(
    'Mountain huts are booked up in July and August: reserve them early, and carry a light sleeping liner, because most huts ask for one.',
    'Berghütten sind im Juli und August ausgebucht: reserviere früh und nimm einen leichten Hüttenschlafsack mit, den die meisten Hütten verlangen.',
  ),
  D19: f(
    'In free fall you reach about 200 km/h, and then the speed stops growing, so the last part feels more like floating on a wind than falling.',
    'Im freien Fall erreichst du etwa 200 km/h, dann wächst die Geschwindigkeit nicht mehr, und der letzte Teil fühlt sich eher wie Schweben auf einem Wind an als wie Fallen.',
  ),
  D20: t(
    'Choose a boat that goes to the outer reef and holds an eco-tourism certificate. The reef near the coast is less colourful and more crowded.',
    'Wähle ein Boot, das zum äußeren Riff fährt und ein Ökotourismus-Zertifikat hat. Das Riff nahe der Küste ist weniger bunt und voller.',
  ),
  D21: f(
    'Weightlessness on a parabolic flight lasts only about 20 to 25 seconds at a time, in around fifteen parabolas, so the plane is nicknamed the "vomit comet" for a reason: eat light.',
    'Die Schwerelosigkeit im Parabelflug dauert nur etwa 20 bis 25 Sekunden am Stück, in rund fünfzehn Parabeln. Das Flugzeug heißt nicht ohne Grund "Vomit Comet": iss leicht.',
  ),
  D22: f(
    'Finishing all six of the big city marathons (Tokyo, Boston, London, Berlin, Chicago, New York) earns the Six Star Medal. Most places are won by ballot or charity, so apply every year.',
    'Wer alle sechs großen Stadtmarathons (Tokio, Boston, London, Berlin, Chicago, New York) beendet, bekommt die Six Star Medal. Die meisten Plätze gibt es per Los oder für Spendenläufer, also bewirb dich jedes Jahr.',
  ),
  D23: f(
    'A stratospheric balloon rises to about 30 km: the sky is black at noon and you can see the curve of the Earth, though space officially starts at 100 km.',
    'Ein Stratosphärenballon steigt auf etwa 30 km: der Himmel ist mittags schwarz und du siehst die Krümmung der Erde, auch wenn der Weltraum offiziell erst bei 100 km beginnt.',
  ),
  D24: t(
    'Get the aviation medical certificate before you pay for lessons. A condition that stops you from flying is the most expensive surprise of all.',
    'Hol dir das fliegerärztliche Tauglichkeitszeugnis, bevor du Flugstunden bezahlst. Eine Krankheit, die dich am Fliegen hindert, ist die teuerste Überraschung von allen.',
  ),
  D25: t(
    'The wind of the Adriatic rises in the afternoon, so plan to reach the harbour by early afternoon. In high season book the moorings ahead.',
    'Der Wind der Adria steigt am Nachmittag, plane also, den Hafen am frühen Nachmittag zu erreichen. In der Hochsaison die Liegeplätze vorbuchen.',
  ),
  D26: t(
    'Twenty minutes a day beat two hours on Sunday. Take a teacher for the first months, so bad habits of the hands never settle in.',
    'Zwanzig Minuten am Tag schlagen zwei Stunden am Sonntag. Nimm für die ersten Monate einen Lehrer, damit sich schlechte Handgewohnheiten gar nicht erst einschleichen.',
  ),
  D27: f(
    'The bitter oranges that line the streets of Seville are not for eating: most of them travel to Britain to become marmalade.',
    'Die bitteren Orangen, die die Straßen Sevillas säumen, sind nicht zum Essen: die meisten reisen nach Großbritannien und werden zu Marmelade.',
  ),
  D28: t(
    'Plan ten to fifteen percent on top of the price for pedals, a lock, lights and a bike fit: the bike that fits you beats the one with the better parts.',
    'Plane zehn bis fünfzehn Prozent auf den Preis für Pedale, Schloss, Licht und eine Rad-Anpassung: das Rad, das dir passt, schlägt das mit den besseren Teilen.',
  ),
  D29: t(
    'Buy the helmet, jacket, gloves and boots before the bike, and book a safety training: the first season is the most dangerous one.',
    'Kauf Helm, Jacke, Handschuhe und Stiefel vor dem Motorrad und buch ein Fahrsicherheitstraining: die erste Saison ist die gefährlichste.',
  ),
  D30: t(
    'Weigh the van fully loaded before the first trip. Many campervans are over their permitted weight, which means fines and insurance trouble.',
    'Wiege den Van vollbeladen vor der ersten Reise. Viele Campervans sind über dem zulässigen Gewicht, was Bußgelder und Ärger mit der Versicherung bedeutet.',
  ),
  D31: t(
    'Rust is the enemy: look at the sills, the floor and the battery tray, and check that the engine and frame numbers match the papers. Buy the best body, not the best paint.',
    'Rost ist der Feind: schau auf Schweller, Boden und Batteriekasten und prüf, ob Motor- und Rahmennummer zu den Papieren passen. Kauf die beste Karosserie, nicht den besten Lack.',
  ),
  D32: t(
    "Have a Porsche specialist inspect the car before you buy, and ask for the full service history. On some years of the 996 and 997 the engine's intermediate shaft bearing is a known weak point.",
    'Lass einen Porsche-Spezialisten das Auto vor dem Kauf prüfen und frag nach der kompletten Servicehistorie. Bei manchen Baujahren des 996 und 997 ist das Zwischenwellenlager des Motors eine bekannte Schwachstelle.',
  ),
  D33: t(
    'Plan the sockets, the lighting and the waste system first. They are cheap on paper and costly to change after the units are in.',
    'Plane zuerst Steckdosen, Beleuchtung und Abfallsystem. Auf dem Papier kosten sie wenig, und nach dem Einbau sind sie teuer zu ändern.',
  ),
  D34: t(
    "Read the minutes of the last owners' meetings and look at the reserve fund. Plan about ten percent on top of the price for purchase costs.",
    'Lies die Protokolle der letzten Eigentümerversammlungen und schau auf die Instandhaltungsrücklage. Plane etwa zehn Prozent auf den Preis für die Kaufnebenkosten.',
  ),
  D35: t(
    'A tiny house on wheels must stay within the road limits: in Europe 2.55 m wide, 4 m high and the weight of the trailer. A house built beyond that will not be allowed on the road.',
    'Ein Tiny House auf Rädern muss in den Straßenmaßen bleiben: in Europa 2,55 m breit, 4 m hoch und das Gewicht des Anhängers. Ein Haus darüber darf nicht auf die Straße.',
  ),
  D36: t(
    'Have the soil tested before you buy a field. A lovely view can hide acid or waterlogged ground that no crop likes.',
    'Lass den Boden testen, bevor du ein Feld kaufst. Eine schöne Aussicht kann sauren oder staunassen Boden verbergen, den keine Pflanze mag.',
  ),
  D37: t(
    "Pack their medicines in your hand luggage in the original boxes, with a list and a doctor's letter. A lost suitcase must never mean lost medicine.",
    'Pack ihre Medikamente ins Handgepäck, in den Originalschachteln, mit einer Liste und einem Arztbrief. Ein verlorener Koffer darf nie verlorene Medizin heißen.',
  ),
  D38: t(
    'Ask each venue for an all-in price with service, corkage and cleaning. The extras are where wedding budgets break.',
    'Frag jeden Veranstaltungsort nach einem Komplettpreis mit Service, Korkgeld und Reinigung. Bei den Extras platzen Hochzeitsbudgets.',
  ),
  D39: f(
    'At five percent a year, 100 a month for 18 years grows to about 35,000, of which only 21,600 is your own money. Time does the rest.',
    'Bei fünf Prozent im Jahr wachsen 100 im Monat über 18 Jahre auf etwa 35.000, von denen nur 21.600 dein eigenes Geld sind. Den Rest macht die Zeit.',
  ),
  D40: t(
    'Use one shared expense app, so nobody has to be the bank. Agree on how costs are split before the first booking, not at the airport.',
    'Nutzt eine gemeinsame Ausgaben-App, damit niemand die Bank sein muss. Einigt euch auf die Aufteilung der Kosten vor der ersten Buchung, nicht am Flughafen.',
  ),
  D41: t(
    'Never pay a publisher to publish you: a real publisher pays you. Pay for a good editor and a good cover instead, because those two decide how your book looks and reads.',
    'Bezahl nie einen Verlag dafür, dich zu veröffentlichen: ein echter Verlag zahlt dir. Bezahl lieber ein gutes Lektorat und ein gutes Cover, denn diese beiden entscheiden, wie dein Buch aussieht und liest.',
  ),
  D42: t(
    'Streaming services turn loud music down, so do not crush your songs to make them louder. A dynamic master sounds better on every platform.',
    'Streamingdienste regeln laute Musik herunter, quetsch deine Songs also nicht, um sie lauter zu machen. Ein dynamischer Master klingt auf jeder Plattform besser.',
  ),
  D43: t(
    'A common rule of thumb: rent should be under about ten percent of sales. Count the coffees you must sell a day to pay the rent before you sign.',
    'Eine häufige Faustregel: die Miete sollte unter etwa zehn Prozent des Umsatzes liegen. Zähle vor der Unterschrift die Kaffees, die du am Tag verkaufen musst, um die Miete zu zahlen.',
  ),
  D44: t(
    'A building without teachers helps nobody. Ask whether the teachers are paid and trained, and whether the school also gets books, water and toilets.',
    'Ein Gebäude ohne Lehrer hilft niemandem. Frag, ob die Lehrer bezahlt und geschult werden und ob die Schule auch Bücher, Wasser und Toiletten bekommt.',
  ),
  D45: f(
    'A horse can sleep standing up: a locking mechanism in the legs holds it upright, though it still needs to lie down for deep sleep.',
    'Ein Pferd kann im Stehen schlafen: ein Sperrmechanismus in den Beinen hält es aufrecht, auch wenn es für den Tiefschlaf noch liegen muss.',
  ),
  D46: t(
    'Check a fibreglass hull for osmosis blisters and the keel bolts for corrosion. These two repairs are the ones that surprise new owners.',
    'Prüf bei einem GFK-Rumpf auf Osmoseblasen und die Kielbolzen auf Korrosion. Diese beiden Reparaturen überraschen neue Eigner.',
  ),
  D47: t(
    'Keep a mechanical watch away from magnets such as phone speakers and bag clasps. They can magnetise the hairspring, and the watch will run fast.',
    'Halte eine mechanische Uhr von Magneten wie Handy-Lautsprechern und Taschenverschlüssen fern. Sie können die Unruhspirale magnetisieren, und die Uhr geht vor.',
  ),
  D48: t(
    'Ask for the survival rate of the trees after three years, not for the number planted. That one number tells a good project from a poor one.',
    'Frag nach der Überlebensrate der Bäume nach drei Jahren, nicht nach der Zahl der gepflanzten. Diese eine Zahl trennt ein gutes Projekt von einem schlechten.',
  ),
  D49: f(
    'Angkor Wat faces west, unusual for a Hindu temple, so from the entrance causeway the sun rises directly behind its five towers.',
    'Angkor Wat blickt nach Westen, ungewöhnlich für einen Hindu-Tempel, und so geht die Sonne vom Eingangsdamm aus direkt hinter den fünf Türmen auf.',
  ),
  D50: t(
    'Agree the price of any camel or horse ride before you climb on, and politely decline "guides" who walk up to you. The great pyramid was the tallest building on Earth for about 3,800 years.',
    'Vereinbare den Preis für jeden Kamel- oder Pferderitt, bevor du aufsteigst, und lehne "Führer", die dich ansprechen, höflich ab. Die große Pyramide war etwa 3.800 Jahre lang das höchste Bauwerk der Erde.',
  ),
  D51: f(
    'Cappadocia has underground cities such as Derinkuyu, which reach about 60 metres down and gave shelter to thousands of people.',
    'Kappadokien hat unterirdische Städte wie Derinkuyu, die etwa 60 Meter in die Tiefe reichen und Tausenden Menschen Schutz gaben.',
  ),
  D52: f(
    'On nights around the full moon, the spray makes a "moonbow", a rainbow of moonlight. Some seasons the park opens for guided full-moon walks.',
    'In Nächten um Vollmond macht die Gischt einen "Mondregenbogen", einen Regenbogen aus Mondlicht. In manchen Zeiten öffnet der Park für geführte Vollmondwanderungen.',
  ),
  D53: t(
    'The wind can tear the door out of your hand when you open it, and that damage is rarely covered: park facing the wind and hold the door with both hands.',
    'Der Wind kann dir die Tür aus der Hand reißen, und dieser Schaden ist selten gedeckt: park mit der Nase im Wind und halte die Tür mit beiden Händen.',
  ),
  D54: f(
    'On the whole line from Moscow to Vladivostok, the timetables are in Moscow time, seven time zones away from the last station. Look at the clock outside, not at the station board.',
    'Auf der ganzen Strecke von Moskau nach Wladiwostok gelten die Fahrpläne in Moskauer Zeit, sieben Zeitzonen vom letzten Bahnhof entfernt. Schau auf die Uhr draußen, nicht auf die Bahnhofstafel.',
  ),
  D55: t(
    'Prices are often quoted before the service charge and the taxes. Ask for the final price per night, and compare half board and all-inclusive on that number.',
    'Preise werden oft vor Servicegebühr und Steuern genannt. Frag nach dem Endpreis pro Nacht und vergleiche Halbpension und All-inclusive anhand dieser Zahl.',
  ),
  D56: f(
    'Route 66 was officially taken off the map of US highways in 1985. Today it is stitched together from old stretches, so a good route guide is part of the adventure.',
    'Die Route 66 wurde 1985 offiziell aus dem Netz der US-Highways genommen. Heute besteht sie aus alten Abschnitten, ein guter Routenführer gehört also zum Abenteuer.',
  ),
  D57: f(
    '"Galápago" is an old Spanish word for the saddle-shaped shells of the giant tortoises, which gave the islands their name.',
    '"Galápago" ist ein altes spanisches Wort für die sattelförmigen Panzer der Riesenschildkröten, die den Inseln ihren Namen gaben.',
  ),
  D58: f(
    'On Nyepi, the Day of Silence, all of Bali stops for 24 hours: no lights, no traffic, even the airport closes. Check the date before you book your flights.',
    'An Nyepi, dem Tag der Stille, steht ganz Bali 24 Stunden still: kein Licht, kein Verkehr, sogar der Flughafen schließt. Prüf das Datum, bevor du Flüge buchst.',
  ),
  D59: f(
    'Agatha Christie\'s novel "Murder on the Orient Express" (1934) made the train a legend. Pack an evening outfit: the dinner is part of the show.',
    'Agatha Christies Roman "Mord im Orient-Express" (1934) machte den Zug zur Legende. Pack ein Abendoutfit ein: das Abendessen gehört zur Show.',
  ),
  D60: f(
    '"Paine" (say "PIE-neh") is a word of the Tehuelche people for "blue", and the park\'s lakes show why.',
    '"Paine" (sprich "PEI-ne") ist ein Wort des Volkes der Tehuelche für "blau", und die Seen des Parks zeigen, warum.',
  ),
  D61: f(
    'On Pico the old whalers watched from lookout huts on the hills. The same lookouts now call the whale-watching boats to the animals.',
    'Auf Pico spähten die alten Walfänger von Ausguckhütten auf den Hügeln. Dieselben Ausgucke rufen heute die Walbeobachtungsboote zu den Tieren.',
  ),
  D62: t(
    'Get your legs ready: powder skiing is tiring and the runs are long. A few weeks of squats and lunges before you go make the difference between a great week and a short one.',
    'Mach deine Beine fit: Pulverschnee ist anstrengend und die Abfahrten sind lang. Einige Wochen Kniebeugen und Ausfallschritte vorher entscheiden zwischen einer großartigen und einer kurzen Woche.',
  ),
  D63: t(
    'Never hold your breath while diving, and equalise your ears early and often. These two rules prevent most beginner injuries.',
    'Halte beim Tauchen nie den Atem an und gleiche den Druck in den Ohren früh und oft aus. Diese zwei Regeln verhindern die meisten Anfängerverletzungen.',
  ),
  D64: f(
    'Pilots look for soaring buzzards and eagles: the birds circle exactly where the warm air rises, and they show the way to the thermal.',
    'Piloten achten auf kreisende Bussarde und Adler: die Vögel kreisen genau dort, wo die warme Luft aufsteigt, und zeigen den Weg zur Thermik.',
  ),
  D65: t(
    'Practise your race-day food and drink in your long training sessions. Nothing new on race day is the first rule of every finisher.',
    'Übe Essen und Trinken für den Renntag in deinen langen Trainingseinheiten. Nichts Neues am Renntag ist die erste Regel jedes Finishers.',
  ),
  D66: f(
    'Only about a fifth of the Sahara is sand dunes. The rest is stone desert, gravel plains and mountains, and the dunes of Erg Chebbi are among its most beautiful.',
    'Nur etwa ein Fünftel der Sahara besteht aus Sanddünen. Der Rest ist Steinwüste, Kiesebene und Gebirge, und die Dünen des Erg Chebbi gehören zu den schönsten.',
  ),
  D67: t(
    'Talk to former crew before you choose a skipper, and ask about the watch system, the food budget and what happens if somebody wants to stop. A good skipper has good answers.',
    'Sprich mit früheren Crewmitgliedern, bevor du einen Skipper wählst, und frag nach Wachsystem, Essensbudget und danach, was geschieht, wenn jemand aufhören will. Ein guter Skipper hat gute Antworten.',
  ),
  D68: t(
    'On the normal route the Goûter hut must be booked, and spaces go early in the year. Without a booking you will not be allowed to stay.',
    'Auf der Normalroute muss die Goûter-Hütte reserviert werden, und die Plätze sind früh im Jahr weg. Ohne Reservierung darfst du nicht bleiben.',
  ),
  D69: f(
    'Renaissance painters ground their own colours, and ultramarine, made from lapis lazuli, cost more than gold. That is why it was kept for the robe of the Virgin.',
    'Die Maler der Renaissance rieben ihre Farben selbst an, und Ultramarin aus Lapislazuli kostete mehr als Gold. Deshalb war es dem Gewand der Jungfrau vorbehalten.',
  ),
  D70: t(
    'Keep a tasting journal from day one, and write the same four things for every wine: look, smell, taste and finish. In a year you will see your own palate grow.',
    'Führe vom ersten Tag an ein Verkostungstagebuch und schreib zu jedem Wein dieselben vier Dinge auf: Aussehen, Geruch, Geschmack und Abgang. In einem Jahr siehst du deinen Gaumen wachsen.',
  ),
  D71: t(
    'Apply to five or eight programmes, not one, and check early that your degree is recognised. The deadlines are often a year ahead.',
    'Bewirb dich bei fünf bis acht Programmen, nicht bei einem, und prüf früh, ob dein Abschluss anerkannt wird. Die Fristen liegen oft ein Jahr voraus.',
  ),
  D72: f(
    'The first programmer was Ada Lovelace: in 1843 she wrote an algorithm for a machine that had not been built yet.',
    'Die erste Programmiererin war Ada Lovelace: 1843 schrieb sie einen Algorithmus für eine Maschine, die noch gar nicht gebaut war.',
  ),
  D73: f(
    'Traditional Tuscan bread is baked without salt. A famous story says it began with a medieval salt tax, and it is made to go with salty ham and cheese.',
    'Traditionelles toskanisches Brot wird ohne Salz gebacken. Eine bekannte Geschichte erzählt, es habe mit einer mittelalterlichen Salzsteuer begonnen, und es passt zu salzigem Schinken und Käse.',
  ),
  D74: f(
    'Japanese uses three writing systems in the same sentence: kanji, hiragana and katakana. Learn the two kana first, they take only a few weeks.',
    'Japanisch benutzt drei Schriftsysteme im selben Satz: Kanji, Hiragana und Katakana. Lern zuerst die beiden Kana, sie brauchen nur wenige Wochen.',
  ),
  D75: t(
    'For daily use, charge to 80 percent at home and keep fast chargers for trips. A heat pump option adds a lot of winter range.',
    'Lade im Alltag zu Hause auf 80 Prozent und spar die Schnelllader für Reisen auf. Eine Wärmepumpen-Option bringt im Winter viel Reichweite.',
  ),
  D76: f(
    '"Vespa" is Italian for wasp: the first model of 1946 got its name from the buzz of its engine and its narrow waist.',
    '"Vespa" ist italienisch für Wespe: das erste Modell von 1946 bekam seinen Namen vom Summen des Motors und der schmalen Taille.',
  ),
  D77: t(
    'In cold regions ask how the boat is protected from ice in winter. Ice can crush a hull that was fine all summer.',
    'Frag in kalten Regionen, wie das Boot im Winter vor Eis geschützt wird. Eis kann einen Rumpf zerdrücken, der den ganzen Sommer in Ordnung war.',
  ),
  D78: t(
    'The historic plate needs a car of at least 30 years in largely original condition. A heavily modified car may not get it, and then the tax and insurance saving is gone.',
    'Das historische Kennzeichen braucht ein Auto von mindestens 30 Jahren in weitgehend originalem Zustand. Ein stark umgebautes bekommt es vielleicht nicht, und dann ist die Ersparnis bei Steuer und Versicherung weg.',
  ),
  D79: t(
    'North-facing glass gives even light without glare and keeps the room cool. A big south window turns a small studio into a greenhouse in summer.',
    'Nach Norden gerichtetes Glas gibt gleichmäßiges Licht ohne Blendung und hält den Raum kühl. Ein großes Südfenster macht ein kleines Studio im Sommer zum Gewächshaus.',
  ),
  D80: f(
    'East-west roofs make less power at noon but spread it over a longer day, which often suits a household better than a single south-facing peak.',
    'Ost-West-Dächer liefern mittags weniger, verteilen den Strom aber auf einen längeren Tag, was zu einem Haushalt oft besser passt als eine einzelne Südspitze.',
  ),
  D81: t(
    'Visit in the off-seasons too, in November and April, before you buy. A cabin you love in January may be a mud track in April.',
    'Besuche den Ort vor dem Kauf auch in der Nebensaison, im November und April. Eine Hütte, die du im Januar liebst, kann im April ein Matschweg sein.',
  ),
  D82: t(
    'Check that the building has all its permits, and that no debts are tied to the property: in some countries debts of the previous owner stay with the house.',
    'Prüf, ob das Gebäude alle Genehmigungen hat und ob keine Schulden am Grundstück hängen: in manchen Ländern bleiben Schulden des Vorbesitzers am Haus.',
  ),
  D83: t(
    'Ask every guest for a 20-second video message and play the film at the party. It is the gift people remember longest.',
    'Bitte jeden Gast um eine 20-Sekunden-Videobotschaft und spiel den Film auf der Feier. Es ist das Geschenk, an das man sich am längsten erinnert.',
  ),
  D84: t(
    'Many towns offer a free home-adaptation advice for older people. Ask for it before you plan anything: it tells you what really matters.',
    'Viele Städte bieten älteren Menschen eine kostenlose Wohnberatung an. Frag danach, bevor du etwas planst: sie zeigt dir, was wirklich zählt.',
  ),
  D85: t(
    'If you change your name after the wedding, book the flights in the name of the passport, and change the passport only after the trip. A mismatch can stop you at the gate.',
    'Wenn du nach der Hochzeit deinen Namen änderst, buch die Flüge auf den Namen im Pass und ändere den Pass erst nach der Reise. Eine Abweichung kann dich am Gate stoppen.',
  ),
  D86: t(
    'Ride the big attractions in the first hour or the last, and look for the free single-rider lines. Midweek outside the school holidays is a different park.',
    'Fahr die großen Attraktionen in der ersten oder letzten Stunde und such die kostenlosen Single-Rider-Schlangen. Unter der Woche außerhalb der Schulferien ist es ein anderer Park.',
  ),
  D87: t(
    'Open a separate business account on day one. Mixed money is the start of most bookkeeping and tax problems.',
    'Eröffne am ersten Tag ein eigenes Geschäftskonto. Vermischtes Geld ist der Anfang der meisten Buchhaltungs- und Steuerprobleme.',
  ),
  D88: f(
    'Moving a light twice as close makes it four times brighter and its light softer. Distance is your first dimmer.',
    'Ein Licht doppelt so nah heranzuholen macht es viermal heller und sein Licht weicher. Die Entfernung ist dein erster Dimmer.',
  ),
  D89: f(
    'A rule of thumb of film-makers: one page of script is about one minute on screen. A 12-minute short fits about twelve pages.',
    'Eine Faustregel der Filmemacher: eine Drehbuchseite ist etwa eine Minute auf der Leinwand. Ein Kurzfilm von 12 Minuten braucht etwa zwölf Seiten.',
  ),
  D90: t(
    'Make sure a pot is bone dry before it goes in the kiln. Trapped water turns to steam and can burst the piece, and sometimes the pieces next to it.',
    'Stell sicher, dass ein Gefäß knochentrocken ist, bevor es in den Brennofen kommt. Eingeschlossenes Wasser wird zu Dampf und kann das Stück sprengen, manchmal auch die daneben.',
  ),
  D91: t(
    'Let the university or foundation run the selection. A clear, simple rule keeps it fair and light for you.',
    'Lass die Universität oder Stiftung die Auswahl übernehmen. Eine klare, einfache Regel hält sie fair und für dich leicht.',
  ),
  D92: t(
    'Prefer projects that train and equip a local mechanic. A well that cannot be repaired fails, and one with spare parts in the village lasts.',
    'Bevorzuge Projekte, die einen örtlichen Mechaniker ausbilden und ausstatten. Ein Brunnen, der nicht repariert werden kann, fällt aus, und einer mit Ersatzteilen im Dorf hält.',
  ),
  D93: t(
    'Ask the shelter for its wish list: many prefer specific items or direct payment of vet bills to a general donation.',
    'Frag das Tierheim nach seiner Wunschliste: viele bevorzugen bestimmte Dinge oder die direkte Zahlung von Tierarztrechnungen gegenüber einer allgemeinen Spende.',
  ),
  D94: f(
    'European playground equipment is tested to the standard EN 1176, and the surface under it to EN 1177. The higher the swing, the softer the ground must be.',
    'Europäische Spielgeräte werden nach der Norm EN 1176 geprüft und der Boden darunter nach EN 1177. Je höher die Schaukel, desto weicher muss der Boden sein.',
  ),
  D95: f(
    'Habitat for Humanity was founded in 1976. Former US president Jimmy Carter helped build houses with it for decades, well into his nineties.',
    'Habitat for Humanity wurde 1976 gegründet. Der frühere US-Präsident Jimmy Carter half jahrzehntelang beim Hausbau mit, bis weit in seine Neunziger.',
  ),
  D96: t(
    'Write the purpose so it can survive a changing world: "help young people learn" lasts, "repair typewriters" does not. Ask a lawyer for foundations to check the wording.',
    'Formuliere den Zweck so, dass er eine sich wandelnde Welt übersteht: "jungen Menschen beim Lernen helfen" hält, "Schreibmaschinen reparieren" nicht. Lass einen Stiftungsanwalt die Formulierung prüfen.',
  ),
};

/** The label in front of a tip or a fact, per language. */
export const DREAM_TIP_LABEL: Record<DreamTipKind, { en: string; de: string }> = {
  tip: { en: 'Tip: ', de: 'Tipp: ' },
  fact: { en: 'Fun fact: ', de: 'Wusstest du? ' },
};
