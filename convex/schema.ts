import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  feedback: defineTable({
    message: v.string(),
    type: v.union(v.literal("feedback"), v.literal("feature")),
    anonymous: v.boolean(),
    email: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    appVersion: v.optional(v.string()),
  }),
  // Per-user submission counters kept separate from feedback rows so
  // anonymous feedback stays anonymous while still being rate-limited.
  feedbackRateLimits: defineTable({
    userId: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_userId", ["userId"]),
  todos: defineTable({
    userId: v.string(),
    clientKey: v.optional(v.string()),
    source: v.optional(v.union(v.literal("web"), v.literal("extension"))),
    title: v.string(),
    notes: v.optional(v.string()),
    hashtags: v.optional(v.array(v.string())),
    createdDateKey: v.string(),
    dueDateKey: v.optional(v.string()),
    dueTime: v.optional(v.string()),
    priority: v.union(v.literal("normal"), v.literal("high")),
    status: v.union(v.literal("open"), v.literal("done")),
    completedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    reminderFiredAt: v.optional(v.number()),
    pushJobId: v.optional(v.id("_scheduled_functions")),
    sourceNoteId: v.optional(v.id("notes")),
    folderId: v.optional(v.id("todoFolders")),
    folderName: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_user_updatedAt", ["userId", "updatedAt"])
    .index("by_user_status_createdAt", ["userId", "status", "createdAt"])
    .index("by_user_completedAt", ["userId", "completedAt"])
    .index("by_user_dueDate", ["userId", "dueDateKey"])
    .index("by_user_folderId", ["userId", "folderId"])
    .index("by_user_deletedAt", ["userId", "deletedAt"])
    .index("by_user_deletedAt_status_createdAt", ["userId", "deletedAt", "status", "createdAt"])
    .index("by_user_deletedAt_status_dueDate_createdAt", ["userId", "deletedAt", "status", "dueDateKey", "createdAt"]),
  todoFolders: defineTable({
    userId: v.string(),
    name: v.string(),
    nameLower: v.string(),
    icon: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_user_updatedAt", ["userId", "updatedAt"])
    .index("by_user_nameLower", ["userId", "nameLower"]),
  todoChecklistItems: defineTable({
    userId: v.string(),
    todoId: v.id("todos"),
    clientKey: v.optional(v.string()),
    text: v.string(),
    checked: v.boolean(),
    position: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_todoId_position", ["userId", "todoId", "position"])
    .index("by_user_todoId_checked", ["userId", "todoId", "checked"])
    .index("by_user_updatedAt", ["userId", "updatedAt"]),
  canvasArtifacts: defineTable({
    userId: v.string(),
    dateKey: v.string(),
    artifactType: v.union(v.literal("todo"), v.literal("note"), v.literal("bookmark"), v.literal("event"), v.literal("routine")),
    artifactId: v.string(),
    createdAt: v.number(),
  })
    .index("by_user_dateKey_createdAt", ["userId", "dateKey", "createdAt"])
    .index("by_user_dateKey_artifactType_createdAt", ["userId", "dateKey", "artifactType", "createdAt"])
    .index("by_user_artifact", ["userId", "artifactType", "artifactId"]),
  canvasPlacements: defineTable({
    userId: v.string(),
    dateKey: v.string(),
    artifactType: v.union(v.literal("todo"), v.literal("note"), v.literal("bookmark"), v.literal("event"), v.literal("routine")),
    artifactId: v.string(),
    position: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_dateKey_position", ["userId", "dateKey", "position"])
    .index("by_user_dateKey_artifact", ["userId", "dateKey", "artifactType", "artifactId"])
    .index("by_user_artifactType_artifactId", ["userId", "artifactType", "artifactId"])
    .index("by_user_updatedAt", ["userId", "updatedAt"]),
  notes: defineTable({
    userId: v.string(),
    clientKey: v.optional(v.string()),
    source: v.optional(v.union(v.literal("web"), v.literal("extension"))),
    title: v.optional(v.string()),
    body: v.string(),
    tags: v.array(v.string()),
    hashtags: v.optional(v.array(v.string())),
    folderId: v.optional(v.id("noteFolders")),
    folderName: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
    createdDateKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_user_updatedAt", ["userId", "updatedAt"])
    .index("by_user_folderId", ["userId", "folderId"])
    .index("by_user_deletedAt", ["userId", "deletedAt"])
    .index("by_user_deletedAt_createdAt", ["userId", "deletedAt", "createdAt"])
    .index("by_user_deletedAt_createdDateKey_createdAt", ["userId", "deletedAt", "createdDateKey", "createdAt"])
    .index("by_user_clientKey", ["userId", "clientKey"]),
  noteFolders: defineTable({
    userId: v.string(),
    name: v.string(),
    nameLower: v.string(),
    icon: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_user_updatedAt", ["userId", "updatedAt"])
    .index("by_user_nameLower", ["userId", "nameLower"]),
  bookmarkCategories: defineTable({
    userId: v.string(),
    name: v.string(),
    icon: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_user_updatedAt", ["userId", "updatedAt"]),
  bookmarks: defineTable({
    userId: v.string(),
    clientKey: v.optional(v.string()),
    source: v.optional(v.union(v.literal("web"), v.literal("extension"))),
    categoryId: v.id("bookmarkCategories"),
    url: v.string(),
    title: v.string(),
    siteName: v.optional(v.string()),
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
    createdDateKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_user_updatedAt", ["userId", "updatedAt"])
    .index("by_user_category", ["userId", "categoryId"])
    .index("by_user_deletedAt", ["userId", "deletedAt"])
    .index("by_user_deletedAt_createdAt", ["userId", "deletedAt", "createdAt"])
    .index("by_user_deletedAt_createdDateKey_createdAt", ["userId", "deletedAt", "createdDateKey", "createdAt"])
    .index("by_user_clientKey", ["userId", "clientKey"]),
  eventEntries: defineTable({
    userId: v.string(),
    clientKey: v.optional(v.string()),
    label: v.string(),
    loggedAt: v.number(),
    notes: v.optional(v.string()),
    hashtags: v.optional(v.array(v.string())),
    habitId: v.optional(v.id("habitDefinitions")),
    sourceType: v.optional(v.union(v.literal("manual"), v.literal("todo_completed"))),
    sourceTodoId: v.optional(v.id("todos")),
    deletedAt: v.optional(v.number()),
    createdDateKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_user_updatedAt", ["userId", "updatedAt"])
    .index("by_user_loggedAt", ["userId", "loggedAt"])
    .index("by_user_sourceTodoId", ["userId", "sourceTodoId"])
    .index("by_user_deletedAt", ["userId", "deletedAt"])
    .index("by_user_deletedAt_createdDateKey_createdAt", ["userId", "deletedAt", "createdDateKey", "createdAt"])
    .index("by_user_clientKey", ["userId", "clientKey"]),
  // Deprecated storage kept temporarily so existing pre-rename entries remain readable.
  routineEntries: defineTable({
    userId: v.string(),
    clientKey: v.optional(v.string()),
    label: v.string(),
    loggedAt: v.number(),
    notes: v.optional(v.string()),
    hashtags: v.optional(v.array(v.string())),
    habitId: v.optional(v.id("habitDefinitions")),
    sourceType: v.optional(v.union(v.literal("manual"), v.literal("todo_completed"))),
    sourceTodoId: v.optional(v.id("todos")),
    deletedAt: v.optional(v.number()),
    createdDateKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_user_updatedAt", ["userId", "updatedAt"])
    .index("by_user_loggedAt", ["userId", "loggedAt"])
    .index("by_user_sourceTodoId", ["userId", "sourceTodoId"])
    .index("by_user_deletedAt", ["userId", "deletedAt"])
    .index("by_user_deletedAt_createdDateKey_createdAt", ["userId", "deletedAt", "createdDateKey", "createdAt"])
    .index("by_user_clientKey", ["userId", "clientKey"]),
  habitDefinitions: defineTable({
    userId: v.string(),
    name: v.string(),
    targetTime: v.optional(v.string()),
    frequency: v.union(v.literal("daily"), v.literal("weekdays"), v.literal("custom")),
    customDays: v.optional(v.array(v.number())),
    currentStreak: v.number(),
    longestStreak: v.number(),
    createdAt: v.number(),
  }).index("by_user_createdAt", ["userId", "createdAt"]),
  userEncryptionKeys: defineTable({
    userId: v.string(),
    wrappedKey: v.string(),
    salt: v.string(),
    wrappedRecoveryKey: v.optional(v.string()),
    recoverySalt: v.optional(v.string()),
  }).index("by_userId", ["userId"]),
  userSettings: defineTable({
    userId: v.string(),
    saveShortcut: v.union(v.literal("mod_enter"), v.literal("enter"), v.literal("shift_enter")),
    newlineShortcut: v.union(v.literal("enter"), v.literal("shift_enter")),
    showSaveShortcutHints: v.boolean(),
    inAppReminderNotifications: v.boolean(),
    browserReminderNotifications: v.boolean(),
    reminderLeadMinutes: v.union(v.literal(0), v.literal(5), v.literal(10), v.literal(15)),
    defaultSnoozeMinutes: v.union(v.literal(5), v.literal(10), v.literal(15), v.literal(30)),
    reminderToastDurationSeconds: v.union(v.literal(10), v.literal(20), v.literal(30), v.literal(60)),
    themeMode: v.optional(v.union(v.literal("system"), v.literal("light"), v.literal("dark"))),
    navLabelStyle: v.optional(v.union(v.literal("label-only"), v.literal("icon-label"), v.literal("active-label"))),
    dashboardStat: v.optional(v.union(
      v.literal("completion_rate"),
      v.literal("todos_done_today"),
      v.literal("habit_streak"),
      v.literal("notes_this_week"),
      v.literal("bookmarks_this_week"),
      v.literal("random"),
    )),
    fontFamily: v.optional(v.union(
      v.literal("sans"),
      v.literal("serif"),
      // legacy values from earlier iterations, normalised client-side
      v.literal("fraunces"),
      v.literal("lora"),
      v.literal("literata"),
      v.literal("source-serif-4"),
    )),
    canvasDotGrid: v.optional(v.boolean()),
    founderNoteSeen: v.optional(v.boolean()),
    rssReaderEnabled: v.optional(v.boolean()),
    frauncesOpsz: v.optional(v.number()),   // legacy, unused
    frauncesSoft: v.optional(v.number()),   // legacy, unused
    frauncesWonk: v.optional(v.boolean()),  // legacy, unused
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
  userDevices: defineTable({
    userId: v.string(),
    deviceId: v.string(),
    clientType: v.union(v.literal("web"), v.literal("extension"), v.literal("desktop")),
    deviceName: v.string(),
    browserName: v.optional(v.string()),
    platformName: v.optional(v.string()),
    appVersion: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    firstSeenAt: v.number(),
    lastActiveAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_user_deviceId", ["userId", "deviceId"])
    .index("by_user_lastActiveAt", ["userId", "lastActiveAt"])
    .index("by_user_revokedAt_lastActiveAt", ["userId", "revokedAt", "lastActiveAt"]),
  userHashtags: defineTable({
    userId: v.string(),
    name: v.string(),
    nameLower: v.string(),
    usageCount: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user_nameLower", ["userId", "nameLower"])
    .index("by_user_createdAt", ["userId", "createdAt"]),
  hashtagUsages: defineTable({
    userId: v.string(),
    hashtagName: v.string(),
    artifactType: v.union(v.literal("note"), v.literal("todo"), v.literal("event"), v.literal("routine")),
    artifactId: v.string(),
    artifactTitle: v.string(),
    createdDateKey: v.string(),
    createdAt: v.number(),
  })
    .index("by_user_hashtagName", ["userId", "hashtagName"])
    .index("by_user_hashtagName_artifactType", ["userId", "hashtagName", "artifactType"])
    .index("by_user_artifact", ["userId", "artifactType", "artifactId"]),
  sharedFolders: defineTable({
    categoryId: v.optional(v.id("bookmarkCategories")),
    userId: v.string(),
    shareCode: v.string(),
    isActive: v.boolean(),
    viewCount: v.number(),
    lastViewedAt: v.optional(v.number()),
    ownerName: v.string(),
    ownerImageUrl: v.optional(v.string()),
    createdAt: v.number(),
    // Plaintext snapshot pushed by the owner's client on share enable/refresh
    snapshotCategoryName: v.optional(v.string()),
    snapshotFolderIcon: v.optional(v.string()),
    snapshotBookmarks: v.optional(v.array(v.object({
      id: v.string(),
      url: v.string(),
      title: v.string(),
      siteName: v.optional(v.string()),
      description: v.optional(v.string()),
      thumbnailUrl: v.optional(v.string()),
      faviconUrl: v.optional(v.string()),
    }))),
    snapshotUpdatedAt: v.optional(v.number()),
    sortOrder: v.optional(v.union(v.literal("oldest_first"), v.literal("newest_first"))),
    type: v.optional(v.union(v.literal("bookmark"), v.literal("todo"))),
    todoFolderId: v.optional(v.id("todoFolders")),
    snapshotTodos: v.optional(v.array(v.object({
      id: v.string(),
      title: v.string(),
      status: v.union(v.literal("open"), v.literal("done")),
      dueDateKey: v.optional(v.string()),
      dueTime: v.optional(v.string()),
      createdAt: v.number(),
      completedAt: v.optional(v.number()),
    }))),
  })
    .index("by_shareCode", ["shareCode"])
    .index("by_categoryId", ["categoryId"])
    .index("by_userId_isActive", ["userId", "isActive"])
    .index("by_todoFolderId", ["todoFolderId"]),
  sharedNoteFolders: defineTable({
    folderId: v.id("noteFolders"),
    userId: v.string(),
    shareCode: v.string(),
    isActive: v.boolean(),
    viewCount: v.number(),
    lastViewedAt: v.optional(v.number()),
    ownerName: v.string(),
    ownerImageUrl: v.optional(v.string()),
    createdAt: v.number(),
    snapshotFolderName: v.optional(v.string()),
    snapshotFolderIcon: v.optional(v.string()),
    snapshotNotes: v.optional(v.array(v.object({
      id: v.string(),
      title: v.optional(v.string()),
      body: v.string(),
      tags: v.array(v.string()),
    }))),
    snapshotUpdatedAt: v.optional(v.number()),
  })
    .index("by_shareCode", ["shareCode"])
    .index("by_folderId", ["folderId"])
    .index("by_userId_isActive", ["userId", "isActive"]),
  shareViewBuckets: defineTable({
    ownerUserId: v.string(),
    shareKind: v.union(v.literal("bookmark_folder"), v.literal("note_folder"), v.literal("todo_folder")),
    shareCode: v.string(),
    viewerToken: v.string(),
    lastCountedAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_shareKind_shareCode_viewerToken", ["shareKind", "shareCode", "viewerToken"])
    .index("by_shareKind_shareCode_lastCountedAt", ["shareKind", "shareCode", "lastCountedAt"])
    .index("by_ownerUserId", ["ownerUserId"]),
  pushSubscriptions: defineTable({
    userId: v.string(),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_endpoint", ["userId", "endpoint"]),
  activityHistory: defineTable({
    userId: v.string(),
    module: v.union(v.literal("todo"), v.literal("note"), v.literal("bookmark"), v.literal("event"), v.literal("routine")),
    action: v.union(
      v.literal("created"),
      v.literal("completed"),
      v.literal("deleted"),
      v.literal("edited"),
      v.literal("fired"),
      v.literal("dismissed"),
      v.literal("snoozed"),
    ),
    itemId: v.string(),
    itemTitle: v.string(),
    diff: v.optional(v.string()),
    restorable: v.boolean(),
    timestamp: v.number(),
  })
    .index("by_user_timestamp", ["userId", "timestamp"])
    .index("by_user_module_timestamp", ["userId", "module", "timestamp"]),
  // Plan entitlements. Rows are created manually (Convex dashboard) for now;
  // a payment provider webhook will write to this table later.
  userPlans: defineTable({
    userId: v.string(),
    plan: v.union(v.literal("free"), v.literal("paid")),
    source: v.union(v.literal("manual"), v.literal("stripe"), v.literal("polar"), v.literal("clerk")),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
  // RSS feeds are global and deduped by canonical feed URL — one fetch serves
  // every subscriber. Per-user state lives in rssSubscriptions/rssReadState.
  rssFeeds: defineTable({
    url: v.string(),
    siteUrl: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    // True while at least one non-deleted subscription exists; cron only polls active feeds.
    active: v.boolean(),
    etag: v.optional(v.string()),
    lastModified: v.optional(v.string()),
    lastFetchedAt: v.number(),
    lastFetchStatus: v.optional(v.union(v.literal("ok"), v.literal("not_modified"), v.literal("error"))),
    lastFetchError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_url", ["url"])
    .index("by_active_lastFetchedAt", ["active", "lastFetchedAt"]),

  rssCategories: defineTable({
    userId: v.string(),
    name: v.string(),
    icon: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_user_updatedAt", ["userId", "updatedAt"]),
  rssSubscriptions: defineTable({
    userId: v.string(),
    feedId: v.id("rssFeeds"),
    categoryId: v.optional(v.id("rssCategories")),
    customTitle: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
    lastMarkAllReadAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_feedId", ["userId", "feedId"])
    .index("by_user_deletedAt_createdAt", ["userId", "deletedAt", "createdAt"])
    .index("by_user_updatedAt", ["userId", "updatedAt"])
    .index("by_feedId", ["feedId"]),
  rssReadState: defineTable({
    userId: v.string(),
    itemId: v.string(),
    feedId: v.id("rssFeeds"),
    readAt: v.optional(v.number()),
    savedAt: v.optional(v.number()),
    savedTitle: v.optional(v.string()),
    savedUrl: v.optional(v.string()),
    savedSummary: v.optional(v.string()),
    savedThumbnailUrl: v.optional(v.string()),
    savedAuthor: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_user_itemId", ["userId", "itemId"])
    .index("by_user_savedAt", ["userId", "savedAt"])
    .index("by_user_updatedAt", ["userId", "updatedAt"])
    .index("by_itemId", ["itemId"]),
});
