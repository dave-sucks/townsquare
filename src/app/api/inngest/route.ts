import { serve } from "inngest/next";
import { inngest } from "@/lib/engine/inngest";
import { functions } from "@/lib/engine/functions";

// Long stages (an Apify sync poll, a model call) run inside one step.
export const maxDuration = 800;

export const { GET, POST, PUT } = serve({ client: inngest, functions });
