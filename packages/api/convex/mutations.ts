import { mutationWithAuth } from "@convex-dev/convex-lucia-auth";
import { ConvexError, v } from "convex/values";
import { differenceInHours } from "date-fns";
import { customAlphabet } from "nanoid";

import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { tuple } from "zod";
import { sendTGBotMessage } from "../utils";
// import { decodeURLString } from "./onboarding";

export const storeEmail = internalMutation({
  args: { email: v.optional(v.string()), referreeCode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const config = await ctx.db.query("config").first();
    // Check if email already exists
    const existingUsers = await ctx.db
      .query("user")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();

    // Checking if the users email already exists without being deleted
    if (
      existingUsers?.some((user) => user.email === args.email && !user?.deleted)
    ) {
      throw new ConvexError({
        message: "Email already exists",
        code: 400,
        status: "failed",
      });
    }

    // Fetch dangling user details after deleted account
    const previouslyDeleted = await ctx.db
      .query("user")
      .withIndex("by_email_deleted", (q) =>
        q.eq("email", args.email).eq("deleted", true),
      )
      .unique();

    // If user was previously deleted update fields
    if (previouslyDeleted) {
      await ctx.db.patch(previouslyDeleted._id, {
        ...previouslyDeleted,
        minedCount: 0,
        miningRate: config?.miningCount,
        mineActive: false,
        referralCount: 0,
        mineHours: config?.miningHours ?? 6,
        redeemableCount: 0,
        xpCount: config?.xpCount ?? 1000,
      });

      return previouslyDeleted._id;
    }

    // Store email and referral
    const userId = await ctx.db.insert("user", {
      email: args.email?.toLowerCase(),
      referreeCode: args.referreeCode,
      minedCount: 0,
      miningRate: config?.miningCount ?? 2.0,
      mineActive: false,
      referralCount: 0,
      mineHours: config?.miningHours ?? 6,
      redeemableCount: 0,
      xpCount: config?.xpCount ?? 1000,
      deleted: false,
    });

    return userId;
  },
});



