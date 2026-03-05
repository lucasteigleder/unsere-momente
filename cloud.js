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
  return data || [];
}

/**
 * Multi Upload -> photo_paths (text[])
 */
async function cloudAdd(pairCode, title, text, files) {
  let photo_paths = null;

  const fileList = files ? Array.from(files) : [];
  if (fileList.length > 0) {
    photo_paths = [];

    for (const file of fileList) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const filename = `${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
      const path = `${pairCode}/${filename}`;

      const { error: upErr } = await sb.storage.from("photos").upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      photo_paths.push(path);
    }
  }

  const { data, error } = await sb
    .from("memories")
    .insert([{ pair_code: pairCode, title, text, photo_paths }])
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete row + delete ALL photos in storage
 */
async function cloudDelete(pairCode, id, photo_paths) {
  const { error } = await sb
    .from("memories")
    .delete()
    .eq("id", id)
    .eq("pair_code", pairCode);

  if (error) throw error;

  if (Array.isArray(photo_paths) && photo_paths.length > 0) {
    const { error: rmErr } = await sb.storage.from("photos").remove(photo_paths);
    if (rmErr) console.warn("REMOVE PHOTO ERROR:", rmErr);
  }
}

async function cloudUpdate(pairCode, id, patch) {
  const { error } = await sb
    .from("memories")
    .update(patch)
    .eq("id", id)
    .eq("pair_code", pairCode);

  if (error) throw error;
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

async function cloudUpdateWithPhotos(pairCode, id, patch, files, oldPhotoPaths) {
  let photo_paths = Array.isArray(oldPhotoPaths) ? oldPhotoPaths.slice() : [];

  const fileList = files ? Array.from(files) : [];
  const hasNewFiles = fileList.length > 0;

  // Wenn neue Dateien gewählt wurden -> alte löschen + neue hochladen + ersetzen
  if (hasNewFiles) {
    // Alte löschen
    if (photo_paths.length > 0) {
      await sb.storage.from("photos").remove(photo_paths);
    }

    // Neue hochladen
    photo_paths = [];
    for (const file of fileList) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const filename = `${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
      const path = `${pairCode}/${filename}`;

      const { error: upErr } = await sb.storage.from("photos").upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      photo_paths.push(path);
    }
  }

  // DB Update
  const { error } = await sb
    .from("memories")
    .update({ ...patch, photo_paths })
    .eq("id", id)
    .eq("pair_code", pairCode);

  if (error) throw error;
}

async function cloudUpdateWithPhotosMerge(pairCode, id, patch, newFiles, oldPhotoPaths, keepPhotoPaths) {
  const oldPaths = Array.isArray(oldPhotoPaths) ? oldPhotoPaths : [];
  const keepPaths = Array.isArray(keepPhotoPaths) ? keepPhotoPaths : [];

  // Welche alten sollen gelöscht werden?
  const toDelete = oldPaths.filter(p => !keepPaths.includes(p));

  // neue hochladen
  const fileList = newFiles ? Array.from(newFiles) : [];
  const uploaded = [];

  for (const file of fileList) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const filename = `${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
    const path = `${pairCode}/${filename}`;

    const { error: upErr } = await sb.storage.from("photos").upload(path, file, { upsert: false });
    if (upErr) throw upErr;

    uploaded.push(path);
  }

  // final: behalten + neue
  const photo_paths = [...keepPaths, ...uploaded];

  // DB update
  const { error } = await sb
    .from("memories")
    .update({ ...patch, photo_paths })
    .eq("id", id)
    .eq("pair_code", pairCode);

  if (error) throw error;

  // Storage delete (erst nach erfolgreichem DB Update)
  if (toDelete.length > 0) {
    const { error: rmErr } = await sb.storage.from("photos").remove(toDelete);
    if (rmErr) console.warn("REMOVE OLD PHOTOS ERROR:", rmErr);
  }
}