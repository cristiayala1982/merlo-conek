import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLOR_NARANJA = '#FF6600';
const COLOR_GRAFITO = '#111827';

export default function PoliticaPrivacidadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Encabezado */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLOR_GRAFITO} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Términos y Privacidad</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(30, insets.bottom + 15) }]}
        showsVerticalScrollIndicator={false}
      >

        {/* Banner de Bienvenida */}
        <View style={styles.bannerCard}>
          <Ionicons name="shield-checkmark" size={36} color={COLOR_NARANJA} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.bannerTitle}>Tu Privacidad es Nuestra Prioridad</Text>
            <Text style={styles.bannerSub}>Merlo ConeK está comprometido con la transparencia y protección de tus datos personales.</Text>
          </View>
        </View>

        <Text style={styles.lastUpdate}>Última actualización: 1 de Noviembre de 2026</Text>

        {/* Sección 1 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="information-circle-outline" size={22} color={COLOR_NARANJA} />
            <Text style={styles.sectionTitle}>1. Introducción y Propósito</Text>
          </View>
          <Text style={styles.paragraph}>
            <Text style={{ fontWeight: 'bold' }}>Merlo ConeK</Text> es una plataforma social y marketplace de proximidad diseñada para conectar a vecinos de la República Argentina. Estas Políticas de Privacidad y Términos de Uso explican de forma transparente cómo recopilamos, utilizamos y protegemos la información personal de nuestros usuarios, estableciendo las normas de convivencia comunitaria de acuerdo con la Ley Argentina de Protección de Datos Personales (Ley 25.326) y las normativas de las tiendas de aplicaciones.
          </Text>
        </View>

        {/* Sección 2 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="folder-open-outline" size={22} color={COLOR_NARANJA} />
            <Text style={styles.sectionTitle}>2. Información que Recopilamos</Text>
          </View>

          <Text style={styles.subTitle}>a) Datos de Perfil y Cuenta:</Text>
          <Text style={styles.paragraph}>
            Al registrarte o editar tu perfil, recopilamos tu nombre, nombre de usuario, fotografía de perfil, fotografía de portada y dirección de correo electrónico.
          </Text>

          <Text style={styles.subTitle}>b) Ubicación Declarada y GPS Opcional:</Text>
          <Text style={styles.paragraph}>
            - <Text style={{ fontWeight: 'bold' }}>Ubicación Declarada:</Text> Solicitamos voluntariamente tu Provincia, Partido/Departamento, Localidad y Barrio para mostrarte publicaciones, alertas comunitarias y servicios cercanos en tu zona.{'\n'}
            - <Text style={{ fontWeight: 'bold' }}>Ubicación GPS Exacta (Opcional):</Text> Solo si otorgas permiso explícito en tu celular, la app accederá a tu GPS cuando decidas presionar el botón "Adjuntar GPS" en una publicación o alerta comunitaria. Nunca rastreamos tu ubicación en segundo plano.
          </Text>

          <Text style={styles.subTitle}>c) Contenido Generado por el Usuario:</Text>
          <Text style={styles.paragraph}>
            Recopilamos y almacenamos las publicaciones, imágenes, videos, audios, avisos de mascotas, clasificados de oficios, artículos del marketplace, historias y mensajes privados que compartes en la plataforma.
          </Text>
        </View>

        {/* Sección 3 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="cog-outline" size={22} color={COLOR_NARANJA} />
            <Text style={styles.sectionTitle}>3. Uso de la Información</Text>
          </View>
          <Text style={styles.paragraph}>
            Utilizamos tus datos de manera responsable exclusivamente para:{'\n'}
            • Conectarte con vecinos y servicios de tu localidad o partido.{'\n'}
            • Permitir la mensajería privada e interactiva entre usuarios.{'\n'}
            • Aplicar sistemas automáticos de moderación comunitaria para prevenir contenido explícito, desnudez o lenguaje violento.{'\n'}
            • Enviarte notificaciones relevantes de la aplicación (notificaciones push de mensajes, comentarios o alertas).
          </Text>
        </View>

        {/* Sección 4 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="cloud-done-outline" size={22} color={COLOR_NARANJA} />
            <Text style={styles.sectionTitle}>4. Almacenamiento y Protección</Text>
          </View>
          <Text style={styles.paragraph}>
            Tus datos se almacenan en infraestructura segura de clase mundial (<Text style={{ fontWeight: 'bold' }}>Firebase Firestore</Text> y almacenamiento cifrado en <Text style={{ fontWeight: 'bold' }}>Cloudflare R2</Text>).{'\n\n'}
            <Text style={{ fontWeight: 'bold' }}>Política de Limpieza y Basura Cero:</Text> Cuando eliminas una publicación, un clasificado, un aviso de mascota o una conversación de chat, nuestro sistema destruye físicamente todas las fotos, archivos multimedia y miniaturas de Cloudflare R2 sin dejar residuos en nuestros servidores.
          </Text>
        </View>

        {/* Sección 5: Normas de Conducta y Contenido Generado por el Usuario (UGC) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="warning-outline" size={22} color={COLOR_NARANJA} />
            <Text style={styles.sectionTitle}>5. Normas de Conducta Comunitarias (UGC)</Text>
          </View>
          <Text style={styles.paragraph}>
            Para mantener un entorno seguro y respetuoso, está <Text style={{ fontWeight: 'bold', color: '#EF4444' }}>estrictamente prohibido</Text> compartir, publicar o enviar mediante mensajes privados cualquier contenido que incluya o promueva:
          </Text>
          <Text style={styles.paragraph}>
            • Desnudez, pornografía o contenido sexualmente explícito.{'\n'}
            • Violencia, amenazas, bullying, acoso o discursos de odio.{'\n'}
            • Insultos, obscenidades o comportamiento difamatorio.{'\n'}
            • Venta, promoción o intercambio de artículos ilegales, drogas o armas.
          </Text>
          <Text style={[styles.paragraph, { marginTop: 8, fontWeight: 'bold' }]}>
            Incumplir estas normas resultará en la eliminación inmediata del contenido y la suspensión o baneo definitivo de la cuenta del usuario sin previo aviso.
          </Text>
        </View>

        {/* Sección 6 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="person-remove-outline" size={22} color={COLOR_NARANJA} />
            <Text style={styles.sectionTitle}>6. Derechos del Usuario y Eliminación de Datos</Text>
          </View>
          <Text style={styles.paragraph}>
            Como titular de tus datos personales, tienes derecho a acceder, modificar, actualizar o solicitar la eliminación total de tus datos de nuestra base de datos.{'\n\n'}
            Si deseas solicitar la eliminación definitiva de tu cuenta y todos tus datos asociados, puedes realizarlo directamente desde la app en Ajustes -> Eliminar Cuenta, o enviando un correo electrónico a nuestro equipo oficial de soporte.
          </Text>

          <View style={styles.contactPill}>
            <Ionicons name="mail-outline" size={20} color={COLOR_NARANJA} />
            <Text style={styles.contactEmail}>cristianayala10@hotmail.com</Text>
          </View>
        </View>

        <View style={styles.footerInfo}>
          <Text style={styles.footerText}>Merlo ConeK © 2026 • Todos los derechos reservados</Text>
        </View>

      </ScrollView>

      {/* Banda blanca inferior para los botones físicos/gestos del celular */}
      <View style={{ height: insets.bottom, backgroundColor: '#FFFFFF' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLOR_GRAFITO },
  backBtn: { padding: 4 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12
  },
  bannerTitle: { fontSize: 15, fontWeight: '800', color: COLOR_GRAFITO, marginBottom: 2 },
  bannerSub: { fontSize: 13, color: '#4B5563', lineHeight: 18 },
  lastUpdate: { fontSize: 12, color: '#9CA3AF', marginBottom: 16, textAlign: 'center', fontWeight: '500' },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 1
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLOR_GRAFITO },
  subTitle: { fontSize: 14, fontWeight: '700', color: COLOR_GRAFITO, marginTop: 8, marginBottom: 4 },
  paragraph: { fontSize: 14, color: '#4B5563', lineHeight: 22 },
  contactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 12,
    alignSelf: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFEDD5'
  },
  contactEmail: { fontSize: 14, fontWeight: '700', color: COLOR_NARANJA },
  footerInfo: { marginTop: 10, alignItems: 'center' },
  footerText: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' }
});
