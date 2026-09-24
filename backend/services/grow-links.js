'use strict';

/**
 * Keeps balance-sheet edits consistent with the Grow projects linked to
 * them. A Grow project links to its balance-sheet Asset/Share/Investment
 * and financing Liability by `tag === title` (and to an Investment's
 * mortgage by `M-<title>`), and embeds copies of the Investment and loan
 * values. So:
 *
 * - renaming a balance-sheet entry away from a linked project's title
 *   would silently cut the link — refused; renaming the Grow project
 *   carries the rename over instead (grow-rename.js). Renaming an unlinked
 *   entry (e.g. fixing a typo so it matches a project) is fine;
 * - editing a linked Investment or loan writes the new values into the
 *   project's embedded copy too, the way share edits already do.
 */

const { isEncryptedValue } = require('@money/domain');
const { writeValue, toStoredMoney } = require('./transaction-derived-state');

function decryptValue(value, session) {
  if (!isEncryptedValue(value)) return value;
  if (!session) throw new Error('Encrypted data requires a configured encryption key');
  return session.decrypt(value);
}

function growTitles(data, session) {
  return (data.grow || []).map((raw) => decryptValue(raw.title, session));
}

/**
 * @param {{mortgage?: boolean}} [options] liabilities also link as an Investment's `M-<title>` mortgage
 * @throws `code: 'BALANCE_TAG_LINKED_TO_GROW'` when `oldTag` is linked to a Grow project and would change
 */
function assertRenameKeepsGrowLink(data, oldTag, newTag, session, { mortgage = false } = {}) {
  if (oldTag === newTag) return;
  const linked = growTitles(data, session).find(
    (title) => title === oldTag || (mortgage && `M-${title}` === oldTag),
  );
  if (linked !== undefined) {
    const error = new Error(
      `"${oldTag}" is linked to the Grow project "${linked}"; renaming it here would cut that link. Rename the Grow project instead — the rename carries over to its balance-sheet entries and transactions.`,
    );
    error.code = 'BALANCE_TAG_LINKED_TO_GROW';
    throw error;
  }
}

/**
 * Writes `values` into the `field` (`investment` or `liabilitie`) of every
 * Grow project titled `tag` that has that embedded copy. Returns the same
 * array reference when nothing matched.
 */
function syncGrowEmbedded(rawGrow, tag, field, values, session, schemaVersion) {
  let changed = false;
  const updated = (rawGrow || []).map((raw) => {
    if (!raw[field] || decryptValue(raw.title, session) !== tag) return raw;
    changed = true;
    const encoded = {};
    for (const [key, amountMinor] of Object.entries(values)) {
      encoded[key] = writeValue(toStoredMoney(amountMinor, schemaVersion), session);
    }
    return { ...raw, [field]: { ...raw[field], ...encoded } };
  });
  return changed ? updated : rawGrow;
}

module.exports = { assertRenameKeepsGrowLink, syncGrowEmbedded };
