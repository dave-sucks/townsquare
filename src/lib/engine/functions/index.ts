import type { InngestFunction } from "inngest";
import { placeRefresh } from "./place-refresh";
import { postProcess } from "./post-process";
import { dailySync, syncSource } from "./source-sync";

/** Every engine function, served from /api/inngest. */
export const functions: InngestFunction.Like[] = [syncSource, dailySync, postProcess, placeRefresh];
