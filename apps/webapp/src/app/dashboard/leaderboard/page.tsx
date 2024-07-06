"use client";

import React, { Suspense, useEffect, useRef } from "react";
import Image from "next/image";
import { Loader } from "@/components/loader";
import ReturnHeader from "@/components/ReturnHeader";
import TrackPositions from "@/components/TrackPositions";
import { useSession } from "@/lib/sessionContext";
import { useQuery } from "convex/react";

import { api } from "@acme/api/convex/_generated/api";
import { Id } from "@acme/api/convex/_generated/dataModel";
import { useClient } from "@/lib/mountContext";

const Leaderboard = () => {
  const session = useSession();
  const isClient = useClient();

  const leaderBoards = useQuery(api.queries.getLeaderBoard, {
    userId: session?.userId as Id<"user"> | undefined,
  });


  // const adRef = useRef(null);

  // useEffect(() => {

  //   if ("Adsgram" in window) {
  //     console.log(window.Adsgram, ":::Adsgram initialised in window");
  //     // @ts-ignore
  //     adRef.current = window.Adsgram.init({ blockId: '331' });
  //   }

  // }, [isClient]);


  // // show add when page loads
  // useEffect(() => {

  //   if (adRef.current) {
  //     // @ts-ignore
  //     adRef.current?.show()
  //       .then((result: any) => {
  //         // fires when ad ends
  //         console.log(result, ":::Ads end result");
  //       })
  //       .catch((result: any) => {
  //         console.log(result, ":::Ad skip or error result");
  //       });

  //   }

  // }, [])


  return (
    <main className="pb-36 pt-28">
      <ReturnHeader page="leaderboard" push="/dashboard" />
      <div className="container">
        <div className="leader-banner">
          <div className="header-container-img">
            {/* <Image src="/profile.png" height={50} width={50} alt="profile" /> */}
            <span className="text-[40px]">👍</span>
          </div>
          <h3 className="text-lg font-normal">
            You are doing better than 80% of others
          </h3>
        </div>
      </div>

      {
        typeof leaderBoards === "undefined" ? <Loader color="white" /> : <TrackPositions leaderBoards={leaderBoards} />
      }
    </main>
  );
};

export default Leaderboard;
