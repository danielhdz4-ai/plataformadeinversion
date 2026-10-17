-- Ejecutar una vez en producción: ocultar inventario demo (mapa/scan solo status=active).
update public.listings set status = 'archived' where source_portal = 'demo';
notify pgrst, 'reload schema';
