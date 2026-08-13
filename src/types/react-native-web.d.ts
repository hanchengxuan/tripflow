import 'react-native';

declare module 'react-native' {
  interface ViewStyle {
    /** @platform web */
    backdropFilter?: string;
  }
}