export const storeTgDetails = internalMutation({
  args: { type: v.union(v.literal("tg"), v.literal("twitter"), v.literal("google")), tgInitData: v.string(), referreCode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    console.log(args.tgInitData, ":::initData to split on");

    // Decode the user object
    // const splitString = args.tgInitData.split("&");
    // const userSplit = splitString[1].split("=");
    const tgUserObject = JSON.parse(args.tgInitData);

    console.log(tgUserObject, ":::Decoded string of TG user");

    const config = await ctx.db.query("config").first();
    // Check if email already exists
    const checkForMultiAccounts = await ctx.db
      .query("user")
      .withIndex("by_tgUserId", (q) => q.eq("tgUserId", tgUserObject?.id?.toString()))
      .collect();


    console.log(checkForMultiAccounts.length, checkForMultiAccounts, ":::TG Account length");

    // Checking if the users email already exists without being deleted
    if (
      checkForMultiAccounts.length
    ) {
      throw new ConvexError({
        message: "Telegram account already exists",
        code: 400,
        status: "failed",
      });
    }

    // // Fetch dangling user details after deleted account
    // const previouslyDeleted = await ctx.db
    //   .query("user")
    //   .withIndex("by_tgUserId_deleted", (q) =>
    //     q.eq("tgUserId", tgUserObject?.id).eq("deleted", true),
    //   )
    //   .unique();

    // // If user was previously deleted update fields
    // if (previouslyDeleted) {
    //   await ctx.db.patch(previouslyDeleted._id, {
    //     ...previouslyDeleted,
    //     minedCount: 0,
    //     miningRate: config?.miningCount,
    //     mineActive: false,
    //     referralCount: 0,
    //     mineHours: config?.miningHours ?? 6,
    //     redeemableCount: 0,
    //     xpCount: config?.xpCount ?? 1000,
    // delete: false,
    //   });

    //   return previouslyDeleted._id;
    // }


    const referralCode = generateReferralCode();

    // Store email and referral
    const userId = await ctx.db.insert("user", {
      tgUserId: tgUserObject?.id.toString(),
      tgUsername: tgUserObject?.username ?? tgUserObject?.first_name ?? tgUserObject?.last_name,
      minedCount: 0,
      miningRate: config?.miningCount ?? 2.0,
      mineActive: false,
      referralCount: 0,
      referralCode: referralCode,
      mineHours: config?.miningHours ?? 6,
      referreeCode: args.referreCode,
      redeemableCount: 0,
      xpCount: config?.xpCount ?? 1000,
      deleted: false,
    });


    // Increment users referree count
    // Get new user data
    const referree = await ctx.db
      .query("user")
      .withIndex("by_referreeCode", (q) =>
        q.eq("referralCode", args?.referreCode?.toUpperCase()),
      )
      .first();

    if (referree) {
      // Patch referree count
      console.log(referree, ":::Update referree xpCount");
      const currentMultiEffectReward = referree?.multiplier
        ? (config?.referralXpCount ?? 5000) * (referree?.multiplier / 100)
        : 0;
      const totalXpCount =
        (referree?.claimedXp ?? 0) +
        (config?.referralXpCount ?? 5000) +
        currentMultiEffectReward +
        (referree?.referralXp ?? 0);
      const multiplier = activateMultiplier(totalXpCount);

      await ctx.db.patch(referree?._id as Id<"user">, {
        referralCount: Number(referree?.referralCount) + 1,
        referralXp:
          (config?.referralXpCount ?? 5000) +
          currentMultiEffectReward +
          (referree?.referralXp ?? 0),
        xpCount: totalXpCount,
        multiplier,
      });

      await ctx.db.insert("activity", {
        userId: referree?._id,
        message: `${tgUserObject?.username ?? tgUserObject?.first_name ?? tgUserObject?.last_name} Joined using your referral code`,
        extra: (
          (config?.referralXpCount ?? 5000) + currentMultiEffectReward
        ).toLocaleString("en-US"),
        type: "xp", // Can be xp and rank
      });

      // TG message
      // if (referree?.tgUserId) {
      //   await sendTGBotMessage(referree?.tgUserId, `${nickname} Joined using your referral code`);
      // }

      // Add multiplier activity
      if (multiplier) {
        await ctx.db.insert("activity", {
          userId: referree?._id,
          message: `You got a multiplier of ${multiplier}%`,
          extra: `${multiplier}%`,
          type: "xp", // Can be xp and rank
        });


        return { userId, multiplier, tgAlert: { referree, tgUserObject } };
      }
      return { userId, tgAlert: { referree, tgUserObject } };
    }


    return { userId };
  },

});

export const checkTgUserAndLink = mutation({
  args: { tgInitData: v.optional(v.string()) },
  handler: async ({ db }, { tgInitData }) => {


    if (tgInitData) {

      const tgUserObject = JSON.parse(tgInitData);


      console.log(tgUserObject, tgInitData, ":::TG INIT DATA");

      const checkForMultiAccounts = await db
        .query("user")
        .withIndex("by_tgUserId", (q) => q.eq("tgUserId", tgUserObject?.id?.toString()))
        .collect();


      console.log(checkForMultiAccounts, ':::Accounts returned from check');


      if (checkForMultiAccounts.length) {
        // account already exists
        return { isTgUser: true, userId: checkForMultiAccounts[0]._id };
      } else {
        return { isTgUser: false };
      }

    } else {
      return { isTgUser: false };
    }


  }
})


export const storeOTPSecret = internalMutation({
  args: { secret: v.string(), userId: v.id("user") },
  handler: async (ctx, { secret, userId }) => {
    try {
      await ctx.db.patch(userId, { otpSecret: secret });
    } catch (e: any) {
      console.log(e, ":::Path errorr");
      throw e;
    }
  },
});

export const saveUserPassword = internalMutation({
  args: { hashedPassword: v.string(), userId: v.id("user") },
  handler: async (ctx, args) => {
    try {
      await ctx.db.patch(args.userId, { password: args.hashedPassword });
    } catch (e: any) {
      console.log(e.message ?? e.toString());

      throw e;
    }
  },
});

