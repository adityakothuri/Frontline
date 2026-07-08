// Native map primitives, re-exported from react-native-maps.
//
// react-native-maps has NO web renderer — importing it in a web bundle throws
// (`codegenNativeComponent is not a function`). So on web, Metro resolves the
// sibling `maps.web.tsx` instead, which renders a calm placeholder. The Alerts
// tab shows the same data fully on web, so nothing is lost. On iOS/Android this
// file is used and the real native map renders.
export { default as MapView, Marker } from 'react-native-maps';
