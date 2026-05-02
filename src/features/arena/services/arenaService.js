import { buildRoomUrl, generateRoomSlug, normalizeRoomSlug } from '../utils/roomLink.js';
import { dbBubbleToRuntimeBubble, runtimeBubbleToDbInsert, runtimeBubbleToDbPatch } from '../utils/arenaMappers.js';

const fail = (message, details = null) => ({ data: null, error: { message, details } });
const ok = (data) => ({ data, error: null });

export async function getArenaByRoomSlug({ supabase, roomSlug }) {
  const code = normalizeRoomSlug(roomSlug);
  if (!supabase) return fail('Multiutilisateur indisponible : connexion Supabase requise.');
  if (!code) return fail('Arène introuvable');
  const { data, error } = await supabase.from('arenas').select('*').eq('invite_code', code).eq('is_active', true).eq('status', 'published').maybeSingle();
  if (error) return fail(error.message, error);
  if (!data) return fail('Arène introuvable');
  return ok(data);
}
export async function getArenaById({ supabase, arenaId }) { return supabase ? ok((await supabase.from('arenas').select('*').eq('id', arenaId).maybeSingle()).data) : fail('Multiutilisateur indisponible : connexion Supabase requise.'); }
export async function touchParticipant({ supabase, arenaId, userId, role = 'participant' }) {
  if (!userId) return fail('Connexion requise');
  const { error } = await supabase.from('arena_participants').upsert({ arena_id: arenaId, user_id: userId, role, last_seen_at: new Date().toISOString() }, { onConflict: 'arena_id,user_id' });
  return error ? fail(error.message, error) : ok(true);
}
export async function createHostArena({ supabase, userId, title }) {
  if (!supabase) return fail('Multiutilisateur indisponible : connexion Supabase requise.');
  if (!userId) return fail('Connexion requise');
  for (let i = 0; i < 5; i += 1) {
    const invite_code = generateRoomSlug();
    const { data, error } = await supabase.from('arenas').insert({ owner_id: userId, invite_code, title: title || 'Mon arène sonore', status: 'draft', is_active: true }).select('*').single();
    if (error?.code === '23505') continue;
    if (error) return fail(error.message, error);
    await touchParticipant({ supabase, arenaId: data.id, userId, role: 'host' });
    return ok(data);
  }
  return fail('Impossible de générer un code unique');
}
export async function joinArenaByCode({ supabase, userId, inviteCode }) {
  if (!supabase) return fail('Multiutilisateur indisponible : connexion Supabase requise.');
  if (!userId) return fail('Connexion requise');
  const code = normalizeRoomSlug(inviteCode);
  if (!code) return fail('Code d’invitation requis');
  const arenaRes = await getArenaByRoomSlug({ supabase, roomSlug: code });
  if (arenaRes.error) return arenaRes;
  const touch = await touchParticipant({ supabase, arenaId: arenaRes.data.id, userId, role: 'participant' });
  if (touch.error) return touch;
  return ok(arenaRes.data);
}

export async function getOrCreateHostArena({ supabase, userId }) {
  if (!supabase) return fail('Connexion requise pour accéder à votre arène.');
  if (!userId) return fail('Connexion requise pour accéder à votre arène.');
  const { data: existing, error: lookupError } = await supabase
    .from('arenas')
    .select('*')
    .eq('owner_id', userId)
    .neq('status', 'archived')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (lookupError) return fail(lookupError.message, lookupError);
  if (existing) return ok(existing);
  return createHostArena({ supabase, userId, title: 'Mon arène sonore' });
}

export async function publishHostArena({ supabase, userId, origin }) {
  const ensured = await getOrCreateHostArena({ supabase, userId });
  if (ensured.error) return ensured;
  const arena = ensured.data;
  const inviteCode = normalizeRoomSlug(arena.invite_code || generateRoomSlug());
  const patch = { invite_code: inviteCode, status: 'published', is_active: true, published_at: new Date().toISOString() };
  const { data, error } = await supabase.from('arenas').update(patch).eq('id', arena.id).select('*').single();
  if (error) return fail(error.message, error);
  const visitUrl = buildRoomUrl({ origin: origin || window.location.origin, roomSlug: inviteCode });
  return ok({ arena: data, visitUrl });
}

