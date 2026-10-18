/**
 * What a refusal of the server says, in the app's six languages, by the `code` of its Problem Details. The server's own `detail` is
 * English (the rules' words, also for agents); the codes below are the ones a player meets, so they are shown in the player's
 * language. A rule refusal (`table_illegal_move`) keeps the server's words - the rule's explanation is different every time.
 * Like the other tables texts, not in src/assets/i18n (those ship to the Firebase edition). es/fr/cn/ar need a native review.
 */
type Lang = 'en' | 'de' | 'es' | 'fr' | 'cn' | 'ar';

const CODES = [
  'table_not_your_turn',
  'table_paused',
  'table_time_up',
  'table_wrong_phase',
  'table_table_full',
  'table_already_joined',
  'table_not_ready',
  'table_not_enough_players',
  'table_not_host',
  'table_not_a_member',
  'table_bot_duplicate',
  'table_profession_taken',
  'room_limit',
  'room_not_found',
  'room_conflict',
  'room_kept',
  'room_has_players',
  'room_still_playing',
  'room_forbidden',
  'room_not_over',
  'filing_in_progress',
  'game_storage_full',
  'stream_limit',
] as const;

type Code = (typeof CODES)[number];

const en: Record<Code, string> = {
  table_not_your_turn: 'It is not your turn.',
  table_paused: 'The game is paused.',
  table_time_up: 'Your time is up.',
  table_wrong_phase: 'That is not possible at this stage of the game.',
  table_table_full: 'The table is full.',
  table_already_joined: 'You are already at this table.',
  table_not_ready: 'Not everybody is ready yet.',
  table_not_enough_players: 'There are not enough players to start.',
  table_not_host: 'Only the host can do that.',
  table_not_a_member: 'You are not at this table.',
  table_bot_duplicate: 'That bot (this strategy at this level) already sits at the table.',
  table_profession_taken: 'Somebody has that profession already.',
  room_limit: 'You sit at or host too many tables: leave or remove one first.',
  room_not_found: 'There is no table with that id or code.',
  room_conflict: 'The table changed at the same moment: try again.',
  room_kept: 'Players saved this game: the table stays as their record and cannot be removed.',
  room_has_players: 'Other players are at this table: leave the game instead of removing it.',
  room_still_playing: 'You are still playing at this table: leave the game first.',
  room_forbidden: 'You are not allowed to do that at this table.',
  room_not_over: 'The game is still being played: save it when it is over.',
  filing_in_progress: 'This game is being saved right now.',
  game_storage_full: 'Your saved games are full: delete some first.',
  stream_limit: 'You have too many live connections open: close one first.',
};

const de: Record<Code, string> = {
  table_not_your_turn: 'Du bist nicht dran.',
  table_paused: 'Das Spiel ist pausiert.',
  table_time_up: 'Deine Zeit ist abgelaufen.',
  table_wrong_phase: 'Das ist in dieser Phase des Spiels nicht möglich.',
  table_table_full: 'Der Tisch ist voll.',
  table_already_joined: 'Du sitzt schon an diesem Tisch.',
  table_not_ready: 'Noch nicht alle sind bereit.',
  table_not_enough_players: 'Es sind nicht genug Spieler zum Starten da.',
  table_not_host: 'Das kann nur der Gastgeber.',
  table_not_a_member: 'Du sitzt nicht an diesem Tisch.',
  table_bot_duplicate: 'Dieser Bot (diese Strategie auf dieser Stufe) sitzt schon am Tisch.',
  table_profession_taken: 'Diesen Beruf hat schon jemand.',
  room_limit: 'Du sitzt an oder leitest zu viele Tische: verlasse oder entferne erst einen.',
  room_not_found: 'Es gibt keinen Tisch mit dieser Kennung oder diesem Code.',
  room_conflict: 'Der Tisch hat sich im selben Moment geändert: versuche es noch einmal.',
  room_kept:
    'Spieler haben dieses Spiel gespeichert: der Tisch bleibt als ihre Aufzeichnung und kann nicht entfernt werden.',
  room_has_players:
    'Andere Spieler sitzen an diesem Tisch: verlasse das Spiel, statt den Tisch zu entfernen.',
  room_still_playing: 'Du spielst noch an diesem Tisch: verlasse zuerst das Spiel.',
  room_forbidden: 'Das darfst du an diesem Tisch nicht.',
  room_not_over: 'Das Spiel läuft noch: speichere es, wenn es vorbei ist.',
  filing_in_progress: 'Dieses Spiel wird gerade gespeichert.',
  game_storage_full: 'Deine gespeicherten Spiele sind voll: lösche zuerst einige.',
  stream_limit: 'Du hast zu viele Live-Verbindungen offen: schließe eine.',
};

