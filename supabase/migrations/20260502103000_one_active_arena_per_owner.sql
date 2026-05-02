create unique index if not exists arenas_one_active_per_owner
on public.arenas(owner_id)
where status != 'archived';
