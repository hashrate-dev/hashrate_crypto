-- Si el usuario existe en auth.users pero no en profiles (trigger falló o migración parcial),
-- esta RPC crea la fila. Llamarla desde el cliente tras login/signUp.
create or replace function public.ensure_my_profile ()
  returns void
  language plpgsql
  security definer
  set search_path = public, auth
  as $$
begin
  insert into public.profiles (id, email, first_name, second_name, first_surname, second_surname)
    select u.id,
      u.email,
      coalesce(nullif(trim(u.raw_user_meta_data ->> 'first_name'), ''), ''),
      nullif(trim(u.raw_user_meta_data ->> 'second_name'), ''),
      coalesce(nullif(trim(u.raw_user_meta_data ->> 'first_surname'), ''), ''),
      nullif(trim(u.raw_user_meta_data ->> 'second_surname'), '')
      from auth.users u
     where u.id = auth.uid ()
  on conflict (id) do nothing;
end;
$$;

grant execute on function public.ensure_my_profile () to authenticated;
