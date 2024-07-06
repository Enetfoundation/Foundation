import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Define cron for updating user activities
// crons.weekly(
//   "Check leaderboard",
//   { hourUTC: 12, minuteUTC: 30, dayOfWeek: "saturday" },
//   internal.mutations.weeklyLeaderBoardCheck,
// );


crons.interval(
  "Aggregate mined tokens of active miners",
  {hours: 1},
  internal.mutations.mine
)



// TODO: fix read bandwidth from getUserDetails
//> daily runs to to update the top 50 users rank

crons.daily(
  "Reshuffle users rank based on top 50 xpCount for that day",
  {
    hourUTC: 12,
    minuteUTC: 30
  },
  internal.mutations.reshuffleRank
);


// TODO: Update the user stats daily for admin
crons.daily(
  "Update user stats for admin dashboard",
  {
    hourUTC: 12,
    minuteUTC: 30
  },
  internal.adminMutations.updateUserStats
)


export default crons;
