"use client";

import { useSearchParams } from "next/navigation";

export default function AuctionClient() {
  const searchParams = useSearchParams();

  // Example: read query params (keep or remove as per your code)
  const room = searchParams.get("room");

  return (
    <div>
      {/* Move your existing /auction UI code here */}
      <div>Room: {room ?? "-"}</div>
    </div>
  );
}
