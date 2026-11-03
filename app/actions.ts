"use server";

import { auth } from "@clerk/nextjs/server";
import { refresh } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SaveResult = { ok: true } | { ok: false; error: string };

// user_id is never sent from here: the column default fills it from the
// Clerk token, and the insert policy rejects any other value.
export async function saveCity(city: { name: string; latitude: number; longitude: number }): Promise<SaveResult> {
  await auth.protect();

  const name = typeof city?.name === "string" ? city.name.trim() : "";
  const { latitude, longitude } = city ?? {};
  if (
    !name || name.length > 200 ||
    !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) || Math.abs(longitude) > 180
  ) {
    return { ok: false, error: "That city looks invalid." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("saved_cities").insert({ name, latitude, longitude });

  if (error?.code === "23505") return { ok: true }; // already in the list
  if (error?.message === "saved_cities_limit") return { ok: false, error: "You can save up to 50 cities." };
  if (error) return { ok: false, error: "Couldn't save that city. Please try again." };

  refresh();
  return { ok: true };
}

// RLS limits the delete to the signed-in user's own rows.
export async function deleteCity(id: string) {
  await auth.protect();
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid city id.");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("saved_cities").delete().eq("id", id);
  if (error) throw new Error("Couldn't remove that city.");

  refresh();
}
