/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentActivity from "../agentActivity.js";
import type * as board from "../board.js";
import type * as flowMap from "../flowMap.js";
import type * as gatekeeper from "../gatekeeper.js";
import type * as gatekeeperQuery from "../gatekeeperQuery.js";
import type * as http from "../http.js";
import type * as intake from "../intake.js";
import type * as lib_activityHelper from "../lib/activityHelper.js";
import type * as modules from "../modules.js";
import type * as parsedSlides from "../parsedSlides.js";
import type * as parser from "../parser.js";
import type * as recommendations from "../recommendations.js";
import type * as reviewScores from "../reviewScores.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentActivity: typeof agentActivity;
  board: typeof board;
  flowMap: typeof flowMap;
  gatekeeper: typeof gatekeeper;
  gatekeeperQuery: typeof gatekeeperQuery;
  http: typeof http;
  intake: typeof intake;
  "lib/activityHelper": typeof lib_activityHelper;
  modules: typeof modules;
  parsedSlides: typeof parsedSlides;
  parser: typeof parser;
  recommendations: typeof recommendations;
  reviewScores: typeof reviewScores;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