const es: Record<Code, string> = {
  table_not_your_turn: 'No es tu turno.',
  table_paused: 'La partida está en pausa.',
  table_time_up: 'Se acabó tu tiempo.',
  table_wrong_phase: 'Eso no es posible en esta fase del juego.',
  table_table_full: 'La mesa está llena.',
  table_already_joined: 'Ya estás en esta mesa.',
  table_not_ready: 'Todavía no todos están listos.',
  table_not_enough_players: 'No hay jugadores suficientes para empezar.',
  table_not_host: 'Solo el anfitrión puede hacerlo.',
  table_not_a_member: 'No estás en esta mesa.',
  table_bot_duplicate: 'Ese bot (esta estrategia en este nivel) ya está en la mesa.',
  table_profession_taken: 'Alguien ya tiene esa profesión.',
  room_limit: 'Estás o alojas demasiadas mesas: sal de una o quítala primero.',
  room_not_found: 'No hay ninguna mesa con ese id o código.',
  room_conflict: 'La mesa cambió en el mismo momento: inténtalo otra vez.',
  room_kept:
    'Hay jugadores que guardaron esta partida: la mesa queda como su registro y no se puede quitar.',
  room_has_players: 'Hay otros jugadores en esta mesa: abandona la partida en vez de quitarla.',
  room_still_playing: 'Todavía juegas en esta mesa: abandona la partida primero.',
  room_forbidden: 'No puedes hacer eso en esta mesa.',
  room_not_over: 'La partida sigue en juego: guárdala cuando termine.',
  filing_in_progress: 'Esta partida se está guardando ahora mismo.',
  game_storage_full: 'Tus partidas guardadas están llenas: borra algunas primero.',
  stream_limit: 'Tienes demasiadas conexiones en vivo abiertas: cierra una.',
};

const fr: Record<Code, string> = {
  table_not_your_turn: "Ce n'est pas ton tour.",
  table_paused: 'La partie est en pause.',
  table_time_up: 'Ton temps est écoulé.',
  table_wrong_phase: "Ce n'est pas possible à ce stade de la partie.",
  table_table_full: 'La table est pleine.',
  table_already_joined: 'Tu es déjà à cette table.',
  table_not_ready: "Tout le monde n'est pas encore prêt.",
  table_not_enough_players: "Il n'y a pas assez de joueurs pour commencer.",
  table_not_host: "Seul l'hôte peut le faire.",
  table_not_a_member: "Tu n'es pas à cette table.",
  table_bot_duplicate: 'Ce bot (cette stratégie à ce niveau) est déjà à la table.',
  table_profession_taken: 'Quelqu’un a déjà ce métier.',
  room_limit: 'Tu es à ou héberges trop de tables : quitte-en ou supprime-en une d’abord.',
  room_not_found: 'Aucune table avec cet identifiant ou ce code.',
  room_conflict: 'La table a changé au même moment : réessaie.',
  room_kept:
    'Des joueurs ont enregistré cette partie : la table reste comme leur trace et ne peut pas être supprimée.',
  room_has_players:
    "D'autres joueurs sont à cette table : quitte la partie au lieu de la supprimer.",
  room_still_playing: "Tu joues encore à cette table : quitte d'abord la partie.",
  room_forbidden: "Tu n'as pas le droit de faire cela à cette table.",
  room_not_over: 'La partie est encore en cours : enregistre-la quand elle est finie.',
  filing_in_progress: 'Cette partie est en cours d’enregistrement.',
  game_storage_full: 'Tes parties enregistrées sont pleines : supprime-en d’abord.',
  stream_limit: 'Tu as trop de connexions en direct ouvertes : ferme-en une.',
};