export const redeemReferralCode = mutation({
  args: {
    referreeCode: v.string(),
    nickname: v.string(),
    userId: v.id("user"),
  },
  handler: async ({ db }, { referreeCode, nickname, userId }) => {
    const user = await db.get(userId);

    if (!user || user?.referreeCode?.length) {
      throw new ConvexError({
        message:
          "Error redeeming referral, user has previously been onboarded!",
        code: 501,
        status: "failed",
      });
    }
    const config = await db.query("config").first();
    // Increment users referree count
    // Get new user data
    const referree = await db
      .query("user")
      .filter((q) => q.eq(q.field("referralCode"), referreeCode?.toUpperCase()))
      .first();

    if (referree) {
      // Patch referree count
      console.log(referree, ":::Update referree xpCount");
      const currentMultiEffectReward = referree?.multiplier
        ? (config?.referralXpCount ?? 5000) * (referree?.multiplier / 100)
        : 0;
      const totalXpCount =
        (referree?.claimedXp ?? 0) +
        (config?.referralXpCount ?? 5000) +
        currentMultiEffectReward +
        (referree?.referralXp ?? 0);
      const multiplier = activateMultiplier(totalXpCount);

      await db.patch(referree?._id as Id<"user">, {
        referralCount: Number(referree?.referralCount) + 1,
        referralXp:
          (config?.referralXpCount ?? 5000) +
          currentMultiEffectReward +
          (referree?.referralXp ?? 0),
        xpCount: totalXpCount,
        multiplier,
      });
      await db.insert("activity", {
        userId: referree?._id,
        message: `${nickname} Joined using your referral code`,
        extra: (
          (config?.referralXpCount ?? 5000) + currentMultiEffectReward
        ).toLocaleString("en-US"),
        type: "xp", // Can be xp and rank
      });

      // if (referree?.tgUserId) {
      //   await sendTGBotMessage(referree?.tgUserId, `${nickname} Joined using your referral code`);
      // }

      await db.patch(userId, { referreeCode });

      // Add multiplier activity
      if (multiplier) {
        await db.insert("activity", {
          userId: userId,
          message: `You got a multiplier of ${multiplier}%`,
          extra: `${multiplier}%`,
          type: "xp", // Can be xp and rank
        });

        // if (referree?.tgUserId) {
        //   await sendTGBotMessage(referree?.tgUserId, `You got a multiplier of ${multiplier}%`);
        // }

      }
    }
  },
});

export const addWeeklyTopRankedActivity = internalMutation({
  args: { userIds: v.array(v.id("user")) },
  handler: async ({ db }, { userIds }) => {
    for (const userId of userIds) {
      await db.insert("activity", {
        type: "rank",
        message: `You ranked in the top 3 globally for this week`,
        userId,
      });
    }
  },
});

export const weeklyLeaderBoardCheck = internalAction({
  handler: async ({ runQuery, runMutation, runAction }) => {
    // Check leaderboard and update activites for users who are top 3
    const weeksTopRankUsers = await runQuery(
      internal.queries.getWeeklyTopRanked,
    );

    // Add activities
    await runMutation(internal.mutations.addWeeklyTopRankedActivity, {
      userIds: weeksTopRankUsers.map((user: Doc<"user">) => user?._id),
    });

    // Send out a mail to top
    for (const user of weeksTopRankUsers) {
      await runAction(internal.novu.triggerLeaderboardWorkflow, {
        userId: user._id,
        email: user.email!,
      });
    }
  },
});

