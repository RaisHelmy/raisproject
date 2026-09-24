import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { colors, Spinner } from "@pantas/ui-kit";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import FeedScreen from "./src/screens/FeedScreen";
import VehiclesScreen from "./src/screens/VehiclesScreen";
import PayoutsScreen from "./src/screens/PayoutsScreen";
import RentalsScreen from "./src/screens/RentalsScreen";
import JobDetailScreen from "./src/screens/JobDetailScreen";
import type { AuthStackParamList, MainTabParamList, RootStackParamList } from "./src/navigation/types";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function TabsNavigator() {
  return (
    <Tabs.Navigator screenOptions={{ headerTintColor: colors.primary }}>
      <Tabs.Screen name="Feed" component={FeedScreen} options={{ title: "Job feed" }} />
      <Tabs.Screen name="Vehicles" component={VehiclesScreen} />
      <Tabs.Screen name="Payouts" component={PayoutsScreen} />
      <Tabs.Screen name="Rentals" component={RentalsScreen} options={{ title: "Rent a vehicle" }} />
    </Tabs.Navigator>
  );
}

function MainNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerTintColor: colors.primary }}>
      <RootStack.Screen name="Tabs" component={TabsNavigator} options={{ headerShown: false }} />
      <RootStack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: "Job" }} />
    </RootStack.Navigator>
  );
}

function Root() {
  const { me, loading } = useAuth();
  if (loading) return <Spinner />;
  return <NavigationContainer>{me ? <MainNavigator /> : <AuthNavigator />}</NavigationContainer>;
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <Root />
    </AuthProvider>
  );
}
