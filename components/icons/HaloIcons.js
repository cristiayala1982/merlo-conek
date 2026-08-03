import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * HALO ICON SYSTEM - MERLO CONEK
 * Todos los iconos tienen un estilo unificado con strokeWidth: 1.2
 */

// 1. CAMPANA (Notificaciones)
export function HaloBellIcon({ size = 32, color = '#333333', strokeWidth = 1.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// 2. MENSAJE (Chats)
export function HaloMessageIcon({ size = 32, color = '#333333', strokeWidth = 1.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M8 9h8M8 13h5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

// 3. TIENDA (Marketplace)
export function HaloMarketIcon({ size = 32, color = '#333333', strokeWidth = 1.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.5 10v9a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M3 10l2-6h14l2 6H3z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 21v-3.5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v3.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M8.5 4l0.5 6M15.5 4l-0.5 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

// 4. CÁMARA (Historias)
export function HaloCameraIcon({ size = 36, color = '#333333', strokeWidth = 1.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 20H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1-2h8l1 2h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect x="17" y="7.5" width="2" height="1" rx="0.5" fill={color} />
      <Circle cx="12" cy="13.5" r="4.5" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M10.5 12c-0.5 1-0.5 2 0 3 M13.5 12c0.5 1 0.5 2 0 3 M10.5 13.5c1-0.5 2 0.5 3 0" stroke={color} strokeWidth={1} strokeLinecap="round" />
      <Path d="M21 5l.3.8a.4.4 0 0 0 .4.3l.8.3-.8.3a.4.4 0 0 0-.4.3l-.3.8-.3-.8a.4.4 0 0 0-.4-.3l-.8-.3.8-.3a.4.4 0 0 0 .4-.3l.3-.8z" fill={color} />
    </Svg>
  );
}

// 5. MENÚ (Opciones Navbar)
export function HaloOptionsIcon({ size = 32, color = '#333333', strokeWidth = 1.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 7h14M5 12h14M5 17h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

// 6. BUSCAR (Lupa)
export function HaloSearchIcon({ size = 32, color = '#333333', strokeWidth = 1.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="8" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M21 21l-4.35-4.35" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

// 7. AGREGAR (Crear Post)
export function HaloAddIcon({ size = 32, color = '#333333', strokeWidth = 1.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M12 8v8M8 12h8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

// 8. AJUSTES (Gear)
export function HaloSettingsIcon({ size = 32, color = '#333333', strokeWidth = 1.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// 9. AMIGOS (People)
export function HaloFriendsIcon({ size = 32, color = '#333333', strokeWidth = 1.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx="9" cy="7" r="4" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

// 10. SALIR (Logout)
export function HaloLogoutIcon({ size = 32, color = '#333333', strokeWidth = 1.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// 11. BRAND LOGO
export function HaloBrandIcon({ size = 35 }) {
  return (
    <Image
      source={require('../../assets/images/iconoApp.png')}
      style={{ width: size, height: size, resizeMode: 'contain' }}
    />
  );
}
