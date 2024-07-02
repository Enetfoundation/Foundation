"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Overview from "@/components/dashboard/Overview";
import PlannedTask from "@/components/dashboard/PlannedTask";
import Status from "@/components/dashboard/Status";
import ClaimXP from "@/components/dashboard/task/ClaimXP";
import TwitterProfile from "@/components/dashboard/TwitterProfile";
import Header from "@/components/Header";
import { useSession } from "@/lib/sessionContext";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { HiMiniUserGroup } from "react-icons/hi2";

import type { Doc, Id } from "@acme/api/convex/_generated/dataModel";
import { api } from "@acme/api/convex/_generated/api";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader } from "@/components/loader";
import AdBanner from "@/components/dashboard/AdBanner";
import WebApp from "@twa-dev/sdk";
import { useClient } from "@/lib/mountContext";
import { useRouter } from "next/navigation";

export type EventType = Partial<Doc<"events">> & {
  company: Partial<Doc<"company">> & { logoUrl: string };
};

const Dashboard = () => {
  const session = useSession();
  const searchParams = useSearchParams();
  const isClient = useClient();
  const router = useRouter();

  const userId = searchParams.get("userId") as string | undefined;

  // Fetch users data
  const userDetail = useQuery(api.queries.getUserDetails, {
    userId: session && session?.userId ? (session.userId ?? userId) as Id<"user"> : undefined,
  });

  // const claimReward = useMutation(api.mutations.claimRewards);

  // console.log(bottom, top, ":::Bottom Top, size", height, height - top);

  // handle tasks cycle
  const [isLoadingModalVisible, setLoadingModalVisible] = useState(session?.isLoading && typeof userDetail === "undefined" ? true : false);
  // refLInk
  const [refLink, setRefLink] = useState<string>();
  const adRef = useRef(null);

  useEffect(() => {

    if ("Adsgram" in window) {
      console.log(window.Adsgram, ":::Adsgram initialised in window");
      // @ts-ignore
      adRef.current = window.Adsgram.init({ blockId: '331' });
    }

  }, [isClient]);


  // show add when page loads
  useEffect(() => {

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

  }, [])



  // toggle loader modal
  useEffect(() => {

    console.log(typeof userDetail, session, ":::SettingLoader");

    if (userDetail && typeof userDetail !== "undefined" && !session?.isLoading) {
      console.log("Session has been updated");
      setLoadingModalVisible(false);
    }

  }, [userDetail, session?.isLoading, session, isClient, isLoadingModalVisible, setLoadingModalVisible])


  useEffect(() => {
    if (userDetail) {
      console.log(userDetail?.mineHours, ":::Mine hours");
      setRefLink(
        process.env.NODE_ENV === "development"
          ? `http://localhost:3000?ref=${userDetail?.referralCode}` :
          (typeof window !== "undefined" && "WebApp" in window.Telegram && !!WebApp.initData.length) ? `https://t.me/FoundationMinerBot/foundation?startapp=${userDetail.referralCode}`
            : `https://app.enetfoundation.com?refCode=${userDetail?.referralCode}`,
      );
    }
  }, [userDetail]);

  return (
    <main className="container pb-10 pt-32">
      <Dialog open={isLoadingModalVisible}>
        <DialogContent hideCloseBtn className="bg-transparent border-none outline-none shadow-none">
          <Loader color="white" />
        </DialogContent>
      </Dialog>
      <Header nickname={userDetail?.tgUsername ?? userDetail?.nickname} />
      <Status
        mineRate={userDetail?.miningRate ?? 0}
        minedCount={userDetail?.minedCount ?? 0}
        mineHours={userDetail?.mineHours ?? 0}
        userId={userId}
        userDetail={userDetail}
      />
      <h3 className="mb-2 mt-7 text-base font-semibold">Overview</h3>
      <Overview
        rank={userDetail?.rank ?? 50}
        referrals={userDetail?.referralCount ?? 16}
        users={0}
        referralCode={refLink ?? "gzrhjtw5"}
      />
      <div className="my-10">
        <Link
          href={
            userId
              ? `/dashboard/referral?userId=${userId}&refCode=${userDetail?.referralCode}&refCount=${userDetail?.referralCount}`
              : `/dashboard/referral?refCode=${userDetail?.referralCode}&refCount=${userDetail?.referralCount}`
          }
          className="referral-container"
        >
          <div className="rounded-lg bg-[#f5f5f5] p-3 dark:bg-[#23262D]">
            <HiMiniUserGroup className="text-4xl text-black dark:text-white" />
          </div>
          <div>
            <h3>Invite Friends</h3>
            <p className="text-base text-[#989898]">
              The more users you refer , the more $FOUND you earn
            </p>
          </div>
        </Link>
      </div>
      {typeof userDetail !== "undefined" && !session?.isLoading && <PlannedTask userDetail={userDetail} userId={userDetail?._id ?? session?.userId} />}
      <TwitterProfile />
      {/*<AdBanner dataAdSlot="2550264144" dataAdFormat="auto" dataFullWidthResponsive={true} /> */}
      {/* <ClaimXP /> */}
    </main>
  );
};

export default Dashboard;
