-- 0006_enfoca_endurecer
-- Los advisors de seguridad marcaron que al_crear_usuario() se podia invocar
-- por REST (/rest/v1/rpc/al_crear_usuario) siendo SECURITY DEFINER. Necesita
-- ser DEFINER para escribir en public.personas desde el trigger de
-- auth.users, pero nadie debe poder llamarla a mano.
revoke execute on function public.al_crear_usuario() from anon, authenticated, public;
revoke execute on function public.tocar_updated_at() from anon, authenticated, public;

comment on function public.al_crear_usuario() is
  'Trigger de auth.users: crea la fila en public.personas. SECURITY DEFINER a proposito; EXECUTE revocado a anon/authenticated.';
