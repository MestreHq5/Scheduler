-- Storage bucket for uploaded .ics files (the alternative to a live feed
-- URL — see ics_feeds.kind). Private bucket; each user can only touch
-- objects under their own uid/ prefix.

insert into storage.buckets (id, name, public)
values ('ics-feeds', 'ics-feeds', false)
on conflict (id) do nothing;

create policy "ics-feeds: user can manage own files"
  on storage.objects for all
  using (bucket_id = 'ics-feeds' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'ics-feeds' and (storage.foldername(name))[1] = auth.uid()::text);
