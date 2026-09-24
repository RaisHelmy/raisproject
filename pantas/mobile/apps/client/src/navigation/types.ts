export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Schedules: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  JobDetail: { jobId: string };
};
