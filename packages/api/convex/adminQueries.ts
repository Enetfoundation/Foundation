import { queryWithAuth } from "@convex-dev/convex-lucia-auth";
import { Id, Doc } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, internalQuery, query } from "./_generated/server";

export const dashboardData = queryWithAuth({
  args: {},
  handler: async ({ db }) => {
    return await db.query("userStats").first();
  },
});


export const fetchUsers = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db.query("user")
      .withIndex("by_deleted", (q: any) => q.eq("deleted", false))
      .paginate(args.paginationOpts);
  },
});


export const getUsers = internalQuery({
  args: {},
  handler: async ({ db }, args) => {
    const stats = await db.query("userStats").first();
    const users = await db.query("user")
      .withIndex("by_deleted", (q: any) => q.eq("deleted", false))
      .take(5000);
    return { stats, users };
  }
});


// Tasks
export const fetchTasks = queryWithAuth({
  args: {},
  handler: async (ctx) => await ctx.db.query("tasks").collect(),
});

// Events
export const fetchEvents = queryWithAuth({
  args: {},
  handler: async (ctx) => {
    const events: Doc<"events">[] = await ctx.db.query("events").collect();

    return await Promise.all(
      events.map(async (event) => {
        const company = await ctx.db.get(event.companyId);
        // if(!company) {
        //   throw new Error("No company found");
        // }
        const logoUrl = await ctx.storage.getUrl(
          company?.logoStorageId as Id<"_storage">
        );

        return {
          ...event,
          company: {
            ...company,
            logoUrl: logoUrl ?? "",
          },
        };
      })
    );
  },
});

// Company
export const fetchCompanies = queryWithAuth({
  args: {},
  handler: async (ctx) => await ctx.db.query("company").collect(),
});
