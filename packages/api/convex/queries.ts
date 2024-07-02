import { queryWithAuth } from "@convex-dev/convex-lucia-auth";
import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalQuery, query } from "./_generated/server";

// import { DataModel } from "./_generated/dataModel"

// Get User OTP secret from the db and return
export const getOTPSecret = internalQuery({
  args: { userId: v.id("user") },
  handler: async (ctx, { userId }): Promise<string> => {
    if (!userId)
      throw new ConvexError({
        message: "Invalid user ID supplied",
        code: 404,
        status: "failed",
      });

    const user = await ctx.db.get(userId);

    console.log(user, ":::User");

    if (!user) {
      throw new ConvexError({
        message: "No user exists with that email",
        code: 404,
        status: "failed",
      });
    }

    return user.otpSecret!;
  },
});

// Get user details to be rendered on main dashboard
export const getUserDetails = query({
  args: { userId: v.optional(v.id("user")) },
  handler: async ({ db }, { userId }) => {
    if (userId) {
      const user = await db.get(userId);

      if (!user) {
        // return null;
        throw new ConvexError({
          message: "No user with that id",
          code: 404,
          status: "failed",
        });
      }

      return user;
    }
  },
});



// Get user details with email
export const getUserWithEmail = internalQuery({
  args: { email: v.string() },
  handler: async ({ db }, { email }) => {
    try {
      return await db
        .query("user")
        .withIndex("by_email", (q) =>
          q.eq("email", email),
        )
        .unique();
    } catch (e: any) {
      console.log(e.message ?? e.toString());
      throw e;
    }
  },
});



// Get user detials with Nickname
export const getUserWithNickname = internalQuery({
  args: { nickname: v.string() },
  handler: async ({ db }, { nickname }) => {
    try {
      return await db
        .query("user")
        .withIndex("by_nickname", (q) => q.eq("nickname", nickname))
        .unique();
    } catch (e: any) {
      console.log(e.message ?? e.toString());
      throw e;
    }
  },
});

// Get leader board filtered and ordered by XP
export const getLeaderBoard = query({
  args: { userId: v.optional(v.id("user")) },
  handler: async ({ db }, { userId }) => {
    if (userId) {
      const user = await db.get(userId);

      if (!user) {
        throw new ConvexError({
          message: "No user with that id",
          code: 404,
          status: "failed",
        });
      }

      const rankedUsers = await db
        .query("user")
        .withIndex("by_rank_xpCount", (q) => q.lte("rank", 10))
        .filter((q) => q.eq(q.field("deleted"), false))
        .order("desc")
        .take(10);

      const sortedUsers = rankedUsers
        .slice()
        .sort((a, b) => b.xpCount - a.xpCount);

      return {
        user,
        sortedUsers,
      };
    }
  },
});

export const getWeeklyTopRanked = internalQuery({
  handler: async ({ db }) => {
    return (
      (await db
        .query("user")
        .filter((q) => q.eq(q.field("deleted"), false))
        .withIndex("by_xpCount")
        .order("desc")
        .take(3)) ?? []
    );
  },
});

export const getHistory = query({
  args: { userId: v.optional(v.id("user")) },
  handler: async ({ db }, { userId }) => {
    if (userId) {
      return await db
        .query("activity")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .order("desc")
        .take(25);
    } else {
      return [];
    }
  },
});

export const getOnlyXpHistory = query({
  args: { userId: v.id("user") },
  handler: async ({ db }, { userId }) => {
    const referrals =
      (await db
        .query("activity")
        .withIndex("by_userId_xp", (q) =>
          q.eq("userId", userId).eq("type", "xp"),
        )
        .order("desc")
        .take(25)) ?? [];

    return referrals.filter((ref) => !ref?.extra?.includes("%") && ref?.message.toLowerCase().includes("joined"));
  },
});

export const fetchTasks = query({
  args: { userId: v.id("user") },
  handler: async ({ db }, { userId }) => {
    // Filter shown tasks by users completed task list
    // const user = await db.get(userId);
    // if (!user) {
    //   throw new ConvexError({
    //     message: "User not found",
    //     code: 404,
    //     status: "failed",
    //   });
    // }

    // Filter tasks based on tasks completions by user
    const tasks = await db.query("tasks").order("desc").collect();
    return tasks;
  },
});

export const fetchEvents = query({
  args: { userId: v.id("user") },
  handler: async ({ db, storage }, { userId }) => {
    // Filter events by users completed eventsS
    // const user = await db.get(userId);
    // if (!user) {
    //   throw new ConvexError({
    //     message: "User not found",
    //     code: 404,
    //     status: "failed",
    //   });
    // }
    const events = await db.query("events").order("desc").collect();

    const loadedEvents = await Promise.all(
      events.map(async (event) => {
        const company = await db.get(event.companyId);
        // if(!company) {
        //   throw new Error("No company found");
        // }
        const logoUrl = await storage.getUrl(
          company?.logoStorageId as Id<"_storage">,
        );

        const coverUrl = await storage?.getUrl(
          event?.coverStorageId as Id<"_storage">,
        );

        return {
          ...event,
          coverUrl,
          company: {
            ...company,
            logoUrl: logoUrl ?? "",
          },
        };
      }),
    );

    return loadedEvents;
  },
});

// Config queries
export const getAppConfig = queryWithAuth({
  args: {},
  handler: async ({ db }) => {
    return await db.query("config").first();
  },
});

export const getAppConfigForApp = query({
  handler: async ({ db }) => {
    return await db.query("config").first();
  },
});

// Get the ads config from the dashboard
export const getAdsConfig = query({
  handler: async ({ db, storage }) => {
    const adConfig = await db.query("ads").first();

    if (!adConfig) {
      return adConfig;
    }

    const adUrl = await storage.getUrl(adConfig?.storageId as Id<"_storage">);

    return {
      ...adConfig,
      adUrl,
    };
  },
});
