"use client";

import { FC, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader } from "@/components/loader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSession } from "@/lib/sessionContext";
import { delay } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { FaDiscord, FaTelegramPlane } from "react-icons/fa";
import { FaCircleCheck, FaXTwitter } from "react-icons/fa6";
import { HiMiniUserGroup } from "react-icons/hi2";
import { IoIosArrowForward } from "react-icons/io";

import { api } from "@acme/api/convex/_generated/api";
import { Doc, Id } from "@acme/api/convex/_generated/dataModel";
import { useClient } from "@/lib/mountContext";

const Tasks: FC<{ userDetails: Doc<"user"> | null | undefined }> = ({ userDetails }) => {
  const session = useSession();

  const tasks = useQuery(api.queries.fetchTasks, {
    userId: (session?.userId ?? userDetails?._id) as Id<"user">,
  });

  // const config = useQuery(api.queries.getAppConfigForApp);

  return (
    <div>
      <h5 className="mb-8 mt-6 text-center text-lg font-semibold">
        Simple task for more Xp`s
      </h5>
      {typeof tasks !== "undefined" ? <TaskItems
        tasks={tasks}
        userDetails={userDetails}
      /> : <Loader color="white" />
      }    </div>
  );
};

const TaskItems: FC<{ tasks: Doc<"tasks">[] | undefined; userDetails: Doc<"user"> | null | undefined }> = ({
  tasks,
  userDetails,
}) => {
  const user = userDetails;
  const isClient = useClient();

  // Collect task reward
  const collectReward = useMutation(api.mutations.rewardTaskXp);

  if (tasks && tasks?.length) {
    return (
      <ul className="grid gap-4 ">
        {tasks.map((item, ki) => {
          const completedTask = user?.completedTasks?.includes(item?._id);

          return (
            <Item
              item={item}
              ki={ki}
              key={ki}
              completedTask={completedTask}
              collectReward={collectReward}
              userId={userDetails?._id}
              isClient={isClient}
            />
          );
        })}
      </ul>
    );
  } else if (tasks && !tasks?.length) {
    return (
      <p className="text-center text-lg font-medium text-black dark:text-white">
        There are no tasks at this time, check back later
      </p>
    );
  } else {
    return <Loader color="white" />;
  }
};

const Item: FC<{
  item: any;
  completedTask: boolean | undefined;
  ki: number;
  collectReward: any;
  userId: Id<"user"> | undefined;
  isClient: boolean
}> = ({ item, completedTask, ki, collectReward, userId, isClient }) => {
  const [dialogOpen, setDialogOpen] = useState(false);


  const adRef = useRef(null);

  useEffect(() => {

    if ("Adsgram" in window) {
      console.log(window.Adsgram, ":::Adsgram initialised in window");
      // @ts-ignore
      adRef.current = window.Adsgram.init({ blockId: '331' });
    }

  }, [isClient]);


  return (
    <Dialog
      open={dialogOpen}
    // onOpenChange={(open) => setDialogOpen(open)}
    >
      <DialogTrigger asChild>
        <li key={ki} className="task-list">
          <Link
            href={item?.action?.link}
            target="_blank"
            className={`px-5 py-4 ${completedTask ? "opacity-30" : ""
              } block space-y-2`}
            onClick={async (e) => {
              if (completedTask) {
                e.preventDefault();
              } else {
                await delay(2);
                setDialogOpen(true);
              }
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="icon-container">
                  {item?.action.channel === "website" && !completedTask && (
                    <HiMiniUserGroup />
                  )}
                  {item?.action?.channel === "twitter" && !completedTask && (
                    <FaXTwitter />
                  )}
                  {item?.action.channel == "discord" && !completedTask && (
                    <FaDiscord />
                  )}
                  {item?.action.channel == "telegram" && !completedTask && (
                    <FaTelegramPlane />
                  )}
                  {completedTask && <FaCircleCheck />}
                </div>
                <div>
                  <h4 className="text-[22px] font-semibold">{item?.name}</h4>
                </div>
              </div>
              <div>
                {!completedTask && (
                  <IoIosArrowForward className="text-xl text-black dark:text-white" />
                )}
              </div>
            </div>

            <p className="background inline-block rounded-full px-2 py-1 text-lg font-semibold text-[#767676]">
              {completedTask ? (
                "Completed"
              ) : (
                <span>
                  +
                  {Number(item?.reward ?? 0).toLocaleString("en-US", {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2,
                  })}{" "}
                  XP
                </span>
              )}
            </p>
          </Link>
        </li>
      </DialogTrigger>
      <DialogContent className="background dark:border-background-dark z-[999] mx-auto max-w-md rounded-xl border-background text-black dark:text-white">
        <div className="grid items-center justify-center gap-4 p-4">
          <h1>
            Claim task reward:{" "}
            {Number(item?.reward ?? 0).toLocaleString("en-US", {
              maximumFractionDigits: 2,
              minimumFractionDigits: 2,
            })}{" "}
            XP
          </h1>
          <DialogClose asChild>
            <Button
              className="twitter-btn"
              onClick={async () => {

                if (adRef.current) {
                  // @ts-ignore
                  adRef.current?.show()
                    .then((result: any) => {
                      // fires when ad ends
                      console.log(result, ":::Ads end result");
                    })
                    .catch((result: any) => {
                      console.log(result, ":::Ad skip or error result");
                    });

                }

                await collectReward({
                  userId: userId as Id<"user">,
                  xpCount: item?.reward as number,
                  taskId: item?._id,
                });
                setDialogOpen(false);
              }}
            >
              Claim XP reward
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Tasks;
