// >>> HIER DEINE SUPABASE DATEN EINTRAGEN <<<
const SUPABASE_URL = "https://lsujbaaslkhsuaejmlhg.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzdWpiYWFzbGtoc3VhZWptbGhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1Mjk3ODUsImV4cCI6MjA4ODEwNTc4NX0.8dnAqH2W-YnnwvQz4d6shC_9m82HKYaxiunkTtKh5U8";

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

    if (upErr) {
      console.error("UPLOAD ERROR:", upErr);
      alert("Upload Fehler: " + upErr.message);
      throw upErr;
    }
  }

  const { data, error } = await sb
    .from("memories")
    .insert([{ pair_code: pairCode, title, text, photo_path }])
    .select("*")
    .single();

  if (error) {
    console.error("INSERT ERROR:", error);
    alert("Insert Fehler: " + error.message);
    throw error;
  }

  return data;
}

async function cloudDelete(pairCode, id, photo_path) {
  const { error } = await sb
    .from("memories")
    .delete()
    .eq("id", id)
    .eq("pair_code", pairCode);

  if (error) throw error;

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
  return sb
    .channel(`memories_${pairCode}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "memories", filter: `pair_code=eq.${pairCode}` },
      () => onChange()
    )
    .subscribe();
}

async function cloudUpdate(pairCode, id, patch) {
    const { error } = await sb
    .from("memories")
    .update(patch)
    .eq("id", id)
    .eq("pair_code", pairCode)

    if (error) throw error;
}

async function cloudUpdateWithPhoto(pairCode, id, patch, newFile, oldPhotoPath) {
  let photo_path = oldPhotoPath || null;

  // Wenn neues Foto gewählt wurde: hochladen + photo_path ersetzen
  if (newFile) {
    const ext = (newFile.name.split(".").pop() || "jpg").toLowerCase();
    const filename = `${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
    photo_path = `${pairCode}/${filename}`;

    const { error: upErr } = await sb
      .storage
      .from("photos")
      .upload(photo_path, newFile, { upsert: false });

    if (upErr) throw upErr;

    // altes Foto löschen (wenn vorhanden)
    if (oldPhotoPath) {
      await sb.storage.from("photos").remove([oldPhotoPath]);
    }
  }

  const { error } = await sb
    .from("memories")
    .update({ ...patch, photo_path })
    .eq("id", id)
    .eq("pair_code", pairCode);

  if (error) throw error;
}