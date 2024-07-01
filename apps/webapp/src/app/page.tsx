"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import WebApp from "@twa-dev/sdk";
import { MainButton } from "@twa-dev/sdk/react";
import { useClient } from "@/lib/mountContext";
import { Button } from "@/components/ui/button";
import { useAction, useQuery } from "convex/react";
import { api } from "@acme/api/convex/_generated/api";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader } from "@/components/loader";
import { getErrorMsg } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const isClient = useClient();
  // const searchParams = useSearchParams();
  const [isCreatingLoading, setIsCreatingLoading] = useState(false);
  const [entryLoader, setEntryLoader] = useState(true);

  const [refCode, setRefCode] = useState<string>();


  // const refCode = searchParams.get("refCode");
  // console.log(refCode, ":::gotten referral code");
  const creatTgUserAccount = useAction(api.onboarding.initializeNewUser);
  const checkTgUser = useQuery(api.queries.checkTgUserAndLink, { tgInitData: (typeof window !== "undefined" && WebApp.initDataUnsafe && WebApp.initData.length) ? JSON.stringify(WebApp.initDataUnsafe) : undefined });

  useEffect(() => {

    if (typeof window !== "undefined" && !!WebApp.initData.length) {
      // WebApp.showPopup({message: "Link an existing account or create a new one with telegram user information", title: "Link/Create Account"}, (id) => {console.log(id, ":::Id of pop up")});
      // @ts-ignore
      console.log(WebApp.initData, WebApp.initDataUnsafe, ":::init data inside entry page",);
      const localItem = localStorage.getItem('fd-session');
      const session = localItem ? JSON.parse(localItem) : null;

      if (WebApp.initDataUnsafe?.start_param || WebApp.initDataUnsafe?.start_param?.length) {
        setRefCode(WebApp.initDataUnsafe.start_param);
      }

      //TODO: uncomment when all fixes to referral has been done
      if (session && session?.isOnboarded) {
        setEntryLoader(false);
        router.replace(`/dashboard?userId=${session?.userId}`);
      }
      setEntryLoader(false);

    } else {
      const localItem = localStorage.getItem('fd-session');
      const session = localItem ? JSON.parse(localItem) : null;

      if (session && session?.isOnboarded) {
        setEntryLoader(false);
        router.replace("/dashboard");
      } else {
        setEntryLoader(false);
        router.replace("/authentication");
      }
    }
  }, [isClient]);



  return (
    <main className="flex flex-col items-center justify-center gap-24 min-h-screen">
      <Dialog open={entryLoader}>
        <DialogContent hideCloseBtn className="grid items-center gap-2 justify-center shadow-none outline-none border-none">
          <Loader color="white" />
        </DialogContent>
      </Dialog>

      <Dialog open={isCreatingLoading}>
        <DialogContent hideCloseBtn className="grid items-center gap-2 justify-center shadow-none outline-none border-none">
          <Loader color="white" />
          <span className="text-white text-lg font-normal text-center">Creating your foundation account...</span>
        </DialogContent>
      </Dialog>
      <div className="flex shrink-0 flex-col items-center justify-center gap-3">
        <Image
          src="/foundation.svg"
          alt="Logo"
          height={130}
          width={130}
          priority
          className="shrink-0 invert dark:invert-0"
        />
        <div className="relative h-14 w-64 shrink-0 object-contain">
          <Image
            src="/foundation-text.png"
            alt="Logo"
            fill={true}
            sizes="100%"
            className="invert-0 dark:invert"
          />
        </div>
      </div>
      <div className="relative h-16 w-40 shrink-0 justify-self-end object-contain">
        {/*        <Image
          src="/powered.png"
          alt="Logo"
          fill={true}
          sizes="100%"
          className="invert dark:invert-0"
        /> */}
      </div>

      {isClient && (typeof window !== "undefined") && !!WebApp.initData.length &&
        (
          <div className="flex w-full items-center justify-center gap-2 px-2">
            <Button className="btn flex-1" onClick={() => {
              if (isClient && checkTgUser?.isTgUser) {
                localStorage.setItem(
                  "fd-session",
                  JSON.stringify({ userId: checkTgUser?.userId, isOnboarded: true, isTgUser: checkTgUser?.isTgUser }),
                );
                router.push(`/dashboard?userId=${checkTgUser?.userId}`);

              } else {
                router.push(`/authentication?type=tg`);
              }
            }}>Link telegram</Button>

            <Button className="btn-username flex-1" variant="secondary" onClick={async () => {
              //> TODO: cerate user account with TG details
              try {

                setIsCreatingLoading(true);

                const userId = await creatTgUserAccount({
                  email: undefined,
                  referreeCode: refCode ? refCode : undefined,
                  type: "tg",
                  tgInitData: JSON.stringify(WebApp.initDataUnsafe.user)
                });
                // Set session before pushing
                localStorage.setItem(
                  "fd-session",
                  JSON.stringify({ userId: userId, isOnboarded: true, isTgUser: true }),
                );
                setIsCreatingLoading(false);

                router.push(`/dashboard?userId=${userId}`);
              } catch (err: any) {
                setIsCreatingLoading(false);

                const message = getErrorMsg(err);
                if (typeof window !== "undefined" && !!WebApp.initData.length) {
                  WebApp.showAlert(message);
                } else {
                  toast({
                    description: message,
                    variant: "destructive"
                  })
                }
              }
            }} >Create Account</Button>
          </div>
        )}
    </main>
  );
}
