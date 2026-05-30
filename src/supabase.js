// Supabase 클라이언트 — 루트 medvis 앱 config.js에서 이식.
// publishable key는 client-side 노출 전제(현재 RLS off). 기존 루트 앱과 동일한 키/리스크.
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://jmojkseooezbxmdyblyl.supabase.co";
export const SUPABASE_KEY = "sb_publishable_qvMBn2zBB77pwouVOrpKcg_fqPy3ZIq";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
