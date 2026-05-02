import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInviteCode, generateInviteCode } from '../src/features/arena/utils/inviteCode.js';
import { normalizeRoomSlug, generateRoomSlug, buildRoomUrl, extractRoomSlugFromUrl } from '../src/features/arena/utils/roomLink.js';
import { dbBubbleToRuntimeBubble, runtimeBubbleToDbInsert, runtimeBubbleToDbPatch } from '../src/features/arena/utils/arenaMappers.js';
import { getOrCreateHostArena, joinArenaByCode, loadPublicArenaByCode, publishHostArena, updateArenaGuestRole } from '../src/features/arena/services/arenaService.js';
import { normalizeGuestPseudo, validateGuestPseudo, saveGuestPseudo, getStoredGuestPseudo } from '../src/features/arena/utils/guestIdentity.js';

test('normalizeInviteCode', () => {
  assert.equal(normalizeInviteCode(' ab c-12o '), 'ABC2');
});

test('generateInviteCode', () => {
  const code = generateInviteCode();
  assert.equal(code.length, 6);
  assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
});

test('roomLink utils', () => {
  assert.equal(normalizeRoomSlug(' room-abc 123 '), 'RMABC23');
  const slug = generateRoomSlug(10);
  assert.equal(slug.length, 10);
  const url = buildRoomUrl({ origin: 'https://example.com/app', roomSlug: 'room-abc' });
  assert.equal(url, 'https://example.com/app?room=RMABC');
  assert.equal(extractRoomSlugFromUrl(new URLSearchParams('?arenaInvite=ROOMabc99')), 'RMABC99');
  assert.equal(extractRoomSlugFromUrl(new URLSearchParams('?arenaInvite=local')), '');
});

test('db/runtime bubble mappings', () => {
  const db = { id: '1', sample_id: 's', label: 'L', x: 1, y: 2, radius: 3, hue: 4, layer: 'front', halo_style: 'aurora', version: 2 };
  const runtime = dbBubbleToRuntimeBubble(db);
  assert.equal(runtime.r, 3);
  const insert = runtimeBubbleToDbInsert({ arenaId: 'a', userId: 'u', bubble: runtime });
  assert.equal(insert.arena_id, 'a');
  const patch = runtimeBubbleToDbPatch({ ...runtime, version: 2 }, { x: 9 });
  assert.equal(patch.x, 9);
  assert.equal(patch.version, 3);
});

test('joinArenaByCode empty code', async () => {
  const res = await joinArenaByCode({ supabase: {}, userId: 'u', inviteCode: '   ' });
  assert.equal(res.error.message, 'Code d’invitation requis');
});

test('validation roles invités', async () => {
  const res = await updateArenaGuestRole({ supabase: {}, arenaId: 'a', guestId: 'g', role: 'host' });
  assert.equal(res.error.message, 'Rôle invité invalide. Rôles autorisés: viewer, player, cohost.');
});

test('guest pseudo normalization and validation', () => {
  assert.equal(normalizeGuestPseudo('  Écho   Plume  '), 'Écho Plume');
  assert.equal(validateGuestPseudo('Pier').ok, true);
  assert.equal(validateGuestPseudo('Nina_44').ok, true);
  assert.equal(validateGuestPseudo('Écho Plume').ok, true);
  assert.equal(validateGuestPseudo('').ok, false);
  assert.equal(validateGuestPseudo('A').reason, 'Pseudo trop court');
  assert.equal(validateGuestPseudo('a'.repeat(25)).reason, 'Pseudo trop long');
});

test('save/get guest pseudo by roomSlug', () => {
  global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
  };
  saveGuestPseudo({ roomSlug: 'roomslug123', pseudo: 'Pier' });
  assert.equal(getStoredGuestPseudo({ roomSlug: 'ROOMSLUG123' }), 'Pier');
});

test('getOrCreateHostArena returns existing arena', async () => {
  const existing = { id: 'a1', owner_id: 'u1', invite_code: 'RMABC12', status: 'draft', is_active: true };
  const supabase = {
    from() {
      return {
        select() { return this; }, eq() { return this; }, neq() { return this; }, order() { return this; }, limit() { return this; },
        async maybeSingle() { return { data: existing, error: null }; },
      };
    },
  };
  const res = await getOrCreateHostArena({ supabase, userId: 'u1' });
  assert.equal(res.error, null);
  assert.equal(res.data.id, 'a1');
});

test('getOrCreateHostArena creates arena if missing', async () => {
  let inserted = false;
  const supabase = {
    from(table) {
      if (table === 'arenas') {
        return {
          select() { return this; }, eq() { return this; }, neq() { return this; }, order() { return this; }, limit() { return this; },
          async maybeSingle() { return { data: null, error: null }; },
          insert() { inserted = true; return this; }, single() { return Promise.resolve({ data: { id: 'a2', invite_code: 'RMNEW12', status: 'draft' }, error: null }); },
        };
      }
      return { upsert: async () => ({ error: null }) };
    },
  };
  const res = await getOrCreateHostArena({ supabase, userId: 'u2' });
  assert.equal(inserted, true);
  assert.equal(res.error, null);
  assert.equal(res.data.id, 'a2');
});

test('publishHostArena returns visitor link', async () => {
  const supabase = {
    from() {
      return {
        select() { return this; }, eq() { return this; }, neq() { return this; }, order() { return this; }, limit() { return this; },
        async maybeSingle() { return { data: { id: 'a1', owner_id: 'u1', invite_code: 'RMABC12', status: 'draft', is_active: true }, error: null }; },
        update() { return this; }, single() { return Promise.resolve({ data: { id: 'a1', invite_code: 'RMABC12', status: 'published' }, error: null }); },
      };
    },
  };
  const res = await publishHostArena({ supabase, userId: 'u1', origin: 'https://example.com/app' });
  assert.equal(res.error, null);
  assert.equal(res.data.visitUrl, 'https://example.com/app?room=RMABC2');
});

test('loadPublicArenaByCode only loads published arena', async () => {
  const publishedSupabase = {
    from() {
      return {
        select() { return this; }, eq() { return this; },
        async maybeSingle() { return { data: { id: 'p1', status: 'published' }, error: null }; },
      };
    },
  };
  const okRes = await loadPublicArenaByCode({ supabase: publishedSupabase, roomSlug: 'RMXYZ12' });
  assert.equal(okRes.error, null);
  assert.equal(okRes.data.id, 'p1');
});