// Reward with xp for tasks
export const rewardTaskXp = action({
  args: { xpCount: v.number(), userId: v.id("user"), taskId: v.id("tasks") },
  handler: async ({ runMutation, runQuery }, { xpCount, userId, taskId }) => {
    // Reward user for task or events completed
    const user = await runQuery(internal.mutations.getUser, { userId });

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: 404,
        status: "failed",
      });
    }
    const currentMultiEffectReward = user?.multiplier
      ? xpCount * (user.multiplier / 100)
      : 0;
    const totalXpCount =
      (user?.claimedXp ?? 0) +
      xpCount +
      currentMultiEffectReward +
      (user?.referralXp ?? 0);
    const multiplier = activateMultiplier(totalXpCount);

    await runMutation(internal.mutations.insertOrPatch, {
      type: "patch",
      patchId: userId,
      data: {
        claimedXp: (user?.claimedXp ?? 0) + xpCount + currentMultiEffectReward,
        completedTasks: user.completedTasks
          ? [...user.completedTasks, taskId]
          : [taskId],
        xpCount: totalXpCount,
        multiplier,
      }
    });

    // Add multiplier activity
    if (multiplier) {
      await runMutation(internal.mutations.insertOrPatch, {
        type: "insert",
        insertTableName: "activity",
        data: {
          userId: userId,
          message: `You got a multiplier of ${multiplier}%`,
          extra: `${multiplier}%`,
          type: "xp", // Can be xp and rank
        }
      });


      if (user?.tgUserId) {
        await sendTGBotMessage(user?.tgUserId, `You got a multiplier of ${multiplier}%`)
          .then((val) => console.log(val, ":::sent tg msg"))
          .catch((err) => console.log(err, ":::error sending tg msg"));
      }
    }
  },
});


export const getUser = internalQuery({
  args: { userId: v.id("user") },
  handler: async ({ db }, args) => await db.get(args.userId),
})


export const insertOrPatch = internalMutation({
  args: { type: v.union(v.literal("insert"), v.literal("patch")), patchId: v.optional(v.any()), insertTableName: v.optional(v.any()), data: v.any() },
  handler: async ({ db }, { type, patchId, insertTableName, data }) => {
    if (type === "patch" && patchId) {
      await db.patch(patchId, {
        ...data,
      });

    } else if (type === "insert" && insertTableName) {
      await db.insert(insertTableName, {
        ...data
      });
    } else {
      throw new ConvexError({
        message: "Could not update or insert doc",
        code: "500",
        status: "failed"
      })
    }
  }
})

// Reward after event actions have been completed
export const rewardEventXp = mutation({
  args: { xpCount: v.number(), userId: v.id("user"), eventId: v.id("events") },
  handler: async ({ db }, { xpCount, userId, eventId }) => {
    const user = await db.get(userId);

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: 404,
        status: "failed",
      });
    }

    // Check if all event actions have been comleted
    const currentEventActions = user?.eventsJoined?.find(
      (event) => event?.eventId === eventId,
    )?.actions;
    if (!currentEventActions) {
      throw new ConvexError({
        message: "Can't verify events actions complete status",
        code: 501,
        status: "failed",
      });
    }

    for (const action of currentEventActions) {
      if (!action?.completed) {
        throw new ConvexError({
          message:
            "Some actions in this event have not been completed, please complete them to proceed",
          code: 501,
          status: "failed",
        });
      }
    }

    const udpatedEvents = user.eventsJoined?.map((event) => {
      if (event.eventId === eventId) {
        return {
          eventId,
          completed: true,
          actions: event.actions,
        };
      } else {
        return event;
      }
    });

    const currentMultiEffectReward = user?.multiplier
      ? xpCount * (user.multiplier / 100)
      : 0;
    const totalXpCount =
      (user?.claimedXp ?? 0) +
      xpCount +
      currentMultiEffectReward +
      (user?.referralXp ?? 0);
    const multiplier = activateMultiplier(totalXpCount);

    // Add xp and and reward user
    await db.patch(userId, {
      claimedXp: (user?.claimedXp ?? 0) + xpCount + currentMultiEffectReward,
      eventsJoined: udpatedEvents,
      xpCount: totalXpCount,
      multiplier,
    });

    // Add multiplier activity
    if (multiplier) {
      await db.insert("activity", {
        userId: userId,
        message: `You got a multiplier of ${multiplier}%`,
        extra: `${multiplier}%`,
        type: "xp", // Can be xp and rank
      });


      // if (user?.tgUserId) {
      //   await sendTGBotMessage(user?.tgUserId, `You got a multiplier of ${multiplier}%`);
      // }
    }
  },
});