export async function loadPublicArenaByCode({ supabase, roomSlug }) {
  const code = normalizeRoomSlug(roomSlug);
  if (!supabase || !code) return fail('Aucune arène publiée ne correspond à ce lien.');
  const { data, error } = await supabase
    .from('arenas')
    .select('*')
    .eq('invite_code', code)
    .eq('status', 'published')
    .eq('is_active', true)
    .maybeSingle();
  if (error) return fail(error.message, error);
  if (!data) return fail('Aucune arène publiée ne correspond à ce lien.');
  return ok(data);
}
export async function joinRoomAsGuest({ supabase, roomSlug, guestIdentity, pseudo }) {
  if (!supabase) return fail('Multiutilisateur indisponible : connexion Supabase requise.');
  if (!guestIdentity?.id) return fail('Identité invité invalide');
  const arenaRes = await getArenaByRoomSlug({ supabase, roomSlug });
  if (arenaRes.error) return arenaRes;
  const arena = arenaRes.data;
  const { error } = await supabase.from('arena_guests').upsert({
    arena_id: arena.id,
    guest_id: guestIdentity.id,
    display_name: pseudo,
    role: 'viewer',
    is_active: true,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'arena_id,guest_id' });
  if (error) return fail(error.message, error);
  return ok(arena);
}
export async function listArenaParticipants({ supabase, arenaId }) { const { data, error } = await supabase.from('arena_participants').select('*').eq('arena_id', arenaId); return error ? fail(error.message, error) : ok(data || []); }
export async function listArenaBubbles({ supabase, arenaId }) { const { data, error } = await supabase.from('arena_bubbles').select('*').eq('arena_id', arenaId); return error ? fail(error.message, error) : ok((data || []).map(dbBubbleToRuntimeBubble)); }
export async function createArenaBubble({ supabase, arenaId, userId, bubble }) { const { data, error } = await supabase.from('arena_bubbles').insert(runtimeBubbleToDbInsert({ arenaId, userId, bubble })).select('*').single(); return error ? fail(error.message, error) : ok(dbBubbleToRuntimeBubble(data)); }
export async function updateArenaBubble({ supabase, arenaId, bubbleId, patch }) { const { data, error } = await supabase.from('arena_bubbles').update(patch).eq('arena_id', arenaId).eq('id', bubbleId).select('*').single(); return error ? fail(error.message, error) : ok(dbBubbleToRuntimeBubble(data)); }
export async function deleteArenaBubble({ supabase, arenaId, bubbleId }) { const { error } = await supabase.from('arena_bubbles').delete().eq('arena_id', arenaId).eq('id', bubbleId); return error ? fail(error.message, error) : ok(true); }

export { runtimeBubbleToDbPatch };


const ALLOWED_GUEST_ROLES = ['viewer', 'player', 'cohost'];

export async function listArenaGuests({ supabase, arenaId }) {
  if (!supabase) return fail('Multiutilisateur indisponible : connexion Supabase requise.');
  const { data, error } = await supabase.from('arena_guests').select('*').eq('arena_id', arenaId).eq('is_active', true);
  return error ? fail(error.message, error) : ok(data || []);
}

export async function touchArenaGuest({ supabase, arenaId, guestId }) {
  if (!supabase) return fail('Multiutilisateur indisponible : connexion Supabase requise.');
  const { error } = await supabase.from('arena_guests').update({ last_seen_at: new Date().toISOString() }).eq('arena_id', arenaId).eq('guest_id', guestId);
  return error ? fail(error.message, error) : ok(true);
}

export async function updateArenaGuestRole({ supabase, arenaId, guestId, role }) {
  if (!supabase) return fail('Multiutilisateur indisponible : connexion Supabase requise.');
  if (!ALLOWED_GUEST_ROLES.includes(role)) return fail('Rôle invité invalide. Rôles autorisés: viewer, player, cohost.');
  const { error } = await supabase.from('arena_guests').update({ role }).eq('arena_id', arenaId).eq('guest_id', guestId);
  return error ? fail(error.message, error) : ok(true);
}

export async function deactivateArenaGuest({ supabase, arenaId, guestId }) {
  if (!supabase) return fail('Multiutilisateur indisponible : connexion Supabase requise.');
  const { error } = await supabase.from('arena_guests').update({ is_active: false }).eq('arena_id', arenaId).eq('guest_id', guestId);
  return error ? fail(error.message, error) : ok(true);
}

export async function getArenaByInviteCode({ supabase, inviteCode }) {
  return getArenaByRoomSlug({ supabase, roomSlug: inviteCode });
}

export async function createArena(args) {
  return createHostArena(args);
}
