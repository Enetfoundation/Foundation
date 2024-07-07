import { mutationWithAuth } from "@convex-dev/convex-lucia-auth";
import { ConvexError, v } from "convex/values";
import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";

// Write your Convex functions in any file inside this directory (`convex`).
// See https://docs.convex.dev/functions for more.

// You can read data from the database via a query:

export const deleteUserWithId = mutationWithAuth({
  args: { userId: v.id("user") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      deleted: true,
      xpCount: 0,
      minedCount: 0,
      redeemableCount: 0,
      completedTasks: undefined,
      eventsJoined: undefined,
      mineActive: false,
      mineHours: 0,
      miningRate: 0,
      otpSecret: undefined,
      password: undefined,
      referralCount: 0,
      boostStatus: undefined,
      mineStartTime: undefined,
      nickname: undefined,
      email: undefined,
    });
  },
});

// Tasks
export const deleteTaskWithId = mutationWithAuth({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => await ctx.db.delete(args.taskId),
});

export const addTask = mutationWithAuth({
  args: {
    name: v.string(),
    reward: v.number(),
    action: v.object({
      link: v.string(),
      type: v.union(
        v.literal("visit"),
        v.literal("follow"),
        v.literal("post"),
        v.literal("join"),
      ),
      channel: v.union(
        v.literal("twitter"),
        v.literal("telegram"),
        v.literal("discord"),
        v.literal("website"),
      ),
    }),
  },
  handler: async (ctx, args) =>
    await ctx.db.insert("tasks", {
      name: args.name,
      reward: args.reward,
      action: args.action,
    }),
});

export const updateTask = mutationWithAuth({
  args: {
    taskId: v.id("tasks"),
    name: v.string(),
    reward: v.number(),
    action: v.object({
      link: v.string(),
      type: v.union(
        v.literal("visit"),
        v.literal("follow"),
        v.literal("post"),
        v.literal("join"),
      ),
      channel: v.union(
        v.literal("twitter"),
        v.literal("telegram"),
        v.literal("discord"),
        v.literal("website"),
      ),
    }),
  },
  handler: async (ctx, args) =>
    await ctx.db.replace(args.taskId, {
      name: args.name,
      reward: args.reward,
      action: args.action,
    }),
});

// Events
export const createEvent = mutationWithAuth({
  args: {
    title: v.string(),
    description: v.string(),
    coverStorageId: v.id("_storage"),
    reward: v.number(),
    companyId: v.id("company"),
    actions: v.array(
      v.object({
        name: v.string(),
        link: v.string(),
        type: v.union(
          v.literal("visit"),
          v.literal("follow"),
          v.literal("post"),
          v.literal("join"),
        ),
        channel: v.union(
          v.literal("twitter"),
          v.literal("telegram"),
          v.literal("discord"),
          v.literal("website"),
        ),
      }),
    ),
  },
  handler: async (ctx, args) =>
    await ctx.db.insert("events", {
      title: args.title,
      reward: args.reward,
      description: args.description,
      coverStorageId: args.coverStorageId,
      companyId: args.companyId,
      actions: args.actions,
    }),
});

export const updateEvent = mutationWithAuth({
  args: {
    eventId: v.id("events"),
    title: v.string(),
    description: v.string(),
    coverStorageId: v.id("_storage"),
    reward: v.number(),
    companyId: v.id("company"),
    actions: v.array(
      v.object({
        name: v.string(),
        link: v.string(),
        type: v.union(
          v.literal("visit"),
          v.literal("follow"),
          v.literal("post"),
          v.literal("join"),
        ),
        channel: v.union(
          v.literal("twitter"),
          v.literal("telegram"),
          v.literal("discord"),
          v.literal("website"),
        ),
      }),
    ),
  },
  handler: async (ctx, args) =>
    await ctx.db.replace(args.eventId, {
      title: args.title,
      reward: args.reward,
      description: args.description,
      coverStorageId: args.coverStorageId,
      companyId: args.companyId,
      actions: args.actions,
    }),
});

export const deleteEventWithId = mutationWithAuth({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => await ctx.db.delete(args.eventId),
});

// Company
export const createCompany = mutationWithAuth({
  args: {
    name: v.string(),
    logoStorageId: v.id("_storage"),
    isApproved: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!ctx.session || !ctx.session.user) {
      throw new ConvexError({
        message: "Must be logged in to upload",
      });
    }

    await ctx.db.insert("company", {
      name: args.name,
      isApproved: args.isApproved,
      logoStorageId: args.logoStorageId,
    });
  },
});

export const updateCompany = mutationWithAuth({
  args: {
    companyId: v.id("company"),
    name: v.string(),
    logoStorageId: v.id("_storage"),
    isApproved: v.boolean(),
  },
  handler: async (ctx, args) =>
    await ctx.db.replace(args.companyId, {
      name: args.name,
      logoStorageId: args.logoStorageId,
      isApproved: args.isApproved,
    }),
});

export const deleteCompany = mutationWithAuth({
  args: { companyId: v.id("company") },
  handler: async (ctx, args) => await ctx.db.delete(args.companyId),
});



// internal mutation called by cron to update user stats
export const updateUserStats = internalAction({
  args: {},
  handler: async ({ runQuery, runMutation }) => {
    let isDone = false;

    while (!isDone) {
      const { stats, userList } = await runQuery(internal.adminQueries.getUsers, { paginationOpts: { numItems: 5000, maximumRowsRead: 5000, cursor: null } });

      const users = userList.page;
      // Filter and extract
      const totalMined = users.reduce((c, obj) => c + (obj.minedCount ?? 0), 0);
      const totalXp = users.reduce((c, obj) => c + (obj.xpCount ?? 0), 0);
      const totalReferrals = users.reduce(
        (c, obj) => c + (obj.referralCount ?? 0),
        0
      );
      const totalUsers = users.length ?? 0;
      // const recentUsers = users.slice(0, 5) ?? 0;

      if (stats) {
        await runMutation(internal.adminMutations.updateStats, { id: stats._id, data: { totalMined, totalReferrals, totalUsers, totalXp } });
      }


      if(userList.isDone) {
        isDone = true;
      }

    }

  }
});


export const updateStats = internalMutation({
  args: { id: v.id("userStats"), data: v.object({ totalMined: v.number(), totalXp: v.number(), totalReferrals: v.number(), totalUsers: v.number() }) },
  handler: async ({ db }, args) => {
    if (args.id) {
      await db.patch(args.id, { ...args.data });
    }
  }
});

