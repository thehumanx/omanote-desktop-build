/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as actions_linkPreview from "../actions/linkPreview.js";
import type * as actions_rssFetch from "../actions/rssFetch.js";
import type * as admin from "../admin.js";
import type * as bookmarks from "../bookmarks.js";
import type * as canvas from "../canvas.js";
import type * as crons from "../crons.js";
import type * as desktopAuth from "../desktopAuth.js";
import type * as devices from "../devices.js";
import type * as encryptionKeys from "../encryptionKeys.js";
import type * as events from "../events.js";
import type * as feedback from "../feedback.js";
import type * as hashtags from "../hashtags.js";
import type * as history from "../history.js";
import type * as insights from "../insights.js";
import type * as lib_rssParser from "../lib/rssParser.js";
import type * as notes from "../notes.js";
import type * as plans from "../plans.js";
import type * as pushSubscriptions from "../pushSubscriptions.js";
import type * as reminderPush from "../reminderPush.js";
import type * as reminderPushHelpers from "../reminderPushHelpers.js";
import type * as rss from "../rss.js";
import type * as shareViews from "../shareViews.js";
import type * as sharedFolders from "../sharedFolders.js";
import type * as sharedNoteFolders from "../sharedNoteFolders.js";
import type * as todos from "../todos.js";
import type * as userSettings from "../userSettings.js";
import type * as utils from "../utils.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  "actions/linkPreview": typeof actions_linkPreview;
  "actions/rssFetch": typeof actions_rssFetch;
  admin: typeof admin;
  bookmarks: typeof bookmarks;
  canvas: typeof canvas;
  crons: typeof crons;
  desktopAuth: typeof desktopAuth;
  devices: typeof devices;
  encryptionKeys: typeof encryptionKeys;
  events: typeof events;
  feedback: typeof feedback;
  hashtags: typeof hashtags;
  history: typeof history;
  insights: typeof insights;
  "lib/rssParser": typeof lib_rssParser;
  notes: typeof notes;
  plans: typeof plans;
  pushSubscriptions: typeof pushSubscriptions;
  reminderPush: typeof reminderPush;
  reminderPushHelpers: typeof reminderPushHelpers;
  rss: typeof rss;
  shareViews: typeof shareViews;
  sharedFolders: typeof sharedFolders;
  sharedNoteFolders: typeof sharedNoteFolders;
  todos: typeof todos;
  userSettings: typeof userSettings;
  utils: typeof utils;
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
