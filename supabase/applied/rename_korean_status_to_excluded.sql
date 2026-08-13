-- Canonicalize old "한국인" visit status to "대상외".
-- Run once in Supabase SQL Editor if the live database still has the old check constraints.

update public.units
set status = '대상외'
where status = '한국인';

update public.visit_histories
set result = '대상외'
where result = '한국인';

alter table public.units
  drop constraint if exists units_status_check;

alter table public.units
  add constraint units_status_check
  check (status in ('미방문', '만남', '부재', '대상외', '거절', '확인필요'));

alter table public.visit_histories
  drop constraint if exists visit_histories_result_check;

alter table public.visit_histories
  add constraint visit_histories_result_check
  check (result in ('만남', '부재', '대상외', '거절', '확인필요'));