// Update actions in events
export const updateEventsForUser = mutation({
  args: {
    eventId: v.id("events"),
    userId: v.id("user"),
    actionName: v.string(),
  },
  handler: async ({ db }, { eventId, userId, actionName }) => {
    const event = await db.get(eventId);
    const user = await db.get(userId);

    // Check if the event is already in user object then update only specific action
    if (!user) {
      throw new ConvexError({
        message: "No user found",
        code: 404,
        status: "failed",
      });
    }
    if (!event) {
      throw new ConvexError({
        message: "No event found",
        code: 404,
        status: "failed",
      });
    }

    // If event already in array
    if (user.eventsJoined?.some((myEvent) => myEvent.eventId === event._id)) {
      // Update the specific action
      const updatedEventJoined = user.eventsJoined.map((joinedEvent) => {
        if (joinedEvent.eventId === event._id) {
          const updatedAction = joinedEvent.actions.map((action) => {
            if (action.name === actionName) {
              return {
                completed: true,
                name: action.name,
                type: action.type,
                channel: action.channel,
                link: action.link,
              };
            } else {
              return action;
            }
          });

          return {
            ...joinedEvent,
            actions: updatedAction,
          };
        } else {
          return joinedEvent;
        }
      });

      // Update
      await db.patch(userId, { eventsJoined: updatedEventJoined });
    } else {
      // If no event already in array
      await db.patch(userId, {
        eventsJoined: user.eventsJoined
          ? [
            ...user.eventsJoined,
            {
              eventId: event._id,
              completed: false,
              actions: event.actions.map((action) => {
                if (action.name === actionName) {
                  return {
                    completed: true,
                    link: action.link,
                    channel: action.channel,
                    name: action.name,
                    type: action.type,
                  };
                } else {
                  return { ...action, completed: false };
                }
              }),
            },
          ]
          : [
            {
              eventId: event._id,
              completed: false,
              actions: event.actions.map((action) => {
                if (action.name === actionName) {
                  return {
                    completed: true,
                    link: action.link,
                    channel: action.channel,
                    name: action.name,
                    type: action.type,
                  };
                } else {
                  return { ...action, completed: false };
                }
              }),
            },
          ],
      });
    }
  },
});

// Deleting user accounts
export const deleteAccount = mutation({
  args: { userId: v.id("user") },
  handler: async (ctx, args) => {
    try {
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

      // Delete the activity of the user as well
      const usersActivity = await ctx.db
        .query("activity")
        .filter((q) => q.eq(q.field("userId"), args.userId))
        .collect();

      if (usersActivity.length) {
        for (const activity of usersActivity) {
          await ctx.db.delete(activity._id);
        }
      }
    } catch (e: any) {
      console.log(e, e.message ?? e.toString(), ":::Error deleting");
      throw new ConvexError({ message: "Error trying to delete account" });
    }
  },
});

// Mining trigger
export const triggerMining = mutation({
  args: { userId: v.id("user") },
  handler: async ({ db }, { userId }) => {
    const config = await db.query("config").first();
    const user = await db.get(userId);

    if (!user) {
      throw new ConvexError({
        message: "No user found",
        code: 500,
        status: "failed",
      });
    }

    if (user.mineActive) {
      throw new ConvexError({
        message: "You alread have a mining session ongoing",
        code: 401,
        status: "failed",
      });
    }

    await db.patch(userId, {
      mineActive: true,
      mineStartTime: Date.now(),
      ...(!user?.boostStatus?.length && {
        mineHours: config?.miningHours ?? 6,
        miningRate: config?.miningCount ?? 2,
      }),
    });
  },
});


export const getConfig = internalQuery({ args: {}, handler: async ({ db }) => db.query("config").first(), })
export const getMiningUsers = internalQuery({
  args: {}, handler: async ({ db }) => await db
    .query("user")
    .withIndex("by_mineActive", (q) => q.eq("mineActive", true))
    .collect(),
})

