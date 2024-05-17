"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useSession } from "@/lib/sessionContext";
import { useQuery } from "convex/react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { BiRedo } from "react-icons/bi";
import { IoCopyOutline } from "react-icons/io5";

import { api } from "@acme/api/convex/_generated/api";
import { Doc, Id } from "@acme/api/convex/_generated/dataModel";

const ShareLink = () => {
  const { toast } = useToast();
  const referral = "https://ui.shadcn.com/docs/installation";

  const session = useSession();

  const user: Doc<"user"> | undefined = useQuery(api.queries.getUserDetails, {
    userId: session?.userId as Id<"user">,
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="dark:bg-primary-dark flex h-fit items-center gap-2 rounded-lg bg-black px-6 py-4 text-lg text-white">
          <BiRedo />
          <span>Share code</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="background max-w-md rounded-xl border-0 py-10 ring-0">
        <DialogHeader>
          <DialogTitle className="text-lg">Share code</DialogTitle>
          <DialogDescription className="text-base">
            Anyone who has this link will be able to view this.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="link" className="sr-only">
              Code
            </Label>
            <Input
              className="foreground border-0"
              id="link"
              defaultValue={user && user?.referralCode}
              readOnly
            />
          </div>
          <CopyToClipboard
            text={user ? (user?.referralCode ? user.referralCode : "") : ""}
            onCopy={() => {
              toast({
                title: user && user?.referralCode,
                description: "You have successfully copied your referral link",
              });
            }}
          >
            <Button
              type="submit"
              size="sm"
              className="bg-black px-3 text-white dark:bg-white dark:text-black"
            >
              <span className="sr-only">Copy</span>
              <IoCopyOutline />
            </Button>
          </CopyToClipboard>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareLink;
