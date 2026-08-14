import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { InlineNotice } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { parseInviteToken } from '@/features/invites/invite-link';
import { useTheme } from '@/hooks/use-theme';

export function InviteQrCode({ value }: { value: string }) {
  // Scanners need a fixed dark-on-white code, so this pair never follows the theme.
  return (
    <View accessible accessibilityLabel="TripFlow invite QR code" style={styles.qrFrame}>
      <QRCode value={value} size={210} color="#102A43" backgroundColor="#FFFFFF" />
    </View>
  );
}

export function InviteQrScanner(props: {
  onToken: (token: string) => void;
  tx: (zh: string, en: string) => string;
}) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string>();

  function handleBarcode({ data }: BarcodeScanningResult) {
    if (scanned) return;
    setScanned(true);
    const token = parseInviteToken(data);
    if (token) {
      props.onToken(token);
      return;
    }
    setError(props.tx('这不是有效的 TripFlow 邀请二维码。', 'This is not a valid TripFlow invite QR code.'));
  }

  async function askForPermission() {
    setError(undefined);
    try {
      await requestPermission();
    } catch {
      setError(props.tx('无法申请相机权限，请在系统设置中允许 TripFlow 使用相机。', 'Could not request camera access. Allow TripFlow to use the camera in system settings.'));
    }
  }

  if (!permission) return <InlineNotice>{props.tx('正在检查相机权限…', 'Checking camera permission…')}</InlineNotice>;
  if (!permission.granted) {
    return (
      <View style={styles.permissionBlock}>
        <InlineNotice>{props.tx('扫码加入需要相机权限；也可以继续粘贴邀请码。', 'Camera access is needed to scan. You can still paste an invite code.')}</InlineNotice>
        <Pressable accessibilityRole="button" onPress={() => void askForPermission()} style={({ pressed }) => [styles.scanAction, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={{ color: theme.textOnAccent }}>{props.tx('允许使用相机', 'Allow camera')}</ThemedText>
        </Pressable>
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      </View>
    );
  }

  return (
    <View style={styles.scannerBlock}>
      <View style={styles.cameraFrame}>
        <CameraView
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarcode}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.finder} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">{props.tx('将邀请二维码放入方框内。识别后仍需确认加入。', 'Place the invite QR code inside the frame. You will still confirm before joining.')}</ThemedText>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {scanned ? (
        <Pressable accessibilityRole="button" onPress={() => { setScanned(false); setError(undefined); }} style={({ pressed }) => [styles.scanAction, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={{ color: theme.textOnAccent }}>{props.tx('重新扫描', 'Scan again')}</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  qrFrame: { alignSelf: 'center', padding: 14, borderRadius: 18, backgroundColor: '#FFFFFF' },
  permissionBlock: { gap: 10 },
  scannerBlock: { gap: 10 },
  cameraFrame: { height: 300, overflow: 'hidden', borderRadius: 18, backgroundColor: '#102A43', alignItems: 'center', justifyContent: 'center' },
  finder: { width: 210, height: 210, borderRadius: 20, borderWidth: 3, borderColor: '#FFFFFF' },
  scanAction: { minHeight: 46, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  pressed: { opacity: 0.7 },
});