const cn: Record<Code, string> = {
  table_not_your_turn: '还没轮到你。',
  table_paused: '游戏已暂停。',
  table_time_up: '你的时间到了。',
  table_wrong_phase: '在游戏的这个阶段不能这样做。',
  table_table_full: '牌桌已满。',
  table_already_joined: '你已经在这张牌桌上。',
  table_not_ready: '还不是所有人都准备好了。',
  table_not_enough_players: '玩家不够，无法开始。',
  table_not_host: '只有主持人可以这样做。',
  table_not_a_member: '你不在这张牌桌上。',
  table_bot_duplicate: '这个机器人（该策略的该等级）已经在牌桌上。',
  table_profession_taken: '已经有人选了这个职业。',
  room_limit: '你加入或主持的牌桌太多：请先离开或移除一张。',
  room_not_found: '没有这个编号或邀请码的牌桌。',
  room_conflict: '牌桌在同一时刻发生了变化：请再试一次。',
  room_kept: '有玩家保存了这局游戏：牌桌会作为他们的记录保留，无法移除。',
  room_has_players: '牌桌上还有其他玩家：请退出游戏，而不是移除牌桌。',
  room_still_playing: '你仍在这张牌桌上游戏：请先退出游戏。',
  room_forbidden: '你不能在这张牌桌上这样做。',
  room_not_over: '游戏仍在进行：结束后再保存。',
  filing_in_progress: '这局游戏正在保存。',
  game_storage_full: '你保存的游戏已满：请先删除一些。',
  stream_limit: '你打开的实时连接太多：请关闭一个。',
};

const ar: Record<Code, string> = {
  table_not_your_turn: 'ليس دورك.',
  table_paused: 'اللعبة متوقفة مؤقتاً.',
  table_time_up: 'انتهى وقتك.',
  table_wrong_phase: 'هذا غير ممكن في هذه المرحلة من اللعبة.',
  table_table_full: 'الطاولة ممتلئة.',
  table_already_joined: 'أنت على هذه الطاولة بالفعل.',
  table_not_ready: 'ليس الجميع جاهزين بعد.',
  table_not_enough_players: 'لا يوجد عدد كافٍ من اللاعبين للبدء.',
  table_not_host: 'المضيف وحده يستطيع ذلك.',
  table_not_a_member: 'أنت لست على هذه الطاولة.',
  table_bot_duplicate: 'هذا الروبوت (هذه الاستراتيجية بهذا المستوى) موجود على الطاولة بالفعل.',
  table_profession_taken: 'لدى شخص ما هذه المهنة بالفعل.',
  room_limit: 'أنت على طاولات كثيرة أو تستضيفها: غادر واحدة أو أزلها أولاً.',
  room_not_found: 'لا توجد طاولة بهذا المعرّف أو الرمز.',
  room_conflict: 'تغيّرت الطاولة في اللحظة نفسها: حاول مرة أخرى.',
  room_kept: 'حفظ لاعبون هذه اللعبة: تبقى الطاولة كسجلّ لهم ولا يمكن إزالتها.',
  room_has_players: 'هناك لاعبون آخرون على هذه الطاولة: غادر اللعبة بدلاً من إزالتها.',
  room_still_playing: 'ما زلت تلعب على هذه الطاولة: غادر اللعبة أولاً.',
  room_forbidden: 'لا يُسمح لك بذلك على هذه الطاولة.',
  room_not_over: 'اللعبة ما زالت جارية: احفظها عند انتهائها.',
  filing_in_progress: 'يجري حفظ هذه اللعبة الآن.',
  game_storage_full: 'ألعابك المحفوظة ممتلئة: احذف بعضها أولاً.',
  stream_limit: 'لديك اتصالات مباشرة كثيرة مفتوحة: أغلق واحداً.',
};

const DICTIONARIES: Record<Lang, Record<Code, string>> = { en, de, es, fr, cn, ar };

/**
 * The words for a refusal in the player's language: by its Problem `code` when it is one a player meets, otherwise the server's own
 * `detail` (a rule's explanation stays as the server worded it).
 */
export function problemText(
  lang: string | undefined | null,
  code: string | undefined,
  detail: string | undefined,
): string | undefined {
  const short = (lang ?? 'en').toLowerCase().slice(0, 2);
  const key = (short === 'zh' ? 'cn' : short) as Lang;
  const words = DICTIONARIES[key] ?? en;
  if (code && (CODES as readonly string[]).includes(code)) return words[code as Code];
  return detail;
}