export const mine = internalAction({
  handler: async ({ runQuery, runMutation }) => {
    const config = await runQuery(internal.mutations.getConfig);

    const users = await runQuery(internal.mutations.getMiningUsers);

    if (!users.length) {
      return;
    }

    for (const user of users) {
      const currentMineHour = differenceInHours(
        Date.now(),
        new Date(user.mineStartTime!),
        {
          roundingMethod: "floor",
        },
      );
      if (currentMineHour < user.mineHours) {
        await runMutation(internal.mutations.insertOrPatch, {
          type: "patch",
          patchId: user._id,
          data: {
            redeemableCount: user.miningRate * currentMineHour,
          }
        });
      } else {
        // Cancel mine and reset also check for active boosts

        const bot = config?.boosts?.find(
          (boost: any) => boost?.type === "bot",
        );
        const persistBot = user?.boostStatus?.find(
          (boost: any) => boost?.boostId === bot?.uuid,
        );

        // console.log("Should stop the mining session");

        await runMutation(internal.mutations.insertOrPatch, {
          type: "patch",
          patchId: user._id,
          data: {
            mineActive: false,
            boostStatus: persistBot ? [persistBot] : undefined,
            mineHours: (config?.miningHours ?? 0) + (bot?.rate ?? 0),
            miningRate: config?.miningCount,
            redeemableCount: user.miningRate * currentMineHour,
          }
        });


        if (user?.tgUserId) {
          await sendTGBotMessage(user?.tgUserId, `Your mining session has ended, Launch the app to claim your reward and start another session`)
            .then((val) => console.log(val, ":::send tg bot msg"))
            .catch((err) => console.log(err, ":::error sending tg bot notice"));
        }
      }
    }
  },
});

// claim redeemable amount: reset and increment minedCount
export const claimRewards = action({
  args: { userId: v.id("user") },
  handler: async ({ runQuery, runMutation }, { userId }) => {
    try {

    } catch (err: any) {
      console.log(err, ":::Error in claimrewards");
      if (err instanceof ConvexError) {
        throw err;
      } else {
        throw new ConvexError({
          message: "Something went wrong, please try again",
          code: "INTERNAL_SERVER",
          status: "failed"
        })
      }
    }
    const user = await runQuery(internal.mutations.getUser, { userId });
    if (!user) {
      throw new ConvexError({
        message: "No user with that Id",
        code: 404,
        status: "failed",
      });
    }

    // Check if mine is inActive and if redeemableCount is greater than 0
    if (!user?.mineActive && user?.redeemableCount > 0) {
      await runMutation(internal.mutations.insertOrPatch, {
        type: "patch",
        patchId: userId,
        data: {
          minedCount: (user?.minedCount ?? 0) + user?.redeemableCount,
          redeemableCount: 0,
        }
      });

      await runMutation(internal.mutations.insertOrPatch, {
        type: "insert",
        insertTableName: "activity",
        data: {
          userId: userId,
          message: `You successfully redeemed your mined $FOUND ${user?.redeemableCount} token`,
          extra: (user?.redeemableCount ?? 0).toLocaleString("en-US"),
          type: "rank", // Can be xp and rank
        }
      });


      if (user?.tgUserId) {
        await sendTGBotMessage(user?.tgUserId, `You successfully redeemed your mined $FOUND ${user?.redeemableCount} token`)
          .then((val) => console.log(val, ":::Tg Message sent"))
          .catch((err) => console.log(err, ":::Errir occurred sending TG message"));
      }

    }
  },
});

// Config

export const updateConfig = mutationWithAuth({
  args: {
    data: v.any(),
    configId: v.optional(v.id("config")),
  },
  handler: async ({ db }, { data, configId }) => {
    if (configId) {
      await db.patch(configId, {
        ...data,
      });
    } else {
      await db.insert("config", {
        ...data,
      });
    }
  },
});

export const deleteAdConfig = mutationWithAuth({
  args: { adConfigId: v.id("ads") },
  handler: async ({ db }, { adConfigId }) => {
    await db.delete(adConfigId);
  },
});

