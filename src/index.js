export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =====================================================
    // IMÁGENES DESDE R2
    // =====================================================

    if (url.pathname.startsWith("/images/") && request.method === "GET") {
      const key = decodeURIComponent(url.pathname.replace("/images/", ""));

      const object = await env.IMAGES.get(key);

      if (!object) {
        return new Response("Imagen no encontrada", { status: 404 });
      }

      const headers = new Headers();

      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("Cache-Control", "public, max-age=31536000");

      return new Response(object.body, {
        headers
      });
    }


    // =====================================================
    // LISTAR PERFUMES
    // =====================================================

    if (url.pathname === "/api/perfumes" && request.method === "GET") {
      const { results } = await env.DB.prepare(`
        SELECT *
        FROM perfumes
        WHERE active = 1
        ORDER BY created_at DESC
      `).all();

      return Response.json(results);
    }


    // =====================================================
    // PRECIOS / OFERTAS DE UN PERFUME
    // =====================================================

    const pricesMatch = url.pathname.match(
      /^\/api\/perfumes\/(\d+)\/prices$/
    );

    if (pricesMatch && request.method === "GET") {
      const perfumeId = Number(pricesMatch[1]);

      const perfume = await env.DB.prepare(`
        SELECT id
        FROM perfumes
        WHERE id = ?
        AND active = 1
      `)
        .bind(perfumeId)
        .first();

      if (!perfume) {
        return Response.json(
          { error: "Perfume no encontrado" },
          { status: 404 }
        );
      }

      const { results } = await env.DB.prepare(`
        SELECT
          id,
          perfume_id,
          store,
          advertiser_id,
          product_name,
          size_ml,
          price,
          old_price,
          currency,
          product_url,
          affiliate_url,
          availability,
          source,
          external_product_id,
          updated_at
        FROM perfume_prices
        WHERE perfume_id = ?
        ORDER BY price ASC, store ASC
      `)
        .bind(perfumeId)
        .all();

      return Response.json(results);
    }


    // =====================================================
    // VER UN PERFUME
    // =====================================================

    const perfumeMatch = url.pathname.match(/^\/api\/perfumes\/(\d+)$/);

    if (perfumeMatch && request.method === "GET") {
      const id = Number(perfumeMatch[1]);

      const perfume = await env.DB.prepare(`
        SELECT *
        FROM perfumes
        WHERE id = ?
        AND active = 1
      `)
        .bind(id)
        .first();

      if (!perfume) {
        return Response.json(
          { error: "Perfume no encontrado" },
          { status: 404 }
        );
      }

      return Response.json(perfume);
    }


    // =====================================================
    // CREAR PERFUME
    // =====================================================

    if (url.pathname === "/api/perfumes" && request.method === "POST") {
      const form = await request.formData();

      const name = form.get("name")?.toString().trim();
      const brand = form.get("brand")?.toString().trim();

      if (!name || !brand) {
        return Response.json(
          { error: "Nombre y marca son obligatorios" },
          { status: 400 }
        );
      }

      let imageUrl = "";

      const image = form.get("image");

      if (image instanceof File && image.size > 0) {
        const imageResult = await saveImage(image, env);

        if (imageResult.error) {
          return Response.json(
            { error: imageResult.error },
            { status: 400 }
          );
        }

        imageUrl = imageResult.url;
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
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, 1
        )
      `)
        .bind(
          name,
          brand,
          value(form, "gender"),
          value(form, "description_es"),
          value(form, "description_en"),
          imageUrl,
          numberValue(form, "price"),
          "EUR",
          value(form, "notes_top"),
          value(form, "notes_heart"),
          value(form, "notes_base"),
          value(form, "accords"),
          value(form, "styles"),
          value(form, "season"),
          value(form, "occasion"),
          numberValue(form, "longevity"),
          numberValue(form, "projection"),
          numberValue(form, "sweetness"),
          numberValue(form, "freshness")
        )
        .run();

      return Response.json({
        success: true,
        id: result.meta.last_row_id
      });
    }


    // =====================================================
    // ACTUALIZAR PERFUME
    // =====================================================

    if (perfumeMatch && request.method === "PUT") {
      const id = Number(perfumeMatch[1]);

      const current = await env.DB.prepare(`
        SELECT *
        FROM perfumes
        WHERE id = ?
      `)
        .bind(id)
        .first();

      if (!current) {
        return Response.json(
          { error: "Perfume no encontrado" },
          { status: 404 }
        );
      }

      const form = await request.formData();

      const name = form.get("name")?.toString().trim();
      const brand = form.get("brand")?.toString().trim();

      if (!name || !brand) {
        return Response.json(
          { error: "Nombre y marca son obligatorios" },
          { status: 400 }
        );
      }

      let imageUrl = current.image_url || "";

      const image = form.get("image");

      if (image instanceof File && image.size > 0) {
        const imageResult = await saveImage(image, env);

        if (imageResult.error) {
          return Response.json(
            { error: imageResult.error },
            { status: 400 }
          );
        }

        if (current.image_url?.startsWith("/images/")) {
          const oldKey = decodeURIComponent(
            current.image_url.replace("/images/", "")
          );

          await env.IMAGES.delete(oldKey);
        }

        imageUrl = imageResult.url;
      }

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
      `)
        .bind(
          name,
          brand,
          value(form, "gender"),
          value(form, "description_es"),
          value(form, "description_en"),
          imageUrl,
          numberValue(form, "price"),
          "EUR",
          value(form, "notes_top"),
          value(form, "notes_heart"),
          value(form, "notes_base"),
          value(form, "accords"),
          value(form, "styles"),
          value(form, "season"),
          value(form, "occasion"),
          numberValue(form, "longevity"),
          numberValue(form, "projection"),
          numberValue(form, "sweetness"),
          numberValue(form, "freshness"),
          id
        )
        .run();

      return Response.json({
        success: true
      });
    }


    // =====================================================
    // ELIMINAR PERFUME
    // =====================================================

    if (perfumeMatch && request.method === "DELETE") {
      const id = Number(perfumeMatch[1]);

      await env.DB.prepare(`
        UPDATE perfumes
        SET
          active = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
        .bind(id)
        .run();

      return Response.json({
        success: true
      });
    }


    // =====================================================
    // WEB NORMAL
    // =====================================================

    return env.ASSETS.fetch(request);
  }
};


// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function value(form, name) {
  return form.get(name)?.toString().trim() || "";
}


function numberValue(form, name) {
  const value = Number(form.get(name));

  return Number.isFinite(value) ? value : 0;
}


async function saveImage(file, env) {

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    return {
      error: "Solo se permiten imágenes JPG, PNG o WEBP."
    };
  }

  if (file.size > 5 * 1024 * 1024) {
    return {
      error: "La imagen no puede superar los 5 MB."
    };
  }

  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
      ? "webp"
      : "jpg";

  const key =
    `perfumes/${crypto.randomUUID()}.${extension}`;

  await env.IMAGES.put(
    key,
    file.stream(),
    {
      httpMetadata: {
        contentType: file.type
      }
    }
  );

  return {
    url: `/images/${encodeURIComponent(key)}`
  };
}
