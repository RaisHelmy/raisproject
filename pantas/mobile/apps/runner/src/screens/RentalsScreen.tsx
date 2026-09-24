import { useCallback, useState } from "react";
import { Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Badge, Button, Card, ListItem, Screen, TextField, colors } from "@pantas/ui-kit";
import { api, ApiError, type RentalBooking, type RentalListing } from "@pantas/api-client";

export default function RentalsScreen() {
  const [listings, setListings] = useState<RentalListing[]>([]);
  const [bookings, setBookings] = useState<RentalBooking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeListingId, setActiveListingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [l, b] = await Promise.all([
        api.get<RentalListing[]>("/rentals/listings"),
        api.get<RentalBooking[]>("/rentals/bookings/mine"),
      ]);
      setListings(l);
      setBookings(b);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function book(listing: RentalListing) {
    setError(null);
    if (!startDate || !endDate) {
      setError("Enter start and end dates (YYYY-MM-DD) first");
      return;
    }
    const days = Math.max(
      1,
      Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000),
    );
    try {
      await api.post("/rentals/bookings", {
        listingId: listing.id,
        startDate,
        endDate,
        totalFeeMinor: listing.dailyRateMinor * days,
        paymentMethod: "cash",
      });
      setActiveListingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not book");
    }
  }

  return (
    <Screen>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Vehicles available to rent</Text>
      {error && <Alert message={error} />}
      {listings.map((l) => (
        <Card key={l.id}>
          <Text>
            RM {(l.dailyRateMinor / 100).toFixed(2)}/day
            {l.declaredDepositMinor
              ? ` · deposit RM ${(l.declaredDepositMinor / 100).toFixed(2)} (collected directly by owner)`
              : ""}
          </Text>
          {activeListingId === l.id ? (
            <>
              <TextField label="Start date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} />
              <TextField label="End date (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} />
              <Button title="Confirm request" size="sm" onPress={() => book(l)} />
            </>
          ) : (
            <Button title="Request booking" size="sm" onPress={() => setActiveListingId(l.id)} />
          )}
        </Card>
      ))}

      <Text style={{ fontSize: 18, fontWeight: "700" }}>My bookings</Text>
      {bookings.length === 0 && <Text style={{ color: colors.muted }}>None yet.</Text>}
      {bookings.map((b) => (
        <ListItem
          key={b.id}
          title={`RM ${(b.totalFeeMinor / 100).toFixed(2)}`}
          right={<Badge label={b.status} color="secondary" />}
        />
      ))}
    </Screen>
  );
}
