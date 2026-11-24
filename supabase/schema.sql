-- 墨场专用 Supabase 数据表与版本校验保存函数。
-- 运行于项目 SQL Editor；请勿关闭 RLS，不要把 service_role / secret key 交给浏览器。
create table if not exists public.mochang_documents (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null,
 revision bigint not null default 0 check (revision >= 0),
 updated_at timestamptz not null default now()
);
alter table public.mochang_documents enable row level security;
revoke all on table public.mochang_documents from public, anon;
grant select, insert, update on table public.mochang_documents to authenticated;

drop policy if exists "mochang_read_own" on public.mochang_documents;
drop policy if exists "mochang_insert_own" on public.mochang_documents;
drop policy if exists "mochang_update_own" on public.mochang_documents;
create policy "mochang_read_own" on public.mochang_documents
 for select to authenticated using (user_id = (select auth.uid()));
create policy "mochang_insert_own" on public.mochang_documents
 for insert to authenticated with check (user_id = (select auth.uid()));
create policy "mochang_update_own" on public.mochang_documents
 for update to authenticated using (user_id = (select auth.uid()))
 with check (user_id = (select auth.uid()));

create or replace function public.mochang_save(p_data jsonb, p_expected_revision bigint)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
 v_uid uuid;
 v_revision bigint;
 v_updated timestamptz;
begin
 v_uid := (select auth.uid());
 if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
 if p_data is null or jsonb_typeof(p_data) <> 'object'
   or jsonb_typeof(p_data->'projects') <> 'array' then
   raise exception 'INVALID_DOCUMENT';
 end if;
 if octet_length(p_data::text) > 5242880 then
   raise exception 'DOCUMENT_TOO_LARGE';
 end if;
 if p_expected_revision is null or p_expected_revision < 0 then
   raise exception 'INVALID_REVISION';
 end if;

 update public.mochang_documents d
 set data = p_data, revision = d.revision + 1, updated_at = now()
 where d.user_id = v_uid and d.revision = p_expected_revision
 returning d.revision, d.updated_at into v_revision, v_updated;
 if found then
   return jsonb_build_object('revision',v_revision,'updated_at',v_updated);
 end if;

 if p_expected_revision = 0 then
   insert into public.mochang_documents(user_id,data,revision,updated_at)
   values(v_uid,p_data,1,now())
   on conflict (user_id) do nothing
   returning revision,updated_at into v_revision,v_updated;
   if found then
     return jsonb_build_object('revision',v_revision,'updated_at',v_updated);
   end if;
 end if;

 raise exception 'SYNC_CONFLICT';
end
$$;
revoke all on function public.mochang_save(jsonb,bigint) from public,anon;
grant execute on function public.mochang_save(jsonb,bigint) to authenticated;
