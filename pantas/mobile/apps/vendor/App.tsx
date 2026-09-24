import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { colors, Spinner } from "@pantas/ui-kit";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import CatalogueScreen from "./src/screens/CatalogueScreen";
import ContractsScreen from "./src/screens/ContractsScreen";
import ListVehicleScreen from "./src/screens/ListVehicleScreen";
import type { AuthStackParamList, MainTabParamList } from "./src/navigation/types";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

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
      <Tabs.Screen name="Profile" component={ProfileScreen} />
      <Tabs.Screen name="Catalogue" component={CatalogueScreen} />
      <Tabs.Screen name="Contracts" component={ContractsScreen} options={{ title: "Contracts" }} />
      <Tabs.Screen name="ListVehicle" component={ListVehicleScreen} options={{ title: "Rent out a vehicle" }} />
    </Tabs.Navigator>
  );
}

function Root() {
  const { me, loading } = useAuth();
  if (loading) return <Spinner />;
  return (
    <NavigationContainer>
      {me ? <TabsNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <Root />
    </AuthProvider>
  );
}
