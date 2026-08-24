/* Sign-in and the "already seen" list.
 *
 * Everything here is optional. If Supabase isn't configured, or the Google
 * provider isn't enabled, or the network is down, this module goes quiet and
 * the app behaves exactly as it does for anonymous visitors. Signing in is
 * never a precondition for using FilmMatch. */

const FM = (window.FM = window.FM || {});

FM.auth = (function () {
  const cfg = window.FM_CONFIG || {};
  const configured = Boolean(cfg.supabaseUrl && cfg.supabaseKey && window.supabase);

  let client = null;
  let user = null;
  let seen = new Map();          // film_id -> row
  const listeners = [];

  if (configured) {
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  }

  const notify = () => listeners.forEach(fn => fn());

  /* Google has to be switched on in the Supabase dashboard before the button
     can work, so ask the server rather than showing a control that errors. */
  async function googleEnabled() {
    if (!configured) return false;
    try {
      const res = await fetch(cfg.supabaseUrl + "/auth/v1/settings", {
        headers: { apikey: cfg.supabaseKey }
      });
      if (!res.ok) return false;
      const settings = await res.json();
      return Boolean(settings.external && settings.external.google);
    } catch (err) {
      return false;
    }
  }

  async function loadSeen() {
    seen = new Map();
    if (!user) return;
    const { data, error } = await client
      .from("seen_films")
      .select("film_id, title, year, poster, marked_at")
      .order("marked_at", { ascending: false });
    if (error) return;
    data.forEach(row => seen.set(row.film_id, row));
  }

  async function init() {
    if (!configured) return;
    const { data } = await client.auth.getSession();
    user = data.session ? data.session.user : null;
    if (user) await loadSeen();
    notify();

    client.auth.onAuthStateChange(async (_event, session) => {
      user = session ? session.user : null;
      await loadSeen();
      notify();
    });
  }

  function signIn() {
    if (!configured) return;
    /* Come back to whatever results the viewer was looking at. */
    client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: location.origin + location.pathname }
    });
  }

  async function signOut() {
    if (!configured) return;
    await client.auth.signOut();
  }

  async function markSeen(film) {
    if (!user) return false;
    const row = {
      user_id: user.id,
      film_id: film.id,
      title: film.title,
      year: film.year || null,
      poster: film.poster || null
    };
    const { error } = await client.from("seen_films").insert(row);
    if (error) return false;
    seen.set(film.id, { ...row, marked_at: new Date().toISOString() });
    notify();
    return true;
  }

  async function unmarkSeen(filmId) {
    if (!user) return false;
    const { error } = await client.from("seen_films").delete().eq("film_id", filmId);
    if (error) return false;
    seen.delete(filmId);
    notify();
    return true;
  }

  return {
    configured,
    googleEnabled,
    init,
    signIn,
    signOut,
    markSeen,
    unmarkSeen,
    isSignedIn: () => Boolean(user),
    name: () => {
      if (!user) return "";
      const meta = user.user_metadata || {};
      return meta.full_name || meta.name || user.email || "Account";
    },
    avatar: () => (user && (user.user_metadata || {}).avatar_url) || "",
    hasSeen: id => seen.has(id),
    seenIds: () => new Set(seen.keys()),
    seenList: () => [...seen.values()],
    onChange: fn => listeners.push(fn)
  };
})();
