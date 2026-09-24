export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Feed: undefined;
  Vehicles: undefined;
  Payouts: undefined;
  Rentals: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  JobDetail: { jobId: string };
};