// Buy XP with Mined $FOUND
export const buyXP = action({
  args: { userId: v.id("user") },
  handler: async ({ runQuery, runMutation }, { userId }) => {
    const user = await runQuery(internal.mutations.getUser, { userId });
    const config = await runQuery(internal.mutations.getConfig);
    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: 404,
        status: "failed",
      });
    }

    if (!config) {
      throw new ConvexError({
        message: "Config not found",
        code: 404,
        status: "failed",
      });
    }

    // Check users mined count is not below minimum
    if ((user.minedCount ?? 0) < (config.minimumSaleToken ?? 0)) {
      throw new ConvexError({
        message: "Insufficient $FOUND amount for XP",
        code: 401,
        status: "failed",
      });
    }

    const xpAmountTopup =
      (config?.minimumSaleToken ?? 0) * (config?.xpPerToken ?? 0);

    // Debit minedCount and credit xpCount amount
    const totalXpCount = user?.xpCount + xpAmountTopup;
    const multiplier = activateMultiplier(totalXpCount);
    await runMutation(internal.mutations.insertOrPatch, {
      type: "patch", patchId: userId, data: {
        minedCount: (user?.minedCount ?? 0) - (config?.minimumSaleToken ?? 0),
        xpCount: totalXpCount,
        multiplier: multiplier,
      }
    });
    await runMutation(internal.mutations.insertOrPatch, {
      type: "insert", insertTableName: "activity", data: {
        userId: userId,
        message: `You just purchased some XP`,
        extra: xpAmountTopup.toLocaleString("en-US"),
        type: "xp", // Can be xp and rank
      }
    });


    if (user?.tgUserId) {
      await sendTGBotMessage(user?.tgUserId, `You just purchased some XP`)
        .then((val) => console.log(val, ":::sent tg bot msg"))
        .catch((err) => console.log(err, ":::error sending bot msg"));
    }

  },
});

