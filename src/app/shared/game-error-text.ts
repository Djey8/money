/**
 * The refusals and failures the game service tells in English, in German (JFK, 2026-10-26: everything the player reads is in the
 * language of the game). A message that is not listed is shown as it is.
 */
const GAME_ERRORS_DE: Record<string, string> = {
  'Throw the die of your purchase first.': 'Wirf zuerst den Würfel für deinen Kauf.',
  'There is no die to throw.': 'Es gibt keinen Würfel zu werfen.',
  'Could not adjust the bank loan.': 'Der Bankkredit konnte nicht angepasst werden.',
  'Could not complete this deal.': 'Dieser Handel konnte nicht abgeschlossen werden.',
  'Could not draw a card.': 'Es konnte keine Karte gezogen werden.',
  'Could not pay this off.': 'Das konnte nicht abbezahlt werden.',
  'Could not plan this deal.': 'Dieser Handel konnte nicht geplant werden.',
  'Could not play this market card.': 'Diese Marktkarte konnte nicht gespielt werden.',
  'Could not resolve Baby.': 'Das Baby konnte nicht abgewickelt werden.',
  'Could not roll.': 'Es konnte nicht gewürfelt werden.',
  'Could not run Payday.': 'Der Zahltag konnte nicht ausgeführt werden.',
  'Could not sell this card.': 'Diese Karte konnte nicht verkauft werden.',
  'Could not sell this.': 'Das konnte nicht verkauft werden.',
  'Could not settle the hype.': 'Der Hype konnte nicht abgerechnet werden.',
  'Could not settle this card.': 'Diese Karte konnte nicht abgeschlossen werden.',
  'Could not start the game.': 'Das Spiel konnte nicht gestartet werden.',
  'Could not update the share price.': 'Der Aktienkurs konnte nicht aktualisiert werden.',
  'Nothing to settle.': 'Nichts abzuschließen.',
  'There is no buyer for this.': 'Dafür gibt es keinen Käufer.',
  'There is no career to roll for.': 'Es gibt keine Karriere, für die gewürfelt werden kann.',
  'There is no dream to draw.': 'Es gibt keinen Traum zu ziehen.',
  'There is no emergency to draw.': 'Es gibt keinen Notfall zu ziehen.',
  'There is no hype to cash out.': 'Es gibt keinen Hype zum Auszahlen.',
  'There is no hype to ride.': 'Es gibt keinen Hype zum Mitreiten.',
  'There is no life card to draw.': 'Es gibt keine Lebenskarte zu ziehen.',
  'There is no market card to draw.': 'Es gibt keine Marktkarte zu ziehen.',
  'There is no open emergency.': 'Es gibt keinen offenen Notfall.',
  'There is no opportunity to pass.': 'Es gibt keine Gelegenheit zum Ablehnen.',
  'There is no pile to choose now.': 'Jetzt gibt es keinen Stapel zur Auswahl.',
  'There is no stage to reach.': 'Es gibt keine Stufe zu erreichen.',
  'This cannot be ended now.': 'Das kann jetzt nicht beendet werden.',
  'This card cannot be taken now.': 'Diese Karte kann jetzt nicht genommen werden.',
  'This card could not be planned.': 'Diese Karte konnte nicht geplant werden.',
  'This card has been dealt with.': 'Diese Karte ist schon erledigt.',
  'This dream cannot be taken now.': 'Dieser Traum kann jetzt nicht genommen werden.',
  'This emergency cannot be settled now.': 'Dieser Notfall kann jetzt nicht abgeschlossen werden.',
  'This game has no dreams.': 'Dieses Spiel hat keine Träume.',
  'This game has no emergency cards.': 'Dieses Spiel hat keine Notfallkarten.',
  'This game has no life cards.': 'Dieses Spiel hat keine Lebenskarten.',
  'This game has no market cards.': 'Dieses Spiel hat keine Marktkarten.',
  'This market is not open for selling now.': 'Dieser Markt ist jetzt nicht zum Verkaufen offen.',
  'This moment cannot be applied now.': 'Dieser Moment kann jetzt nicht angewendet werden.',
  'This pile has no card for you now.': 'Dieser Stapel hat jetzt keine Karte für dich.',
};

/** A message of the game service in the language of the game. */
export function gameError(message: string, lang: string | undefined): string {
  return lang === 'de' ? (GAME_ERRORS_DE[message] ?? message) : message;
}
