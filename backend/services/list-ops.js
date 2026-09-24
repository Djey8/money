'use strict';

/**
 * Item-level edits of a project's lists (action items, notes, links), so a
 * caller changes one entry without resending — and risking truncating or
 * corrupting — the whole list. Shared by Grow and Smile/Fire.
 */

/** The app's own defaults for a new action item (`addActionItem` in the add/info panels). */
function normalizeActionItem(item) {
  return {
    text: item.text,
    done: item.done ?? false,
    priority: item.priority ?? 'medium',
    ...(item.dueDate !== undefined && item.dueDate !== null && { dueDate: item.dueDate }),
  };
}

function normalizeNote(note, now) {
  return { text: note.text, createdAt: note.createdAt ?? now };
}

function normalizeLink(link) {
  return { label: link.label, url: link.url };
}

function listOpError(message, code = 'GROW_INVALID_PLAN') {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Item-level edits of one of a project's lists, so a caller changes one
 * action item/note/link without resending (and risking corrupting) the
 * whole list. Indices refer to the list as it was before this request;
 * updates apply first, then removals, then additions are appended.
 */
function applyListOps(
  list,
  { add, update, remove },
  name,
  { normalizeAdd, mergeUpdate, errorCode },
) {
  let next = [...list];
  for (const change of update || []) {
    if (change.index < 0 || change.index >= list.length) {
      throw listOpError(
        `${name}Update index ${change.index} is out of range (0-${list.length - 1}).`,
        errorCode,
      );
    }
    next[change.index] = mergeUpdate(next[change.index], change);
  }
  if (remove && remove.length > 0) {
    for (const index of remove) {
      if (index < 0 || index >= list.length) {
        throw listOpError(
          `${name}Remove index ${index} is out of range (0-${list.length - 1}).`,
          errorCode,
        );
      }
    }
    const removed = new Set(remove);
    next = next.filter((_, index) => !removed.has(index));
  }
  return [...next, ...(add || []).map(normalizeAdd)];
}

function applyAllListOps(project, patch, now, errorCode = 'GROW_INVALID_PLAN') {
  const next = { ...project };
  if (patch.actionItemsAdd || patch.actionItemsUpdate || patch.actionItemsRemove) {
    next.actionItems = applyListOps(
      project.actionItems || [],
      {
        add: patch.actionItemsAdd,
        update: patch.actionItemsUpdate,
        remove: patch.actionItemsRemove,
      },
      'actionItems',
      {
        errorCode,
        normalizeAdd: normalizeActionItem,
        mergeUpdate: (item, { index: _index, ...fields }) => {
          const merged = { ...item, ...fields };
          if (fields.dueDate === null) delete merged.dueDate;
          return merged;
        },
      },
    );
  }
  if (patch.notesAdd || patch.notesUpdate || patch.notesRemove) {
    next.notes = applyListOps(
      project.notes || [],
      { add: patch.notesAdd, update: patch.notesUpdate, remove: patch.notesRemove },
      'notes',
      {
        errorCode,
        normalizeAdd: (note) => normalizeNote(note, now),
        mergeUpdate: (note, { text }) => ({ ...note, ...(text !== undefined && { text }) }),
      },
    );
  }
  if (patch.linksAdd || patch.linksUpdate || patch.linksRemove) {
    next.links = applyListOps(
      project.links || [],
      { add: patch.linksAdd, update: patch.linksUpdate, remove: patch.linksRemove },
      'links',
      {
        errorCode,
        normalizeAdd: normalizeLink,
        mergeUpdate: (link, { index: _index, ...fields }) => ({ ...link, ...fields }),
      },
    );
  }
  return next;
}

module.exports = {
  normalizeActionItem,
  normalizeNote,
  normalizeLink,
  listOpError,
  applyListOps,
  applyAllListOps,
};
