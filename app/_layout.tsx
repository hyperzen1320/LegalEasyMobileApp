import "../global.css";
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import {
  Fraunces_500Medium,
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold,
} from "@expo-google-fonts/fraunces";
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
} from "@expo-google-fonts/newsreader";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from "@expo-google-fonts/ibm-plex-sans";
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from "@expo-google-fonts/ibm-plex-mono";
import {
  CrimsonPro_400Regular,
  CrimsonPro_400Regular_Italic,
  CrimsonPro_600SemiBold,
  CrimsonPro_600SemiBold_Italic,
} from "@expo-google-fonts/crimson-pro";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";
import {
  DMMono_400Regular,
  DMMono_500Medium,
} from "@expo-google-fonts/dm-mono";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View } from "react-native";
import { useEffect } from "react";
import { AuthProvider } from "../lib/auth-context";
import { applyOrientationPolicy } from "../lib/orientation";

export default function RootLayout() {
  // Phones lock portrait, tablets rotate freely — runtime-applied because
  // Expo Go ignores app.json's static orientation field.
  useEffect(() => {
    applyOrientationPolicy();
  }, []);

  const [fontsLoaded] = useFonts({
    // Editorial Gravitas
    "Fraunces-Medium": Fraunces_500Medium,
    "Fraunces-MediumItalic": Fraunces_500Medium_Italic,
    "Fraunces-SemiBold": Fraunces_600SemiBold,
    Newsreader: Newsreader_400Regular,
    "Newsreader-Italic": Newsreader_400Regular_Italic,
    JetBrainsMono: JetBrainsMono_400Regular,
    "JetBrainsMono-Medium": JetBrainsMono_500Medium,
    // Pocket Plex (admin)
    PlexSans: IBMPlexSans_400Regular,
    "PlexSans-Medium": IBMPlexSans_500Medium,
    "PlexSans-SemiBold": IBMPlexSans_600SemiBold,
    PlexMono: IBMPlexMono_400Regular,
    "PlexMono-Medium": IBMPlexMono_500Medium,
    // Midnight Counsel (partner app)
    Crimson: CrimsonPro_400Regular,
    "Crimson-Italic": CrimsonPro_400Regular_Italic,
    "Crimson-SemiBold": CrimsonPro_600SemiBold,
    "Crimson-SemiBoldItalic": CrimsonPro_600SemiBold_Italic,
    Manrope: Manrope_400Regular,
    "Manrope-Medium": Manrope_500Medium,
    "Manrope-SemiBold": Manrope_600SemiBold,
    "Manrope-Bold": Manrope_700Bold,
    DMMono: DMMono_400Regular,
    "DMMono-Medium": DMMono_500Medium,
  });

  if (!fontsLoaded) {
    return <View className="flex-1 bg-paper" />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#f4ecda" },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(admin)" options={{ animation: "fade" }} />
            <Stack.Screen name="(home)" options={{ animation: "fade" }} />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
