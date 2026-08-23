export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API - LISTAR PERFUMES
    if (url.pathname === "/api/perfumes" && request.method === "GET") {
      const { results } = await env.DB.prepare(`
        SELECT *
        FROM perfumes
        WHERE active = 1
        ORDER BY brand, name
      `).all();

      return Response.json(results);
    }

    // API - CREAR PERFUME
    if (url.pathname === "/api/perfumes" && request.method === "POST") {
      const data = await request.json();

      if (!data.name || !data.brand) {
        return Response.json(
          { error: "Nombre y marca son obligatorios" },
          { status: 400 }
        );
      }

      const result = await env.DB.prepare(`
        INSERT INTO perfumes (
          name,
          brand,
          gender,
          description_es,
          description_en,
          image_url,
          price,
          currency,
          notes_top,
          notes_heart,
          notes_base,
          accords,
          styles,
          season,
          occasion,
          longevity,
          projection,
          sweetness,
          freshness,
          active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).bind(
        data.name,
        data.brand,
        data.gender || "",
        data.description_es || "",
        data.description_en || "",
        data.image_url || "",
        Number(data.price) || 0,
        data.currency || "EUR",
        data.notes_top || "",
        data.notes_heart || "",
        data.notes_base || "",
        data.accords || "",
        data.styles || "",
        data.season || "",
        data.occasion || "",
        Number(data.longevity) || 0,
        Number(data.projection) || 0,
        Number(data.sweetness) || 0,
        Number(data.freshness) || 0
      ).run();

      return Response.json({
        success: true,
        id: result.meta.last_row_id
      });
    }

    // API - ACTUALIZAR PERFUME
    const perfumeMatch = url.pathname.match(/^\/api\/perfumes\/(\d+)$/);

    if (perfumeMatch && request.method === "PUT") {
      const id = Number(perfumeMatch[1]);
      const data = await request.json();

      await env.DB.prepare(`
        UPDATE perfumes SET
          name = ?,
          brand = ?,
          gender = ?,
          description_es = ?,
          description_en = ?,
          image_url = ?,
          price = ?,
          currency = ?,
          notes_top = ?,
          notes_heart = ?,
          notes_base = ?,
          accords = ?,
          styles = ?,
          season = ?,
          occasion = ?,
          longevity = ?,
          projection = ?,
          sweetness = ?,
          freshness = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        data.name,
        data.brand,
        data.gender || "",
        data.description_es || "",
        data.description_en || "",
        data.image_url || "",
        Number(data.price) || 0,
        data.currency || "EUR",
        data.notes_top || "",
        data.notes_heart || "",
        data.notes_base || "",
        data.accords || "",
        data.styles || "",
        data.season || "",
        data.occasion || "",
        Number(data.longevity) || 0,
        Number(data.projection) || 0,
        Number(data.sweetness) || 0,
        Number(data.freshness) || 0,
        id
      ).run();

      return Response.json({ success: true });
    }

    // API - ELIMINAR PERFUME
    if (perfumeMatch && request.method === "DELETE") {
      const id = Number(perfumeMatch[1]);

      await env.DB.prepare(`
        UPDATE perfumes
        SET active = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(id).run();

      return Response.json({ success: true });
    }

    // Todo lo demás: servir la web normal
    return env.ASSETS.fetch(request);
  }
};
