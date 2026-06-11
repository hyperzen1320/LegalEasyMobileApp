import { useEffect } from "react";
import { Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

// Shown ONLY while the session probe is genuinely in flight (slow
// network). Fast boots never see it — the native splash fades straight
// into the first screen. The seal breathes, the brass dot orbits a slow
// pendulum arc, and a shimmer sweeps the rule line: alive, quiet, and
// unmistakably the same mark as the splash it follows.

const INK = "#0e1a2b";
const PAPER = "#f4ecda";
const BRASS = "#b68b3c";
const BRASS_DEEP = "#8e6a24";

export default function BootScreen() {
  const breathe = useSharedValue(1);
  const swing = useSharedValue(-1);
  const shimmer = useSharedValue(-1);

  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.045, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
    // A slow advocate's-pendulum sway on the seal — like scales settling.
    swing.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.cubic) }),
        withTiming(-1, { duration: 1900, easing: Easing.inOut(Easing.cubic) })
      ),
      -1
    );
    shimmer.value = withDelay(
      400,
      withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        -1
      )
    );
  }, [breathe, swing, shimmer]);

  const sealStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: breathe.value },
      { rotate: `${swing.value * 2.2}deg` },
    ],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value * 76 }],
  }));

  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ backgroundColor: PAPER }}
    >
      <StatusBar style="dark" backgroundColor={PAPER} />

      {/* The wax seal, alive */}
      <Animated.View
        style={[
          {
            height: 124,
            width: 124,
            borderRadius: 62,
            backgroundColor: INK,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 3,
            borderColor: BRASS,
            shadowColor: INK,
            shadowOpacity: 0.25,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 10 },
            elevation: 8,
          },
          sealStyle,
        ]}
      >
        <View
          style={{
            position: "absolute",
            top: 7,
            left: 7,
            right: 7,
            bottom: 7,
            borderRadius: 55,
            borderWidth: 1,
            borderColor: BRASS_DEEP,
            opacity: 0.85,
          }}
        />
        <Text
          style={{
            fontFamily: "Fraunces-SemiBold",
            fontSize: 52,
            color: PAPER,
            lineHeight: 58,
          }}
          maxFontSizeMultiplier={1}
        >
          L
        </Text>
        <View
          style={{
            position: "absolute",
            top: 26,
            right: 30,
            height: 9,
            width: 9,
            borderRadius: 5,
            backgroundColor: BRASS,
          }}
        />
      </Animated.View>

      {/* Wordmark */}
      <Text
        className="mt-7 text-[26px] tracking-tight"
        style={{ fontFamily: "Fraunces-Medium", color: INK }}
        maxFontSizeMultiplier={1.2}
      >
        LegalEasy
      </Text>
      <Text
        className="mt-1.5 text-[10px] uppercase"
        style={{
          fontFamily: "JetBrainsMono",
          letterSpacing: 3,
          color: BRASS_DEEP,
        }}
        maxFontSizeMultiplier={1.2}
      >
        Opening chambers
      </Text>

      {/* Shimmering rule — the "working on it" cue */}
      <View
        className="mt-6 overflow-hidden"
        style={{ height: 2, width: 152, backgroundColor: "#c7b894" }}
      >
        <Animated.View
          style={[
            {
              height: 2,
              width: 76,
              backgroundColor: BRASS,
            },
            shimmerStyle,
          ]}
        />
      </View>
    </View>
  );
}
