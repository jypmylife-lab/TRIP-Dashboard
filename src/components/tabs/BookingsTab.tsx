"use client";
import FlightsTab from "./FlightsTab";
import AccommodationsTab from "./AccommodationsTab";

export default function BookingsTab({ trip, nickname }: { trip: any; nickname: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <FlightsTab trip={trip} nickname={nickname} />
      <AccommodationsTab trip={trip} nickname={nickname} />
    </div>
  );
}
