"use client";

import React, { FC, useEffect, useRef } from "react";
import { useSession } from "@/lib/sessionContext";
import { useAction, useMutation, useQuery } from "convex/react";
import { BiCoinStack } from "react-icons/bi";

import { api } from "@acme/api/convex/_generated/api";
import { Doc, Id } from "@acme/api/convex/_generated/dataModel";

import { Button } from "../ui/button";
import { useToast } from "../ui/use-toast";
import { useClient } from "@/lib/mountContext";

type Mining = {
  mined: number;
  mining: number;
  mineHours: number;
  time: string;
  rate: number;
  userId: string | undefined;
  userDetail: Doc<"user"> | null | undefined;
};

const MiningStats: FC<Mining> = ({ mined, mining, mineHours, time, rate, userId, userDetail }) => {
  const { toast } = useToast();
  const session = useSession();
  const isClient = useClient();

  // Call start miner function
  const triggerMiner = useMutation(api.mutations.triggerMining);
  // claim mine reward
  const claimReward = useMutation(api.mutations.claimRewards);


  const adRef = useRef(null);

  useEffect(() => {

    if ("Adsgram" in window) {
      console.log(window.Adsgram, ":::Adsgram initialised in window");
      // @ts-ignore
      adRef.current = window.Adsgram.init({ blockId: '331' });
    }

  }, [isClient]);

  const MineButton = () => userDetail?.mineActive ? (
    <Button
      className="h-fit gap-2 bg-white py-4 text-black"
      // disabled
      onClick={() => {
        // if (adRef.current) {
        //   // @ts-ignore
        //   adRef.current?.show()
        //     .then((result: any) => {
        //       // fires when ad ends
        //       console.log(result, ":::Ads end result");
        //     })
        //     .catch((result: any) => {
        //       console.log(result, ":::Ad skip or error result");
        //     });

        // }
        toast({
          title: "There is a mining session currently active",
        });
      }}
    >
      <span className="text-black">Mining Active</span>{" "}
      <BiCoinStack className="shrink-0" color="black" />
    </Button>

  ) : (
    <Button
      className={`tag gap-2`}
      style={{
        backgroundColor: userDetail?.mineActive ? "white" : "black",
        color: userDetail?.mineActive ? "black" : "white",
      }}
      onClick={async () => {

        if (userDetail && userDetail.redeemableCount <= 0 && !userDetail?.mineActive) {
          await triggerMiner({
            userId: (session?.userId ?? userId) as Id<"user">,
          });
        } else {
          await claimReward({
            userId: (session?.userId ?? userId) as Id<"user">,
          });
          toast({
            title: "Mine reward successfully claimed!",
          });
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
        }
      }}
    >
      {userDetail && userDetail?.redeemableCount <= 0 && !userDetail?.mineActive && (
        <>
          Start Mining <BiCoinStack className="shrink-0" />
        </>
      )}

      {userDetail && userDetail?.redeemableCount > 0 && !userDetail?.mineActive && (
        <>
          Claim $FOUND {userDetail?.redeemableCount ?? 0}{" "}
          <BiCoinStack className="shrink-0" />
        </>
      )

      }
    </Button>

  );

  return (
    <div className="mining-stats">
      <h3 className="text-lg">
        $FOUND Mined: <span>{mined.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</span>
      </h3>
      <p>Mining: {mining.toFixed(4)}</p>
      <p>{time}</p>
      <div>
        <div className="tag">
          Mining rate : <span className="font-normal">{rate} FOUND/hr</span>
        </div>
        <MineButton />
      </div>
    </div>
  );
};

export default MiningStats;
