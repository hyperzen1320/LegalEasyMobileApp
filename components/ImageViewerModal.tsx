import { useCallback } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

const AnimatedImage = Animated.createAnimatedComponent(Image);

// Full-screen, WhatsApp-style image viewer for Senior Desk attachments.
// Pinch + pan + double-tap to zoom. The top bar carries the only Share button —
// so tapping a chat image opens THIS viewer, and the OS share sheet fires only
// when the advocate taps Share (previously tapping an image jumped straight to
// the share sheet). Built on the gesture-handler + reanimated already in the
// app, so no new dependency and it works in Expo Go and standalone builds.
export default function ImageViewerModal({
  visible,
  uri,
  headers,
  filename,
  busy,
  onClose,
  onShare,
}: {
  visible: boolean;
  uri: string;
  headers?: Record<string, string>;
  filename?: string;
  busy?: boolean;
  onClose: () => void;
  onShare: () => void;
}) {
  const { width, height } = useWindowDimensions();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const resetZoom = useCallback(() => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
  }, [scale, savedScale, tx, ty, savedTx, savedTy]);

  const handleClose = useCallback(() => {
    resetZoom();
    onClose();
  }, [resetZoom, onClose]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), 5);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      // Snap back to fit when the user pinches below 1×.
      if (scale.value <= 1.01) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedScale.value = 1;
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        tx.value = savedTx.value + e.translationX;
        ty.value = savedTy.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedScale.value = 1;
        savedTx.value = 0;
        savedTy.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView
        style={{ flex: 1, backgroundColor: "rgba(7,10,20,0.97)" }}
      >
        <GestureDetector gesture={gesture}>
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <AnimatedImage
              source={{ uri, headers }}
              style={[{ width, height }, imageStyle]}
              resizeMode="contain"
            />
          </View>
        </GestureDetector>

        {/* Top bar — back (close) on the left, Share on the right. */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            paddingTop: 46,
            paddingBottom: 12,
            paddingHorizontal: 8,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.32)",
          }}
        >
          <Pressable
            onPress={handleClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close image"
            style={{
              height: 42,
              width: 42,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="arrow-left" size={23} color="#ffffff" />
          </Pressable>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              marginHorizontal: 6,
              color: "rgba(255,255,255,0.9)",
              fontFamily: "Manrope-Medium",
              fontSize: 13,
            }}
          >
            {filename || "Image"}
          </Text>
          <Pressable
            onPress={onShare}
            disabled={busy}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Share image"
            style={{
              height: 42,
              width: 42,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Feather name="share-2" size={20} color="#ffffff" />
            )}
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
