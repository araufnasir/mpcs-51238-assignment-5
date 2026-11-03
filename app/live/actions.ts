"use server";

import { auth } from "@clerk/nextjs/server";
import { refresh } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type FollowResult = { ok: true } | { ok: false; error: string };

// Divvy station IDs are UUIDs or long digit strings.
const isStationId = (id: unknown): id is string => typeof id === "string" && /^[\w-]{1,64}$/.test(id);

// user_id is never sent from here: the column default fills it from the
// Clerk token, and the insert policy rejects any other value.
export async function followStation(stationId: string): Promise<FollowResult> {
  await auth.protect();
  if (!isStationId(stationId)) return { ok: false, error: "That station looks invalid." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("followed_stations").insert({ station_id: stationId });

  if (error?.code === "23505") return { ok: true }; // already following
  if (error?.message === "followed_stations_limit") return { ok: false, error: "You can follow up to 50 stations." };
  if (error) return { ok: false, error: "Couldn't follow that station. Please try again." };

  refresh();
  return { ok: true };
}

// RLS limits the delete to the signed-in user's own rows.
export async function unfollowStation(stationId: string): Promise<FollowResult> {
  await auth.protect();
  if (!isStationId(stationId)) return { ok: false, error: "That station looks invalid." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("followed_stations").delete().eq("station_id", stationId);
  if (error) return { ok: false, error: "Couldn't unfollow that station. Please try again." };

  refresh();
  return { ok: true };
}
