// >>> HIER DEINE SUPABASE DATEN EINTRAGEN <<<
const SUPABASE_URL = "https://lsujbaaslkhsuaejmlhg.supabase.co";
const SUPABASE_ANON_KEY = "JanaLuca20072024";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function cloudList(pairCode) {
  const { data, error } = await sb
    .from("memories")
    .select("*")
    .eq("pair_code", pairCode)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

async function cloudAdd(pairCode, title, text, file) {
  let photo_path = null;

  if (file) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const filename = `${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
    photo_path = `${pairCode}/${filename}`;

    const { error: upErr } = await sb
      .storage
      .from("photos")
      .upload(photo_path, file, { upsert: false });

    if (upErr) throw upErr;
  }

  const { data, error } = await sb
    .from("memories")
    .insert([{ pair_code: pairCode, title, text, photo_path }])
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function cloudDelete(pairCode, id, photo_path) {
  // erst DB löschen
  const { error } = await sb
    .from("memories")
    .delete()
    .eq("id", id)
    .eq("pair_code", pairCode);

  if (error) throw error;

  // dann Foto löschen (falls vorhanden)
  if (photo_path) {
    await sb.storage.from("photos").remove([photo_path]);
  }
}

function photoPublicUrl(path) {
  if (!path) return null;
  const { data } = sb.storage.from("photos").getPublicUrl(path);
  return data.publicUrl || null;
}

function subscribePair(pairCode, onChange) {
  // Realtime: feuert bei Insert/Update/Delete
  return sb
    .channel(`memories_${pairCode}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "memories", filter: `pair_code=eq.${pairCode}` },
      () => onChange()
    )
    .subscribe();
}