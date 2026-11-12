import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsFor, getCaller } from "../_shared/auth.ts";

const IG_TOKEN   = Deno.env.get("INSTAGRAM_ACCESS_TOKEN") ?? "";
const IG_USER_ID = Deno.env.get("INSTAGRAM_USER_ID") ?? "";
const BASE       = "https://graph.instagram.com/v22.0";

interface PublishRequest {
  imageUrls: string[];
  caption:   string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function igPost(endpoint: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({ ...params, access_token: IG_TOKEN });
  const res  = await fetch(`${BASE}${endpoint}`, { method: "POST", body });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok || data.error) {
    const msg = (data.error as Record<string, unknown>)?.message ?? JSON.stringify(data);
    throw new Error(String(msg));
  }
  return data;
}

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Publica en la cuenta real de la tienda: solo admins.
  const caller = await getCaller(req);
  if (!caller?.isAdmin) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!IG_TOKEN || !IG_USER_ID) throw new Error("Instagram secrets not configured");

    const { imageUrls, caption }: PublishRequest = await req.json();
    if (!imageUrls?.length) throw new Error("No images provided");

    const urls = imageUrls.slice(0, 10);
    let creationId: string;

    if (urls.length === 1) {
      const data = await igPost(`/${IG_USER_ID}/media`, { image_url: urls[0], caption });
      creationId = data.id as string;
      await sleep(3000);
    } else {
      // Create each carousel item sequentially to avoid rate limits
      const childIds: string[] = [];
      for (const url of urls) {
        const data = await igPost(`/${IG_USER_ID}/media`, {
          image_url:        url,
          is_carousel_item: "true",
        });
        childIds.push(data.id as string);
        await sleep(1000);
      }

      // Wait for Instagram to process all items before creating the carousel
      await sleep(8000);

      const carousel = await igPost(`/${IG_USER_ID}/media`, {
        media_type: "CAROUSEL",
        children:   childIds.join(","),
        caption,
      });
      creationId = carousel.id as string;
      await sleep(3000);
    }

    const result = await igPost(`/${IG_USER_ID}/media_publish`, { creation_id: creationId });

    return new Response(
      JSON.stringify({ success: true, postId: result.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