// Boost
export const activateBoost = mutation({
  args: {
    userId: v.id("user"),
    boost: v.object({
      uuid: v.string(),
      rate: v.number(),
      xpCost: v.number(),
      title: v.string(),
      type: v.union(v.literal("bot"), v.literal("rate"), v.literal("duration")),
      totalLevel: v.optional(v.number()),
    }),
  },
  handler: async ({ db }, { userId, boost }) => {
    const user = await db.get(userId);

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: 404,
        status: "failed",
      });
    }

    if (user && !user?.mineActive) {
      throw new ConvexError({
        message: "Mining has not been activated",
        code: 401,
        status: "failed",
      });
    }

    // Update users mining configs
    const config = await db.query("config").first();

    if (!config) {
      throw new ConvexError({
        message: "Default configs have not been set",
        status: "failed",
      });
    }

    // Check for xpBalance
    const currentBoostXpCost =
      user?.boostStatus?.find((stat) => stat?.boostId === boost?.uuid)
        ?.currentXpCost ?? 0;

    if (boost.xpCost > user?.xpCount || currentBoostXpCost > user?.xpCount) {
      console.log(
        user?.xpCount,
        currentBoostXpCost,
        ":::XP Points",
        boost?.xpCost,
      );
      throw new ConvexError({
        message: "Insufficient XP Points",
        code: 404,
        status: "failed",
      });
    }

    // Check if boost type is bot, activate and add to user boostStatus
    if (boost?.type === "bot") {
      await db.patch(userId, {
        xpCount: user?.xpCount - boost?.xpCost,
        mineHours: config.miningHours + boost.rate,
        boostStatus: user?.boostStatus
          ? [
            ...(user?.boostStatus ?? []),
            { boostId: boost?.uuid, isActive: true },
          ]
          : [{ boostId: boost?.uuid, isActive: true }],
      });

      await db.insert("activity", {
        userId: userId,
        message: `You activated bot boost`,
        type: "rank", // Can be xp and rank
      });

      // if (user?.tgUserId) {
      //   await sendTGBotMessage(user?.tgUserId, `You activated bot boost`);
      // }
    } else {
      // If type is speed
      // for speed boosts multiply the initial xpCost by 2 and and increase the users currentLevel
      // Check if the totalLevel has not been passed
      // Validate that the current xpCost is available in the users
      if (user?.boostStatus && user?.boostStatus.length) {
        // if (user?.boostStatus?.some((stat) => stat.boostId !== boost.uuid)) {
        //   // Add a new object to the array

        //   await db.patch(userId, {
        //     xpCount: user?.xpCount - boost?.xpCost,
        //     ...(boost?.type === "rate"
        //       ? { miningRate: user?.miningRate + boost?.rate }
        //       : { mineHours: user?.mineHours + boost?.rate }),
        //     boostStatus: [
        //       ...user?.boostStatus,

        //     ],
        //   });

        //   return;
        // }

        const unaffected = user?.boostStatus.filter(
          (stat) => stat?.boostId !== boost?.uuid,
        );
        const affected = user?.boostStatus.find(
          (stat) => stat?.boostId === boost?.uuid,
        );

        if (affected) {
          await db.patch(userId, {
            xpCount: user?.xpCount - (affected?.currentXpCost ?? 0),
            ...(boost?.type === "rate"
              ? { miningRate: user?.miningRate + boost?.rate }
              : { mineHours: user?.mineHours + boost?.rate }),
            boostStatus: [
              ...unaffected,
              {
                ...affected,
                currentXpCost: affected.currentXpCost! * 2,
                currentLevel: affected.currentLevel! + 1,
              },
            ],
          });

          return;
        } else {
          await db.patch(userId, {
            xpCount: user?.xpCount - boost?.xpCost,
            ...(boost?.type === "rate"
              ? { miningRate: user?.miningRate + boost?.rate }
              : { mineHours: user?.mineHours + boost?.rate }),
            boostStatus: [
              ...unaffected,
              {
                boostId: boost?.uuid,
                isActive: true,
                currentLevel: 1,
                currentXpCost: boost?.xpCost * 2,
              },
            ],
          });

          return;
        }
      }

      await db.patch(userId, {
        xpCount: user?.xpCount - boost?.xpCost,
        ...(boost?.type === "rate"
          ? { miningRate: user?.miningRate + boost?.rate }
          : { mineHours: user?.mineHours + boost?.rate }),
        boostStatus: [
          {
            boostId: boost?.uuid,
            isActive: true,
            currentLevel: 1,
            currentXpCost: boost?.xpCost * 2,
          },
        ],
      });

      await db.insert("activity", {
        userId: userId,
        message: `You activated rate/duration boost`,
        type: "rank", // Can be xp and rank
      });

      // if (user?.tgUserId) {
      //   await sendTGBotMessage(user?.tgUserId, `You activated rate/duration boost`);
      // }

    }
  },
});


// compute rank and shuffle update to users rank column
export const reshuffleRank = internalMutation({
  args: {},
  handler: async ({ db }) => {

    console.log("Reshuffle starting.....");

    // get the top 50 by xpCount
    const users = await db.query("user")
      .withIndex("by_deleted_xpCount", (q) => q.eq("deleted", false).gt('xpCount', 5000))
      .order("desc")
      .take(50);
    // const indexedUserCount = users.length;
    const sortedUsers = users.slice().sort((a, b) => b.xpCount - a.xpCount);

    for (const user of sortedUsers) {
      const userIndex = sortedUsers.findIndex((u) => u._id === user?._id);
      const rank = userIndex < 0 ? 50 : userIndex + 1;

      await db.patch(user?._id, { rank });

    }

  },
});


export function activateMultiplier(currentXpCount: number): number | undefined {
  // Check against array of multiplier values
  if (currentXpCount < 1000000 && currentXpCount >= 500000) {
    return 5;
  } else if (currentXpCount < 10000000 && currentXpCount >= 1000000) {
    return 10;
  } else if (currentXpCount < 50000000 && currentXpCount >= 10000000) {
    return 15;
  } else if (currentXpCount < 100000000 && currentXpCount >= 50000000) {
    return 20;
  } else if (currentXpCount >= 100000000) {
    return 25;
  } else {
    return undefined;
  }
}


const generateReferralCode = (): string => {
  const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 6);
  const referralCode = nanoid().toUpperCase();
  return referralCode;
};

