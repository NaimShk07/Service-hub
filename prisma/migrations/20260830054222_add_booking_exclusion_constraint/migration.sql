CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings"
ADD CONSTRAINT "no_provider_booking_overlap"
EXCLUDE USING gist (
  "providerId" WITH =,
  tsrange("bookingDate" + "startTime", "bookingDate" + "endTime") WITH &&
)
WHERE (
  "bookingStatus" IN ('PENDING_PAYMENT', 'CONFIRMED')
);
